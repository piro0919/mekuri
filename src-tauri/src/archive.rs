use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::ops::RangeInclusive;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

fn mime_from_ext(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "avif" => "image/avif",
        _ => "image/jpeg",
    }
}

fn mime_for(filename: &str) -> &'static str {
    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    mime_from_ext(&ext)
}

fn is_image_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    // Skip macOS resource fork files and hidden files
    if lower.contains("__macosx") || lower.contains("/.") || lower.starts_with('.') {
        return false;
    }
    matches!(
        Path::new(&lower).extension().and_then(|e| e.to_str()),
        Some("jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" | "avif")
    )
}

// --- Metadata listing ---

#[derive(Serialize, Clone)]
pub struct ComicMeta {
    pub filenames: Vec<String>,
    pub page_count: usize,
    /// Which open this is. Page URLs carry it, so a page of the comic that
    /// was open before can neither be served nor come back from the
    /// webview's cache once another comic has been opened.
    pub generation: u64,
}

/// Order the collected page names and wrap them as metadata.
///
/// Sorting is natural-order, not lexicographic: comics name their pages
/// `1.jpg` / `2.jpg` / `10.jpg`, and a plain string sort would put page 10
/// between 1 and 2.
fn into_meta(mut names: Vec<String>) -> ComicMeta {
    names.sort_by(|a, b| natord::compare(a, b));
    let page_count = names.len();
    ComicMeta {
        filenames: names,
        page_count,
        generation: 0,
    }
}

fn list_cbz(archive: &zip::ZipArchive<File>) -> Vec<String> {
    (0..archive.len())
        .filter_map(|i| archive.name_for_index(i))
        .filter(|n| is_image_file(n))
        .map(str::to_string)
        .collect()
}

fn list_cbr(path: &Path) -> Result<Vec<String>, String> {
    let archive = unrar::Archive::new(path)
        .open_for_listing()
        .map_err(|e| format!("Failed to open RAR archive: {}", e))?;

    Ok(archive
        .filter_map(|e| e.ok())
        .map(|e| e.filename.to_string_lossy().to_string())
        .filter(|name| is_image_file(name))
        .collect())
}

fn list_images_in_dir(dir: &Path) -> Result<Vec<String>, String> {
    if !dir.is_dir() {
        return Err("Not a directory".to_string());
    }

    Ok(std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|name| is_image_file(name))
        .collect())
}

// --- Page cache for RAR ---

/// How far around a requested page one pass over a RAR archive extracts.
/// The viewer prefetches two pages back and three ahead, and reading is
/// mostly forward, so the pass reaches further ahead than behind.
const RAR_BEHIND: usize = 2;
const RAR_AHEAD: usize = 8;
/// Upper bound on extracted RAR pages held in memory. Larger than one
/// window so a pass never evicts what it has just read.
const RAR_CACHE_PAGES: usize = 16;

fn rar_window(index: usize, page_count: usize) -> RangeInclusive<usize> {
    let last = page_count.saturating_sub(1);
    index.saturating_sub(RAR_BEHIND)..=(index + RAR_AHEAD).min(last)
}

/// Extracted page bytes, bounded by count. When full, the page farthest
/// outside the range being read is dropped first.
struct PageCache {
    capacity: usize,
    pages: HashMap<usize, Vec<u8>>,
}

impl PageCache {
    fn new(capacity: usize) -> Self {
        Self {
            capacity,
            pages: HashMap::new(),
        }
    }

    fn get(&self, index: usize) -> Option<&Vec<u8>> {
        self.pages.get(&index)
    }

    fn contains(&self, index: usize) -> bool {
        self.pages.contains_key(&index)
    }

    fn insert(&mut self, index: usize, bytes: Vec<u8>, keep: &RangeInclusive<usize>) {
        self.pages.insert(index, bytes);
        while self.pages.len() > self.capacity {
            let distance = |i: usize| {
                if i < *keep.start() {
                    keep.start() - i
                } else {
                    i.saturating_sub(*keep.end())
                }
            };
            let Some(farthest) = self
                .pages
                .keys()
                .copied()
                .filter(|i| !keep.contains(i))
                .max_by_key(|i| distance(*i))
            else {
                break;
            };
            self.pages.remove(&farthest);
        }
    }
}

// --- Open comics ---

#[derive(Debug, PartialEq)]
pub enum PageError {
    /// The URL belongs to a comic that is no longer the open one.
    Stale,
    NotFound,
    Failed(String),
}

pub struct Page {
    pub bytes: Vec<u8>,
    pub mime: &'static str,
}

/// RAR can only be read front to back, so random access is out. The entry
/// list is built once at open; a page that is not cached costs one pass
/// that extracts the pages around it together and skips the rest.
struct RarSource {
    path: PathBuf,
    page_of: HashMap<String, usize>,
    cache: PageCache,
}

enum Source {
    Dir(PathBuf),
    // The archive stays open: the zip crate keeps the central directory,
    // so each page is a lookup and a read, not a reopen and a rescan.
    Zip(zip::ZipArchive<File>),
    Rar(RarSource),
}

struct OpenComic {
    names: Vec<String>,
    source: Source,
}

impl OpenComic {
    fn open(path: &str) -> Result<Self, String> {
        let p = Path::new(path);

        if p.is_dir() {
            let names = into_meta(list_images_in_dir(p)?).filenames;
            return Ok(Self {
                names,
                source: Source::Dir(p.to_path_buf()),
            });
        }

        match p
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .as_deref()
        {
            Some("cbz" | "zip") => {
                let file = File::open(p).map_err(|e| format!("Failed to open file: {}", e))?;
                let archive = zip::ZipArchive::new(file)
                    .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;
                let names = into_meta(list_cbz(&archive)).filenames;
                Ok(Self {
                    names,
                    source: Source::Zip(archive),
                })
            }
            Some("cbr" | "rar") => {
                let names = into_meta(list_cbr(p)?).filenames;
                let page_of = names
                    .iter()
                    .enumerate()
                    .map(|(i, n)| (n.clone(), i))
                    .collect();
                Ok(Self {
                    names,
                    source: Source::Rar(RarSource {
                        path: p.to_path_buf(),
                        page_of,
                        cache: PageCache::new(RAR_CACHE_PAGES),
                    }),
                })
            }
            _ => Err(format!("Unsupported file format: {}", path)),
        }
    }

    fn page(&mut self, index: usize) -> Result<Page, PageError> {
        let page_count = self.names.len();
        let filename = self.names.get(index).ok_or(PageError::NotFound)?;
        let mime = mime_for(filename);

        let bytes = match &mut self.source {
            Source::Dir(dir) => std::fs::read(dir.join(filename))
                .map_err(|e| PageError::Failed(format!("Failed to read {}: {}", filename, e)))?,
            Source::Zip(archive) => {
                let mut entry = archive.by_name(filename).map_err(|e| {
                    PageError::Failed(format!("Failed to find entry '{}': {}", filename, e))
                })?;
                let mut buf = Vec::new();
                entry
                    .read_to_end(&mut buf)
                    .map_err(|e| PageError::Failed(format!("Failed to read image data: {}", e)))?;
                buf
            }
            Source::Rar(rar) => {
                if !rar.cache.contains(index) {
                    rar.extract_around(index, page_count)
                        .map_err(PageError::Failed)?;
                }
                rar.cache.get(index).cloned().ok_or(PageError::NotFound)?
            }
        };

        Ok(Page { bytes, mime })
    }
}

impl RarSource {
    fn extract_around(&mut self, index: usize, page_count: usize) -> Result<(), String> {
        let window = rar_window(index, page_count);
        let mut missing = window.clone().filter(|i| !self.cache.contains(*i)).count();

        let mut archive = unrar::Archive::new(&self.path)
            .open_for_processing()
            .map_err(|e| format!("Failed to open RAR archive: {}", e))?;

        while missing > 0 {
            let Some(header) = archive
                .read_header()
                .map_err(|e| format!("Failed to read RAR header: {}", e))?
            else {
                break;
            };
            let name = header.entry().filename.to_string_lossy().to_string();
            let wanted = self
                .page_of
                .get(&name)
                .copied()
                .filter(|i| window.contains(i) && !self.cache.contains(*i));

            archive = match wanted {
                Some(page) => {
                    let (data, rest) = header
                        .read()
                        .map_err(|e| format!("Failed to read RAR entry: {}", e))?;
                    self.cache.insert(page, data, &window);
                    missing -= 1;
                    rest
                }
                None => header
                    .skip()
                    .map_err(|e| format!("Failed to skip RAR entry: {}", e))?,
            };
        }

        Ok(())
    }
}

/// The comic the viewer has open, held for the life of the app so pages
/// are read from it without reopening the file each time.
pub struct ComicStore {
    inner: Mutex<StoreInner>,
}

struct StoreInner {
    generation: u64,
    comic: Option<OpenComic>,
}

impl Default for ComicStore {
    fn default() -> Self {
        // Start from the clock rather than zero so a URL from an earlier
        // run of the app can never match a comic opened in this one.
        let seed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        Self {
            inner: Mutex::new(StoreInner {
                generation: seed,
                comic: None,
            }),
        }
    }
}

impl ComicStore {
    pub fn open(&self, path: &str) -> Result<ComicMeta, String> {
        // Read the listing before taking the lock so a slow open does not
        // hold up pages still being served for the current comic.
        let comic = OpenComic::open(path)?;
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "Comic state is unavailable".to_string())?;
        inner.generation += 1;
        let meta = ComicMeta {
            page_count: comic.names.len(),
            filenames: comic.names.clone(),
            generation: inner.generation,
        };
        inner.comic = Some(comic);
        Ok(meta)
    }

    pub fn page(&self, generation: u64, index: usize) -> Result<Page, PageError> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| PageError::Failed("Comic state is unavailable".to_string()))?;
        if inner.generation != generation {
            return Err(PageError::Stale);
        }
        inner.comic.as_mut().ok_or(PageError::Stale)?.page(index)
    }
}

/// Read `/page/<generation>/<index>` from a `mekuri:` URL path.
pub fn parse_page_path(path: &str) -> Option<(u64, usize)> {
    let mut parts = path.trim_start_matches('/').split('/');
    if parts.next()? != "page" {
        return None;
    }
    let generation = parts.next()?.parse().ok()?;
    let index = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some((generation, index))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn pages_are_ordered_naturally_not_lexicographically() {
        let meta = into_meta(vec![
            "10.jpg".to_string(),
            "2.jpg".to_string(),
            "1.jpg".to_string(),
        ]);
        assert_eq!(meta.filenames, vec!["1.jpg", "2.jpg", "10.jpg"]);
        assert_eq!(meta.page_count, 3);
    }

    #[test]
    fn natural_order_holds_across_directories_and_padding() {
        let meta = into_meta(vec![
            "ch2/p9.png".to_string(),
            "ch10/p1.png".to_string(),
            "ch2/p10.png".to_string(),
        ]);
        assert_eq!(
            meta.filenames,
            vec!["ch2/p9.png", "ch2/p10.png", "ch10/p1.png"]
        );
    }

    #[test]
    fn an_empty_archive_reports_zero_pages() {
        let meta = into_meta(Vec::new());
        assert_eq!(meta.page_count, 0);
        assert!(meta.filenames.is_empty());
    }

    #[test]
    fn image_extensions_are_recognised_case_insensitively() {
        for name in [
            "p.jpg", "p.JPEG", "p.PnG", "p.webp", "p.gif", "p.bmp", "p.avif",
        ] {
            assert!(is_image_file(name), "{name} should be a page");
        }
    }

    #[test]
    fn non_images_and_macos_cruft_are_skipped() {
        for name in [
            "notes.txt",
            "ComicInfo.xml",
            "cover",
            "__MACOSX/._p1.jpg",
            "chapter/.hidden.jpg",
            ".DS_Store",
        ] {
            assert!(!is_image_file(name), "{name} should not be a page");
        }
    }

    #[test]
    fn mime_falls_back_to_jpeg_for_unknown_extensions() {
        assert_eq!(mime_from_ext("png"), "image/png");
        assert_eq!(mime_from_ext("jpeg"), "image/jpeg");
        assert_eq!(mime_from_ext("tiff"), "image/jpeg");
    }

    #[test]
    fn mime_comes_from_the_filename_and_ignores_case() {
        assert_eq!(mime_for("ch1/page.PNG"), "image/png");
        assert_eq!(mime_for("page"), "image/jpeg");
    }

    // --- URL parsing ---

    #[test]
    fn page_paths_carry_generation_and_index() {
        assert_eq!(parse_page_path("/page/42/7"), Some((42, 7)));
        assert_eq!(parse_page_path("page/1/0"), Some((1, 0)));
    }

    #[test]
    fn malformed_page_paths_are_rejected() {
        for path in [
            "/",
            "/page",
            "/page/1",
            "/page/x/1",
            "/page/1/-1",
            "/img/1/2",
            "/page/1/2/3",
        ] {
            assert_eq!(parse_page_path(path), None, "{path}");
        }
    }

    // --- RAR window and cache ---

    #[test]
    fn rar_window_reaches_further_ahead_than_behind() {
        assert_eq!(rar_window(10, 100), 8..=18);
    }

    #[test]
    fn rar_window_is_clamped_to_the_comic() {
        assert_eq!(rar_window(0, 100), 0..=8);
        assert_eq!(rar_window(98, 100), 96..=99);
        assert_eq!(rar_window(0, 1), 0..=0);
    }

    #[test]
    fn rar_cache_holds_more_than_one_window() {
        let w = rar_window(50, 100);
        assert!(w.end() - w.start() < RAR_CACHE_PAGES);
    }

    #[test]
    fn page_cache_evicts_the_page_farthest_outside_the_kept_range() {
        let mut cache = PageCache::new(3);
        let keep = 10..=11;
        cache.insert(2, vec![2], &keep);
        cache.insert(9, vec![9], &keep);
        cache.insert(10, vec![10], &keep);
        cache.insert(11, vec![11], &keep);
        assert!(!cache.contains(2), "farthest page should go first");
        assert!(cache.contains(9));
        assert_eq!(cache.get(10), Some(&vec![10]));
        assert_eq!(cache.get(11), Some(&vec![11]));
    }

    #[test]
    fn page_cache_never_evicts_inside_the_kept_range() {
        let mut cache = PageCache::new(2);
        let keep = 0..=8;
        for i in 0..=2 {
            cache.insert(i, vec![i as u8], &keep);
        }
        // All three are wanted, so the bound gives way rather than drop one.
        assert_eq!(cache.pages.len(), 3);
    }

    // --- Store, end to end ---

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "mekuri-test-{}-{}-{}",
            name,
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_folder_serves_pages_in_natural_order() {
        let dir = temp_dir("dir");
        std::fs::write(dir.join("10.png"), b"ten").unwrap();
        std::fs::write(dir.join("2.jpg"), b"two").unwrap();
        std::fs::write(dir.join("notes.txt"), b"skip").unwrap();

        let store = ComicStore::default();
        let meta = store.open(dir.to_str().unwrap()).unwrap();
        assert_eq!(meta.filenames, vec!["2.jpg", "10.png"]);

        let page = store.page(meta.generation, 1).unwrap();
        assert_eq!(page.bytes, b"ten");
        assert_eq!(page.mime, "image/png");
        assert_eq!(
            store.page(meta.generation, 2).err(),
            Some(PageError::NotFound)
        );

        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_cbz_stays_open_and_serves_any_page() {
        let dir = temp_dir("cbz");
        let path = dir.join("book.cbz");
        {
            let mut zip = zip::ZipWriter::new(File::create(&path).unwrap());
            let opts = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);
            for (name, body) in [
                ("p10.jpg", "ten"),
                ("p1.jpg", "one"),
                ("ComicInfo.xml", "x"),
            ] {
                zip.start_file(name, opts).unwrap();
                zip.write_all(body.as_bytes()).unwrap();
            }
            zip.finish().unwrap();
        }

        let store = ComicStore::default();
        let meta = store.open(path.to_str().unwrap()).unwrap();
        assert_eq!(meta.filenames, vec!["p1.jpg", "p10.jpg"]);
        // Out of order, and twice, from the one open archive.
        assert_eq!(store.page(meta.generation, 1).unwrap().bytes, b"ten");
        assert_eq!(store.page(meta.generation, 0).unwrap().bytes, b"one");
        assert_eq!(store.page(meta.generation, 1).unwrap().bytes, b"ten");

        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn opening_another_comic_makes_old_page_urls_stale() {
        let a = temp_dir("a");
        let b = temp_dir("b");
        std::fs::write(a.join("1.jpg"), b"from a").unwrap();
        std::fs::write(b.join("1.jpg"), b"from b").unwrap();

        let store = ComicStore::default();
        let first = store.open(a.to_str().unwrap()).unwrap();
        let second = store.open(b.to_str().unwrap()).unwrap();

        assert_ne!(first.generation, second.generation);
        assert_eq!(
            store.page(first.generation, 0).err(),
            Some(PageError::Stale)
        );
        assert_eq!(store.page(second.generation, 0).unwrap().bytes, b"from b");

        std::fs::remove_dir_all(a).unwrap();
        std::fs::remove_dir_all(b).unwrap();
    }

    #[test]
    fn nothing_is_served_before_a_comic_is_opened() {
        let store = ComicStore::default();
        let generation = store.inner.lock().unwrap().generation;
        assert_eq!(store.page(generation, 0).err(), Some(PageError::Stale));
    }

    // A RAR 4 archive with stored (uncompressed) entries, written by hand
    // because no RAR encoder is available to the tests.
    fn crc32(data: &[u8]) -> u32 {
        let mut crc = 0xFFFF_FFFFu32;
        for &byte in data {
            crc ^= byte as u32;
            for _ in 0..8 {
                crc = if crc & 1 != 0 {
                    (crc >> 1) ^ 0xEDB8_8320
                } else {
                    crc >> 1
                };
            }
        }
        !crc
    }

    fn rar_block(body: &[u8]) -> Vec<u8> {
        let crc = (crc32(body) & 0xFFFF) as u16;
        let mut v = crc.to_le_bytes().to_vec();
        v.extend_from_slice(body);
        v
    }

    fn stored_rar(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let mut out = b"Rar!\x1a\x07\x00".to_vec();
        // Main archive header: type 0x73, no flags, size 13.
        out.extend(rar_block(&[0x73, 0, 0, 13, 0, 0, 0, 0, 0, 0, 0]));
        for (name, data) in entries {
            let mut h = vec![0x74];
            h.extend_from_slice(&0x8000u16.to_le_bytes()); // LONG_BLOCK
            h.extend_from_slice(&((32 + name.len()) as u16).to_le_bytes());
            h.extend_from_slice(&(data.len() as u32).to_le_bytes()); // packed
            h.extend_from_slice(&(data.len() as u32).to_le_bytes()); // unpacked
            h.push(0); // host OS: MS-DOS
            h.extend_from_slice(&crc32(data).to_le_bytes());
            h.extend_from_slice(&0x5A21_0000u32.to_le_bytes()); // DOS time
            h.push(20); // version needed: 2.0
            h.push(0x30); // method: store
            h.extend_from_slice(&(name.len() as u16).to_le_bytes());
            h.extend_from_slice(&0x20u32.to_le_bytes()); // attributes: archive
            h.extend_from_slice(name.as_bytes());
            out.extend(rar_block(&h));
            out.extend_from_slice(data);
        }
        // End of archive.
        out.extend(rar_block(&[0x7B, 0x00, 0x40, 0x07, 0x00]));
        out
    }

    #[test]
    fn a_cbr_is_listed_once_and_extracted_a_window_at_a_time() {
        let dir = temp_dir("cbr");
        let path = dir.join("book.cbr");
        let names: Vec<String> = (1..=20).map(|i| format!("{i}.jpg")).collect();
        // Archive order is reversed so the natural order has to be rebuilt.
        let entries: Vec<(&str, &[u8])> = names
            .iter()
            .rev()
            .map(|n| (n.as_str(), n.as_bytes()))
            .collect();
        std::fs::write(&path, stored_rar(&entries)).unwrap();

        let store = ComicStore::default();
        let meta = store.open(path.to_str().unwrap()).unwrap();
        assert_eq!(meta.filenames, names);

        assert_eq!(store.page(meta.generation, 5).unwrap().bytes, b"6.jpg");
        {
            let inner = store.inner.lock().unwrap();
            let Source::Rar(rar) = &inner.comic.as_ref().unwrap().source else {
                panic!("expected a RAR source");
            };
            // One pass pulled in the whole window, and nothing past it.
            for i in rar_window(5, 20) {
                assert!(rar.cache.contains(i), "page {i} should be cached");
            }
            assert!(!rar.cache.contains(14));
        }
        assert_eq!(store.page(meta.generation, 19).unwrap().bytes, b"20.jpg");
        assert_eq!(store.page(meta.generation, 0).unwrap().bytes, b"1.jpg");

        std::fs::remove_dir_all(dir).unwrap();
    }
}

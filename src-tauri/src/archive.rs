use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::io::Read;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct ComicPage {
    pub index: usize,
    pub filename: String,
    pub data_url: String,
    pub width: u32,
    pub height: u32,
}

/// Parse image dimensions from raw bytes without decoding the full image.
fn image_dimensions(data: &[u8]) -> (u32, u32) {
    if data.len() < 12 {
        return (0, 0);
    }

    // PNG: 0x89 P N G
    if data[0..4] == [0x89, 0x50, 0x4E, 0x47] && data.len() >= 24 {
        let w = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
        let h = u32::from_be_bytes([data[20], data[21], data[22], data[23]]);
        return (w, h);
    }

    // GIF: "GIF"
    if data[0..3] == [0x47, 0x49, 0x46] && data.len() >= 10 {
        let w = u16::from_le_bytes([data[6], data[7]]) as u32;
        let h = u16::from_le_bytes([data[8], data[9]]) as u32;
        return (w, h);
    }

    // BMP: "BM"
    if data[0..2] == [0x42, 0x4D] && data.len() >= 26 {
        let w = i32::from_le_bytes([data[18], data[19], data[20], data[21]]).unsigned_abs();
        let h = i32::from_le_bytes([data[22], data[23], data[24], data[25]]).unsigned_abs();
        return (w, h);
    }

    // JPEG: 0xFF 0xD8
    if data[0..2] == [0xFF, 0xD8] {
        let mut i = 2;
        while i + 9 < data.len() {
            if data[i] != 0xFF {
                i += 1;
                continue;
            }
            let marker = data[i + 1];
            // SOF0, SOF1, SOF2 (baseline, extended, progressive)
            if marker == 0xC0 || marker == 0xC1 || marker == 0xC2 {
                let h = u16::from_be_bytes([data[i + 5], data[i + 6]]) as u32;
                let w = u16::from_be_bytes([data[i + 7], data[i + 8]]) as u32;
                return (w, h);
            }
            if i + 3 >= data.len() {
                break;
            }
            let len = u16::from_be_bytes([data[i + 2], data[i + 3]]) as usize;
            i += 2 + len;
        }
    }

    // WEBP: "RIFF" ... "WEBP"
    if data.len() >= 30 && &data[0..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        if &data[12..16] == b"VP8 " {
            let w = (u16::from_le_bytes([data[26], data[27]]) & 0x3FFF) as u32;
            let h = (u16::from_le_bytes([data[28], data[29]]) & 0x3FFF) as u32;
            return (w, h);
        }
        if &data[12..16] == b"VP8L" && data.len() >= 25 {
            let bits = u32::from_le_bytes([data[21], data[22], data[23], data[24]]);
            let w = (bits & 0x3FFF) + 1;
            let h = ((bits >> 14) & 0x3FFF) + 1;
            return (w, h);
        }
    }

    (0, 0)
}

fn mime_from_ext(ext: &str) -> &str {
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

fn is_image_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    // Skip macOS resource fork files and hidden files
    if lower.contains("__macosx") || lower.contains("/.") || lower.starts_with('.') {
        return false;
    }
    matches!(
        Path::new(&lower)
            .extension()
            .and_then(|e| e.to_str()),
        Some("jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" | "avif")
    )
}

fn to_data_url(bytes: &[u8], filename: &str) -> String {
    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let mime = mime_from_ext(&ext);
    let b64 = STANDARD.encode(bytes);
    format!("data:{};base64,{}", mime, b64)
}

// --- Metadata listing ---

#[derive(Serialize, Clone)]
pub struct ComicMeta {
    pub filenames: Vec<String>,
    pub page_count: usize,
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
    }
}

pub fn list_cbz(path: &str) -> Result<ComicMeta, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    let names: Vec<String> = (0..archive.len())
        .filter_map(|i| {
            archive.name_for_index(i).and_then(|n| {
                if is_image_file(n) {
                    Some(n.to_string())
                } else {
                    None
                }
            })
        })
        .collect();

    Ok(into_meta(names))
}

pub fn list_cbr(path: &str) -> Result<ComicMeta, String> {
    let archive = unrar::Archive::new(path)
        .open_for_listing()
        .map_err(|e| format!("Failed to open RAR archive: {}", e))?;

    let names: Vec<String> = archive
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.filename.to_string_lossy().to_string();
            is_image_file(&name)
        })
        .map(|e| e.filename.to_string_lossy().to_string())
        .collect();

    Ok(into_meta(names))
}

pub fn list_images_in_dir(path: &str) -> Result<ComicMeta, String> {
    let dir = Path::new(path);
    if !dir.is_dir() {
        return Err("Not a directory".to_string());
    }

    let names: Vec<String> = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if is_image_file(&name) {
                Some(name)
            } else {
                None
            }
        })
        .collect();

    Ok(into_meta(names))
}

// --- Lazy loading: single page extraction (filename passed directly) ---

pub fn get_page_from_cbz(path: &str, index: usize, filename: &str) -> Result<ComicPage, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    let mut entry = archive
        .by_name(filename)
        .map_err(|e| format!("Failed to find entry '{}': {}", filename, e))?;

    let mut buf = Vec::new();
    entry
        .read_to_end(&mut buf)
        .map_err(|e| format!("Failed to read image data: {}", e))?;

    let (width, height) = image_dimensions(&buf);
    Ok(ComicPage {
        index,
        data_url: to_data_url(&buf, filename),
        filename: filename.to_string(),
        width,
        height,
    })
}

pub fn get_page_from_cbr(path: &str, index: usize, filename: &str) -> Result<ComicPage, String> {
    let mut archive = unrar::Archive::new(path)
        .open_for_processing()
        .map_err(|e| format!("Failed to open RAR archive: {}", e))?;

    loop {
        match archive.read_header() {
            Ok(Some(header)) => {
                let name = header.entry().filename.to_string_lossy().to_string();
                if name == filename {
                    let (data, _) = header
                        .read()
                        .map_err(|e| format!("Failed to read RAR entry: {}", e))?;
                    let (width, height) = image_dimensions(&data);
                    return Ok(ComicPage {
                        index,
                        data_url: to_data_url(&data, filename),
                        filename: filename.to_string(),
                        width,
                        height,
                    });
                }
                archive = header
                    .skip()
                    .map_err(|e| format!("Failed to skip RAR entry: {}", e))?;
            }
            Ok(None) => return Err(format!("Entry '{}' not found in archive", filename)),
            Err(e) => return Err(format!("Failed to read RAR header: {}", e)),
        }
    }
}

pub fn get_page_from_dir(path: &str, index: usize, filename: &str) -> Result<ComicPage, String> {
    let file_path = Path::new(path).join(filename);
    let data =
        std::fs::read(&file_path).map_err(|e| format!("Failed to read {}: {}", filename, e))?;

    let (width, height) = image_dimensions(&data);
    Ok(ComicPage {
        index,
        data_url: to_data_url(&data, filename),
        filename: filename.to_string(),
        width,
        height,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

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
        for name in ["p.jpg", "p.JPEG", "p.PnG", "p.webp", "p.gif", "p.bmp", "p.avif"] {
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
    fn data_url_carries_the_mime_of_the_filename() {
        let url = to_data_url(b"hi", "page.png");
        assert_eq!(url, "data:image/png;base64,aGk=");
    }

    #[test]
    fn data_url_of_an_extensionless_name_falls_back_to_jpeg() {
        assert!(to_data_url(b"hi", "page").starts_with("data:image/jpeg;base64,"));
    }

    fn png_header(w: u32, h: u32) -> Vec<u8> {
        let mut v = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        v.extend_from_slice(&[0, 0, 0, 13]); // IHDR length
        v.extend_from_slice(b"IHDR");
        v.extend_from_slice(&w.to_be_bytes());
        v.extend_from_slice(&h.to_be_bytes());
        v
    }

    #[test]
    fn png_dimensions_come_from_the_ihdr_chunk() {
        assert_eq!(image_dimensions(&png_header(1280, 1810)), (1280, 1810));
    }

    #[test]
    fn gif_dimensions_are_little_endian() {
        let mut v = b"GIF89a".to_vec();
        v.extend_from_slice(&800u16.to_le_bytes());
        v.extend_from_slice(&1200u16.to_le_bytes());
        v.extend_from_slice(&[0; 4]);
        assert_eq!(image_dimensions(&v), (800, 1200));
    }

    #[test]
    fn bmp_dimensions_use_the_absolute_value_of_a_bottom_up_height() {
        let mut v = b"BM".to_vec();
        v.extend_from_slice(&[0; 16]); // through byte 17
        v.extend_from_slice(&640i32.to_le_bytes());
        // A negative height means a top-down bitmap; the size is still 480.
        v.extend_from_slice(&(-480i32).to_le_bytes());
        assert_eq!(image_dimensions(&v), (640, 480));
    }

    #[test]
    fn jpeg_dimensions_come_from_the_first_sof_marker() {
        // FF D8 | FF C0 len(2) precision height(2) width(2)
        let mut v = vec![0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08];
        v.extend_from_slice(&1754u16.to_be_bytes()); // height first
        v.extend_from_slice(&1240u16.to_be_bytes()); // then width
        v.extend_from_slice(&[0; 8]);
        assert_eq!(image_dimensions(&v), (1240, 1754));
    }

    #[test]
    fn jpeg_skips_leading_segments_before_the_sof() {
        // An APP0/JFIF block sits before the SOF in most real files.
        let mut v = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x06, 0x4A, 0x46, 0x00, 0x00];
        v.extend_from_slice(&[0xFF, 0xC2, 0x00, 0x11, 0x08]);
        v.extend_from_slice(&2000u16.to_be_bytes());
        v.extend_from_slice(&1500u16.to_be_bytes());
        v.extend_from_slice(&[0; 8]);
        assert_eq!(image_dimensions(&v), (1500, 2000));
    }

    #[test]
    fn lossy_webp_masks_off_the_scaling_bits() {
        let mut v = b"RIFF".to_vec();
        v.extend_from_slice(&[0; 4]);
        v.extend_from_slice(b"WEBP");
        v.extend_from_slice(b"VP8 ");
        v.extend_from_slice(&[0; 10]); // through byte 25
        // Top two bits are the scaling field and must not leak into the size.
        v.extend_from_slice(&(0xC000u16 | 1024).to_le_bytes());
        v.extend_from_slice(&(0xC000u16 | 768).to_le_bytes());
        assert_eq!(image_dimensions(&v), (1024, 768));
    }

    #[test]
    fn lossless_webp_dimensions_are_stored_minus_one() {
        let mut v = b"RIFF".to_vec();
        v.extend_from_slice(&[0; 4]);
        v.extend_from_slice(b"WEBP");
        v.extend_from_slice(b"VP8L");
        v.extend_from_slice(&[0; 5]); // through byte 20
        let bits: u32 = (1023) | (767 << 14);
        v.extend_from_slice(&bits.to_le_bytes());
        v.extend_from_slice(&[0; 5]); // pad to the 30-byte floor
        assert_eq!(image_dimensions(&v), (1024, 768));
    }

    #[test]
    fn unknown_or_truncated_data_reports_no_dimensions() {
        assert_eq!(image_dimensions(&[]), (0, 0));
        assert_eq!(image_dimensions(&[0x89, 0x50]), (0, 0));
        assert_eq!(image_dimensions(&[0u8; 64]), (0, 0));
    }
}

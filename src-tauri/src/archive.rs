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

pub fn list_cbz(path: &str) -> Result<ComicMeta, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    let mut names: Vec<String> = (0..archive.len())
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

    names.sort_by(|a, b| natord::compare(a, b));
    let page_count = names.len();

    Ok(ComicMeta {
        filenames: names,
        page_count,
    })
}

pub fn list_cbr(path: &str) -> Result<ComicMeta, String> {
    let archive = unrar::Archive::new(path)
        .open_for_listing()
        .map_err(|e| format!("Failed to open RAR archive: {}", e))?;

    let mut names: Vec<String> = archive
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.filename.to_string_lossy().to_string();
            is_image_file(&name)
        })
        .map(|e| e.filename.to_string_lossy().to_string())
        .collect();

    names.sort_by(|a, b| natord::compare(a, b));
    let page_count = names.len();

    Ok(ComicMeta {
        filenames: names,
        page_count,
    })
}

pub fn list_images_in_dir(path: &str) -> Result<ComicMeta, String> {
    let dir = Path::new(path);
    if !dir.is_dir() {
        return Err("Not a directory".to_string());
    }

    let mut names: Vec<String> = std::fs::read_dir(dir)
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

    names.sort_by(|a, b| natord::compare(a, b));
    let page_count = names.len();

    Ok(ComicMeta {
        filenames: names,
        page_count,
    })
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

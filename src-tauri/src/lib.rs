use std::path::Path;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

mod archive;

#[tauri::command]
fn open_comic_meta(path: String) -> Result<archive::ComicMeta, String> {
    let p = Path::new(&path);

    if p.is_dir() {
        return archive::list_images_in_dir(&path);
    }

    match p
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("cbz" | "zip") => archive::list_cbz(&path),
        Some("cbr" | "rar") => archive::list_cbr(&path),
        _ => Err(format!("Unsupported file format: {}", path)),
    }
}

#[tauri::command]
fn get_page(path: String, index: usize, filename: String) -> Result<archive::ComicPage, String> {
    let p = Path::new(&path);

    if p.is_dir() {
        return archive::get_page_from_dir(&path, index, &filename);
    }

    match p
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("cbz" | "zip") => archive::get_page_from_cbz(&path, index, &filename),
        Some("cbr" | "rar") => archive::get_page_from_cbr(&path, index, &filename),
        _ => Err(format!("Unsupported file format: {}", path)),
    }
}

fn build_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let app_menu = Submenu::with_items(
        app,
        "Mekuri",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Mekuri"), None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(app, "open-file", "Open File...", true, Some("CmdOrCtrl+O"))?,
            &MenuItem::with_id(
                app,
                "open-folder",
                "Open Folder...",
                true,
                Some("CmdOrCtrl+Shift+O"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(
                app,
                "toggle-direction",
                "Toggle Reading Direction",
                true,
                Some("CmdOrCtrl+D"),
            )?,
            &MenuItem::with_id(
                app,
                "toggle-view-mode",
                "Toggle View Mode",
                true,
                Some("CmdOrCtrl+Shift+D"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu, &file_menu, &view_menu, &window_menu])
}

async fn check_for_updates(app: tauri::AppHandle) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(_) => return,
    };
    let update = match updater.check().await {
        Ok(Some(u)) => u,
        _ => return,
    };

    let msg = format!(
        "新しいバージョン v{} が利用可能です。\nアップデートしますか？",
        update.version
    );

    let confirmed = app
        .dialog()
        .message(&msg)
        .title("アップデート")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "OK".to_string(),
            "キャンセル".to_string(),
        ))
        .blocking_show();

    if !confirmed {
        return;
    }

    let bytes = match update.download(|_, _| {}, || {}).await {
        Ok(b) => b,
        Err(e) => {
            app.dialog()
                .message(format!("ダウンロードに失敗しました。\n{}", e))
                .title("アップデート")
                .blocking_show();
            return;
        }
    };

    match update.install(bytes) {
        Ok(_) => {
            app.dialog()
                .message("アップデートが完了しました。\nアプリを自動で再起動します。")
                .title("アップデート")
                .blocking_show();
            // Relaunch via `open` command as workaround for Tauri macOS restart bug
            if let Ok(path) = std::env::current_exe() {
                if let Some(app_bundle) = path
                    .ancestors()
                    .find(|p| p.extension().is_some_and(|ext| ext == "app"))
                {
                    let _ = std::process::Command::new("sh")
                        .arg("-c")
                        .arg(format!("sleep 1 && open '{}'", app_bundle.display()))
                        .spawn();
                }
            }
            app.exit(0);
        }
        Err(e) => {
            app.dialog()
                .message(format!("インストールに失敗しました。\n{}", e))
                .title("アップデート")
                .blocking_show();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .menu(|app| build_menu(app))
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "open-file" | "open-folder" | "toggle-direction" | "toggle-view-mode" => {
                    let _ = app.emit("menu-event", id.to_string());
                }
                _ => {}
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates(handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![open_comic_meta, get_page])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

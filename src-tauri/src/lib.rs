use std::sync::Mutex;
use tauri::http::{header, Response, StatusCode};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

mod archive;

/// A comic macOS handed over — a double-click, a drop on the Dock icon, or
/// `open -a Mekuri comic.cbz`. Held here rather than pushed straight to the
/// webview because launching this way delivers the path while the frontend
/// is still starting up and has nobody listening yet. The webview asks for
/// it on mount and again whenever `open-pending` fires, and taking it
/// clears it, so a comic is never opened twice.
static PENDING_OPEN: Mutex<Option<String>> = Mutex::new(None);

#[tauri::command]
fn take_pending_open() -> Option<String> {
    PENDING_OPEN.lock().ok()?.take()
}

// Async so a slow listing, or waiting on a RAR pass for the previous
// comic, does not hold up the main thread.
#[tauri::command]
async fn open_comic_meta(
    path: String,
    store: tauri::State<'_, archive::ComicStore>,
) -> Result<archive::ComicMeta, String> {
    store.open(&path)
}

/// Answer a `mekuri://localhost/page/<generation>/<index>` request with the
/// page's raw bytes. The URL never changes for a given page of a given open,
/// so the webview may keep it as long as it likes.
fn page_response(store: &archive::ComicStore, path: &str) -> Response<Vec<u8>> {
    let result = match archive::parse_page_path(path) {
        Some((generation, index)) => store.page(generation, index),
        None => Err(archive::PageError::NotFound),
    };
    let builder = Response::builder().header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");

    let built = match result {
        Ok(page) => builder
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, page.mime)
            .header(header::CACHE_CONTROL, "max-age=31536000, immutable")
            .body(page.bytes),
        Err(err) => {
            let status = match err {
                archive::PageError::Stale => StatusCode::GONE,
                archive::PageError::NotFound => StatusCode::NOT_FOUND,
                archive::PageError::Failed(message) => {
                    eprintln!("Failed to serve {}: {}", path, message);
                    StatusCode::INTERNAL_SERVER_ERROR
                }
            };
            builder.status(status).body(Vec::new())
        }
    };
    built.unwrap_or_else(|_| {
        let mut response = Response::new(Vec::new());
        *response.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
        response
    })
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
            // Relaunch via `open` command as workaround for Tauri macOS restart bug.
            // The bundle path goes in as its own argument, never through a
            // shell, so a path containing `'` or spaces still opens. `-n`
            // starts a fresh instance even though this one has not exited
            // yet — that is what the old `sleep 1` before `open` was for.
            if let Ok(path) = std::env::current_exe() {
                if let Some(app_bundle) = path
                    .ancestors()
                    .find(|p| p.extension().is_some_and(|ext| ext == "app"))
                {
                    let _ = std::process::Command::new("open")
                        .arg("-n")
                        .arg(app_bundle)
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
        .manage(archive::ComicStore::default())
        .register_asynchronous_uri_scheme_protocol("mekuri", |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            let path = request.uri().path().to_string();
            // Reading a page can mean a pass over a RAR archive, so keep it
            // off the thread that delivered the request.
            tauri::async_runtime::spawn_blocking(move || {
                let store = app.state::<archive::ComicStore>();
                responder.respond(page_response(&store, &path));
            });
        })
        .menu(build_menu)
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
        .invoke_handler(tauri::generate_handler![open_comic_meta, take_pending_open])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            // macOS delivers files opened from outside the app here, both
            // at launch and while it is already running.
            if let tauri::RunEvent::Opened { urls } = event {
                let Some(path) = urls
                    .iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .find_map(|path| path.to_str().map(str::to_owned))
                else {
                    return;
                };
                if let Ok(mut pending) = PENDING_OPEN.lock() {
                    *pending = Some(path);
                }
                // Only a nudge — the path itself travels through
                // `take_pending_open` so there is one consumer either way.
                let _ = app.emit("open-pending", ());
            }
        });
}

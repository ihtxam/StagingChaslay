use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::MacosLauncher;
use url::Url;

fn host_allowed(host: &str) -> bool {
    let h = host.to_ascii_lowercase();
    h == "localhost"
        || h == "127.0.0.1"
        || h.ends_with(".chaslay.com")
        || h == "chaslay.com"
        || h.ends_with(".rebornsense.com")
        || h == "rebornsense.com"
}

fn pos_start_url() -> String {
    if let Ok(raw) = std::env::var("CHASLAY_POS_URL") {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    if cfg!(debug_assertions) {
        "http://127.0.0.1:5173/login".to_string()
    } else {
        "https://app.chaslay.com/login".to_string()
    }
}

fn is_allowed_navigation(url: &Url) -> bool {
    match url.scheme() {
        "https" | "http" | "tauri" | "ipc" | "asset" | "data" => {}
        _ => return false,
    }
    match url.host_str() {
        Some(host) => host_allowed(host),
        None => matches!(url.scheme(), "tauri" | "ipc" | "asset" | "data"),
    }
}

#[tauri::command]
fn pos_env() -> serde_json::Value {
    serde_json::json!({
        "shell": "tauri",
        "version": env!("CARGO_PKG_VERSION"),
        "debug": cfg!(debug_assertions),
    })
}

#[tauri::command]
fn set_start_with_windows(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    let mgr = app.autolaunch();
    if enabled {
        mgr.enable().map_err(|e| e.to_string())?;
    } else {
        mgr.disable().map_err(|e| e.to_string())?;
    }
    mgr.is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn is_start_with_windows(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.set_focus();
                let _ = win.show();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .invoke_handler(tauri::generate_handler![
            pos_env,
            set_start_with_windows,
            is_start_with_windows
        ])
        .setup(|app| {
            if app.get_webview_window("main").is_some() {
                return Ok(());
            }
            let start = pos_start_url();
            let parsed = Url::parse(&start).unwrap_or_else(|_| {
                Url::parse("https://app.chaslay.com/login").expect("static url")
            });
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(parsed))
                .title("Chaslay POS")
                .fullscreen(true)
                .maximized(true)
                .decorations(false)
                .resizable(true)
                .visible(true)
                .on_navigation(|url| is_allowed_navigation(&url))
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start Chaslay POS");
}

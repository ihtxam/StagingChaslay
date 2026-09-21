use std::process::Child;
#[cfg(target_os = "windows")]
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::MacosLauncher;
use url::Url;

const PRINT_AGENT_URL: &str = "http://127.0.0.1:9101";

struct SidecarState {
    child: Mutex<Option<Child>>,
}

struct WindowModeState {
    mode: Mutex<String>,
}

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

fn agent_get(path: &str) -> Result<serde_json::Value, String> {
    let url = format!("{PRINT_AGENT_URL}{path}");
    let response = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(4))
        .call()
        .map_err(|e| e.to_string())?;
    response.into_json().map_err(|e| e.to_string())
}

fn agent_post(path: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
    let url = format!("{PRINT_AGENT_URL}{path}");
    let response = ureq::post(&url)
        .timeout(std::time::Duration::from_secs(20))
        .send_json(body)
        .map_err(|e| e.to_string())?;
    response.into_json().map_err(|e| e.to_string())
}

fn sidecar_already_healthy() -> bool {
    agent_get("/health")
        .map(|v| v.get("ok").and_then(|x| x.as_bool()) == Some(true))
        .unwrap_or(false)
}

fn spawn_sidecar_process(app: &tauri::AppHandle) -> Result<Child, String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(resource_dir) = app.path().resource_dir() {
            let candidates = [
                resource_dir.join("reborn-print-agent.exe"),
                resource_dir.join("reborn-print-agent-x86_64-pc-windows-msvc.exe"),
            ];
            for exe in candidates {
                if exe.is_file() {
                    return Command::new(exe)
                        .stdin(Stdio::null())
                        .stdout(Stdio::null())
                        .stderr(Stdio::null())
                        .spawn()
                        .map_err(|e| e.to_string());
                }
            }
        }
        if let Ok(appdata) = std::env::var("LOCALAPPDATA") {
            let exe = std::path::Path::new(&appdata)
                .join("RebornPrintAgent")
                .join("reborn-print-agent.exe");
            if exe.is_file() {
                return Command::new(exe)
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
                    .map_err(|e| e.to_string());
            }
        }
    }
    Err("Print Agent sidecar binary not found".to_string())
}

fn ensure_sidecar(app: &tauri::AppHandle, state: &SidecarState) -> Result<(), String> {
    if sidecar_already_healthy() {
        return Ok(());
    }
    let mut guard = state.child.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        for _ in 0..12 {
            if sidecar_already_healthy() {
                return Ok(());
            }
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
    }
    if sidecar_already_healthy() {
        return Ok(());
    }
    match spawn_sidecar_process(app) {
        Ok(child) => {
            *guard = Some(child);
            for _ in 0..20 {
                if sidecar_already_healthy() {
                    return Ok(());
                }
                std::thread::sleep(std::time::Duration::from_millis(250));
            }
            Err("Print Agent sidecar did not become healthy on 127.0.0.1:9101".to_string())
        }
        Err(e) => {
            if sidecar_already_healthy() {
                Ok(())
            } else {
                Err(e)
            }
        }
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

#[tauri::command]
fn desktop_reload(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.eval("window.location.reload()")
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn desktop_window_mode(window_mode: State<'_, WindowModeState>) -> Result<String, String> {
    let guard = window_mode.mode.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
fn desktop_toggle_window_mode(
    app: tauri::AppHandle,
    window_mode: State<'_, WindowModeState>,
) -> Result<String, String> {
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let next = {
        let guard = window_mode.mode.lock().map_err(|e| e.to_string())?;
        if *guard == "maximized" {
            "normal".to_string()
        } else {
            "maximized".to_string()
        }
    };
    if next == "maximized" {
        let _ = win.set_fullscreen(false);
        let _ = win.maximize();
        let _ = win.show();
        let _ = win.set_focus();
    } else {
        let _ = win.unmaximize();
        let _ = win.set_fullscreen(false);
        let _ = win.show();
        let _ = win.set_focus();
    }
    {
        let mut guard = window_mode.mode.lock().map_err(|e| e.to_string())?;
        *guard = next.clone();
    }
    Ok(next)
}

#[tauri::command]
fn sidecar_health(app: tauri::AppHandle, sidecar: State<'_, SidecarState>) -> serde_json::Value {
    let _ = ensure_sidecar(&app, &sidecar);
    match agent_get("/health") {
        Ok(data) => serde_json::json!({
            "ok": data.get("ok").and_then(|v| v.as_bool()) == Some(true),
            "version": data.get("version").and_then(|v| v.as_str()),
            "port": 9101,
        }),
        Err(err) => serde_json::json!({
            "ok": false,
            "error": err,
            "port": 9101,
        }),
    }
}

#[tauri::command]
fn hw_agent_status(
    app: tauri::AppHandle,
    sidecar: State<'_, SidecarState>,
) -> Result<serde_json::Value, String> {
    let _ = ensure_sidecar(&app, &sidecar);
    let data = agent_get("/health")?;
    Ok(serde_json::json!({
        "running": data.get("ok").and_then(|v| v.as_bool()) == Some(true),
        "port": 9101,
        "version": data.get("version").and_then(|v| v.as_str()),
    }))
}

#[tauri::command]
fn hw_list_printers(
    app: tauri::AppHandle,
    sidecar: State<'_, SidecarState>,
) -> Result<serde_json::Value, String> {
    let _ = ensure_sidecar(&app, &sidecar);
    let data = agent_get("/printers")?;
    Ok(serde_json::json!({ "printers": data.get("printers").cloned().unwrap_or(serde_json::json!([])) }))
}

#[tauri::command]
fn hw_print(
    app: tauri::AppHandle,
    sidecar: State<'_, SidecarState>,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let _ = ensure_sidecar(&app, &sidecar);
    agent_post("/print", payload)
}

#[tauri::command]
fn hw_drawer(
    app: tauri::AppHandle,
    sidecar: State<'_, SidecarState>,
) -> Result<serde_json::Value, String> {
    let _ = ensure_sidecar(&app, &sidecar);
    agent_post("/drawer", serde_json::json!({}))
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
        .manage(SidecarState {
            child: Mutex::new(None),
        })
        .manage(WindowModeState {
            mode: Mutex::new("maximized".to_string()),
        })
        .invoke_handler(tauri::generate_handler![
            pos_env,
            set_start_with_windows,
            is_start_with_windows,
            desktop_reload,
            desktop_window_mode,
            desktop_toggle_window_mode,
            sidecar_health,
            hw_agent_status,
            hw_list_printers,
            hw_print,
            hw_drawer
        ])
        .setup(|app| {
            if app.get_webview_window("main").is_some() {
                return Ok(());
            }
            let start = pos_start_url();
            let parsed = Url::parse(&start).unwrap_or_else(|_| {
                Url::parse("https://app.chaslay.com/login").expect("static url")
            });
            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(parsed))
                .title("Chaslay POS")
                .fullscreen(false)
                .maximized(true)
                .decorations(false)
                .resizable(true)
                .visible(true)
                .on_navigation(|url| is_allowed_navigation(&url))
                .build()?;
            let _ = win.set_focus();

            if let Some(sidecar) = app.try_state::<SidecarState>() {
                let _ = ensure_sidecar(&app.handle(), &sidecar);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start Chaslay POS");
}

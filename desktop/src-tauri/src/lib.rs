mod hardware;

use std::path::PathBuf;
use std::process::Child;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use std::process::{Command, Stdio};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
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

struct HwPathState {
    printers: Mutex<String>,
    print: Mutex<String>,
    drawer: Mutex<String>,
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

fn sidecar_exe_candidates(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            out.push(dir.join("reborn-print-agent.exe"));
            out.push(dir.join("reborn-print-agent-x86_64-pc-windows-msvc.exe"));
        }
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        out.push(resource_dir.join("reborn-print-agent.exe"));
        out.push(resource_dir.join("reborn-print-agent-x86_64-pc-windows-msvc.exe"));
    }
    if let Ok(appdata) = std::env::var("LOCALAPPDATA") {
        out.push(
            PathBuf::from(appdata)
                .join("RebornPrintAgent")
                .join("reborn-print-agent.exe"),
        );
    }
    out
}

fn sidecar_binary_present(app: &tauri::AppHandle) -> bool {
    sidecar_exe_candidates(app)
        .iter()
        .any(|path| path.is_file())
}

#[cfg_attr(not(target_os = "windows"), allow(unused_variables))]
fn spawn_sidecar_process(app: &tauri::AppHandle) -> Result<Child, String> {
    #[cfg(target_os = "windows")]
    {
        for exe in sidecar_exe_candidates(app) {
            if exe.is_file() {
                return Command::new(exe)
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .creation_flags(CREATE_NO_WINDOW)
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

fn decode_base64_payload(value: &serde_json::Value) -> Result<Vec<u8>, String> {
    let raw = value
        .get("dataBase64")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "dataBase64 is required".to_string())?;
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(raw)
        .map_err(|e| e.to_string())
}

fn decode_payload_string(payload: &str) -> Result<Vec<u8>, String> {
    let trimmed = payload.trim();
    if trimmed.is_empty() {
        return Err("payload is empty".to_string());
    }
    use base64::Engine;
    if base64::engine::general_purpose::STANDARD
        .decode(trimmed.as_bytes())
        .is_ok()
    {
        return base64::engine::general_purpose::STANDARD
            .decode(trimmed)
            .map_err(|e| e.to_string());
    }
    Ok(trimmed.as_bytes().to_vec())
}

fn printer_name_from_payload(value: &serde_json::Value) -> Option<String> {
    value
        .get("printerName")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

fn port_name_from_payload(value: &serde_json::Value) -> Option<String> {
    value
        .get("portName")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

fn baud_rate_from_payload(value: &serde_json::Value) -> u32 {
    value
        .get("baudRate")
        .and_then(|v| v.as_u64())
        .map(|v| v as u32)
        .unwrap_or(9600)
}

fn merge_serial_printers(
    mut printers: Vec<serde_json::Value>,
) -> Result<Vec<serde_json::Value>, String> {
    let serial = hardware::try_list_serial_ports().unwrap_or_default();
    let existing_ports: std::collections::HashSet<String> = printers
        .iter()
        .filter_map(|p| {
            p.get("portName")
                .and_then(|v| v.as_str())
                .map(|s| s.to_ascii_uppercase())
        })
        .collect();
    for entry in serial {
        let port = entry
            .get("portName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_ascii_uppercase();
        if port.is_empty() || existing_ports.contains(&port) {
            continue;
        }
        printers.push(entry);
    }
    Ok(printers)
}

fn record_hw_path(state: &HwPathState, kind: &str, path: &str) {
    let guard = match kind {
        "printers" => state.printers.lock(),
        "print" => state.print.lock(),
        "drawer" => state.drawer.lock(),
        _ => return,
    };
    if let Ok(mut slot) = guard {
        *slot = path.to_string();
    }
}

#[tauri::command]
fn pos_env() -> serde_json::Value {
    serde_json::json!({
        "shell": "tauri",
        "version": env!("CARGO_PKG_VERSION"),
        "debug": cfg!(debug_assertions),
        "chromeMinimize": true,
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
fn desktop_minimize(app: tauri::AppHandle) -> Result<(), String> {
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    win.minimize().map_err(|e| e.to_string())
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
        if *guard == "fullscreen" {
            "normal".to_string()
        } else {
            "fullscreen".to_string()
        }
    };
    if next == "fullscreen" {
        let _ = win.unmaximize();
        let _ = win.set_fullscreen(true);
        let _ = win.show();
        let _ = win.set_focus();
    } else {
        let _ = win.set_fullscreen(false);
        let _ = win.unmaximize();
        let _ = win.show();
        let _ = win.set_focus();
    }
    {
        let mut guard = window_mode.mode.lock().map_err(|e| e.to_string())?;
        *guard = next.clone();
    }
    Ok(next)
}

fn sidecar_health_response(app: &tauri::AppHandle) -> serde_json::Value {
    match agent_get("/health") {
        Ok(data) => serde_json::json!({
            "ok": data.get("ok").and_then(|v| v.as_bool()) == Some(true),
            "version": data.get("version").and_then(|v| v.as_str()),
            "port": 9101,
            "bundled": sidecar_binary_present(app),
        }),
        Err(err) => serde_json::json!({
            "ok": false,
            "error": err,
            "port": 9101,
            "bundled": sidecar_binary_present(app),
        }),
    }
}

/// Probe 127.0.0.1:9101 without spawning the bundled sidecar (status UI only).
#[tauri::command]
fn sidecar_health(app: tauri::AppHandle, _sidecar: State<'_, SidecarState>) -> serde_json::Value {
    sidecar_health_response(&app)
}

/// Lazy-start the bundled Print Agent when native Win32/COM paths are unavailable.
#[tauri::command]
fn ensure_print_agent_sidecar(
    app: tauri::AppHandle,
    sidecar: State<'_, SidecarState>,
) -> serde_json::Value {
    if let Err(err) = ensure_sidecar(&app, &sidecar) {
        return serde_json::json!({
            "ok": false,
            "error": err,
            "port": 9101,
            "bundled": sidecar_binary_present(&app),
        });
    }
    sidecar_health_response(&app)
}

#[tauri::command]
fn get_available_printers() -> Result<serde_json::Value, String> {
    let ports = hardware::try_list_serial_port_names()?;
    Ok(serde_json::json!({ "ports": ports, "source": "native-serial" }))
}

#[tauri::command]
fn print_to_thermal_device(
    port_name: String,
    baud_rate: u32,
    payload: String,
) -> Result<serde_json::Value, String> {
    let bytes = decode_payload_string(&payload)?;
    let used = hardware::try_serial_print(&port_name, baud_rate, &bytes)?;
    Ok(serde_json::json!({ "ok": true, "port": used, "source": "native-serial" }))
}

#[tauri::command]
fn hw_capabilities(app: tauri::AppHandle, hw_paths: State<'_, HwPathState>) -> serde_json::Value {
    let printers = hw_paths.printers.lock().map(|g| g.clone()).unwrap_or_default();
    let print = hw_paths.print.lock().map(|g| g.clone()).unwrap_or_default();
    let drawer = hw_paths.drawer.lock().map(|g| g.clone()).unwrap_or_default();
    serde_json::json!({
        "nativePrint": hardware::native_print_available(),
        "nativeSerial": hardware::native_serial_available(),
        "sidecarBundled": sidecar_binary_present(&app),
        "paths": {
            "printers": if printers.is_empty() { "auto" } else { printers.as_str() },
            "print": if print.is_empty() { "auto" } else { print.as_str() },
            "drawer": if drawer.is_empty() { "auto" } else { drawer.as_str() },
        }
    })
}

#[tauri::command]
fn hw_agent_status(
    app: tauri::AppHandle,
    sidecar: State<'_, SidecarState>,
) -> Result<serde_json::Value, String> {
    if hardware::native_print_available() || hardware::native_serial_available() {
        return Ok(serde_json::json!({
            "running": true,
            "port": 0,
            "version": env!("CARGO_PKG_VERSION"),
            "bundled": false,
            "source": "native"
        }));
    }
    let _ = ensure_sidecar(&app, &sidecar);
    let data = agent_get("/health")?;
    Ok(serde_json::json!({
        "running": data.get("ok").and_then(|v| v.as_bool()) == Some(true),
        "port": 9101,
        "version": data.get("version").and_then(|v| v.as_str()),
        "bundled": sidecar_binary_present(&app),
        "source": "sidecar"
    }))
}

#[tauri::command]
fn hw_list_printers(
    app: tauri::AppHandle,
    sidecar: State<'_, SidecarState>,
    hw_paths: State<'_, HwPathState>,
) -> Result<serde_json::Value, String> {
    if hardware::native_print_available() {
        match hardware::try_list_printers() {
            Ok(printers) if !printers.is_empty() => {
                record_hw_path(&hw_paths, "printers", "native");
                let merged = merge_serial_printers(printers)?;
                return Ok(serde_json::json!({ "printers": merged, "source": "native" }));
            }
            Ok(_) => {}
            Err(_) => {}
        }
    }
    if hardware::native_serial_available() {
        match hardware::try_list_serial_ports() {
            Ok(printers) if !printers.is_empty() => {
                record_hw_path(&hw_paths, "printers", "native-serial");
                return Ok(serde_json::json!({ "printers": printers, "source": "native-serial" }));
            }
            Ok(_) => {}
            Err(_) => {}
        }
    }
    let _ = ensure_sidecar(&app, &sidecar);
    let data = agent_get("/printers")?;
    record_hw_path(&hw_paths, "printers", "sidecar");
    Ok(serde_json::json!({
        "printers": data.get("printers").cloned().unwrap_or(serde_json::json!([])),
        "source": "sidecar"
    }))
}

#[tauri::command]
fn hw_print(
    app: tauri::AppHandle,
    sidecar: State<'_, SidecarState>,
    hw_paths: State<'_, HwPathState>,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let bytes = decode_base64_payload(&payload)?;
    let printer = printer_name_from_payload(&payload);
    let port_hint = port_name_from_payload(&payload);
    let baud = baud_rate_from_payload(&payload);

    if hardware::native_print_available() {
        if let Some(name) = printer.as_deref() {
            match hardware::try_raw_print(name, &bytes, false) {
                Ok(used) => {
                    record_hw_path(&hw_paths, "print", "native");
                    return Ok(serde_json::json!({ "ok": true, "printer": used, "source": "native" }));
                }
                Err(_) => {}
            }
        }
    }

    if hardware::native_serial_available() {
        let com = hardware::resolve_com_port_for_print(
            printer.as_deref(),
            port_hint.as_deref(),
        );
        if let Some(port) = com {
            match hardware::try_serial_print(&port, baud, &bytes) {
                Ok(used) => {
                    record_hw_path(&hw_paths, "print", "native-serial");
                    return Ok(serde_json::json!({ "ok": true, "printer": used, "source": "native-serial" }));
                }
                Err(_) => {}
            }
        }
    }

    let _ = ensure_sidecar(&app, &sidecar);
    record_hw_path(&hw_paths, "print", "sidecar");
    let result = agent_post("/print", payload)?;
    Ok(serde_json::json!({
        "ok": result.get("ok").and_then(|v| v.as_bool()).unwrap_or(true),
        "printer": result.get("printer").cloned(),
        "error": result.get("error").cloned(),
        "source": "sidecar"
    }))
}

#[tauri::command]
fn hw_drawer(
    app: tauri::AppHandle,
    sidecar: State<'_, SidecarState>,
    hw_paths: State<'_, HwPathState>,
    printer_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let kick = [0x1b, 0x70, 0x00, 0x19, 0xfa];

    if hardware::native_print_available() {
        match hardware::try_drawer_kick(printer_name.as_deref()) {
            Ok(used) => {
                record_hw_path(&hw_paths, "drawer", "native");
                return Ok(serde_json::json!({ "ok": true, "printer": used, "source": "native" }));
            }
            Err(_) => {}
        }
    }

    if hardware::native_serial_available() {
        if let Some(port) =
            hardware::resolve_com_port_for_print(printer_name.as_deref(), None)
        {
            match hardware::try_serial_print(&port, 9600, &kick) {
                Ok(used) => {
                    record_hw_path(&hw_paths, "drawer", "native-serial");
                    return Ok(serde_json::json!({ "ok": true, "printer": used, "source": "native-serial" }));
                }
                Err(_) => {}
            }
        }
    }

    let _ = ensure_sidecar(&app, &sidecar);
    record_hw_path(&hw_paths, "drawer", "sidecar");
    let body = match printer_name {
        Some(name) if !name.trim().is_empty() => serde_json::json!({ "printerName": name.trim() }),
        _ => serde_json::json!({}),
    };
    let result = agent_post("/drawer", body)?;
    Ok(serde_json::json!({
        "ok": result.get("ok").and_then(|v| v.as_bool()).unwrap_or(true),
        "source": "sidecar"
    }))
}

#[tauri::command]
fn hw_scale_ports(
    app: tauri::AppHandle,
    sidecar: State<'_, SidecarState>,
) -> Result<serde_json::Value, String> {
    if hardware::native_serial_available() {
        match hardware::try_list_scale_devices() {
            Ok(entries) if !entries.is_empty() => {
                let ports: Vec<String> = entries
                    .iter()
                    .filter_map(|e| {
                        e.get("port")
                            .or_else(|| e.get("portName"))
                            .or_else(|| e.get("name"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect();
                return Ok(serde_json::json!({
                    "ports": ports,
                    "devices": entries,
                    "source": "native-serial"
                }));
            }
            Ok(_) => {}
            Err(_) => {}
        }
    }
    let _ = ensure_sidecar(&app, &sidecar);
    let data = agent_get("/scale/ports")?;
    Ok(serde_json::json!({
        "ports": data.get("ports").cloned().unwrap_or(serde_json::json!([])),
        "devices": data.get("devices").cloned().unwrap_or(serde_json::json!([])),
        "source": "sidecar"
    }))
}

#[tauri::command]
fn hw_scale_reading(
    app: tauri::AppHandle,
    sidecar: State<'_, SidecarState>,
    port: String,
    timeout_ms: Option<u64>,
) -> Result<serde_json::Value, String> {
    let timeout = timeout_ms.unwrap_or(2500);
    if hardware::native_serial_available() {
        match hardware::try_read_scale(&port, timeout) {
            Ok(result) => {
                return Ok(serde_json::json!({
                    "reading": result.get("reading").cloned(),
                    "message": result.get("message").cloned(),
                    "resolvedPort": result.get("resolvedPort").cloned(),
                    "source": "native-serial"
                }));
            }
            Err(_) => {}
        }
    }
    let _ = ensure_sidecar(&app, &sidecar);
    let path = format!(
        "/scale/reading?port={}&timeoutMs={}",
        urlencoding::encode(&port),
        timeout
    );
    let data = agent_get(&path)?;
    Ok(serde_json::json!({
        "reading": data.get("reading").cloned(),
        "message": data.get("message").cloned(),
        "source": "sidecar"
    }))
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
            mode: Mutex::new("fullscreen".to_string()),
        })
        .manage(HwPathState {
            printers: Mutex::new(String::new()),
            print: Mutex::new(String::new()),
            drawer: Mutex::new(String::new()),
        })
        .invoke_handler(tauri::generate_handler![
            pos_env,
            set_start_with_windows,
            is_start_with_windows,
            desktop_reload,
            desktop_window_mode,
            desktop_minimize,
            desktop_toggle_window_mode,
            sidecar_health,
            ensure_print_agent_sidecar,
            get_available_printers,
            print_to_thermal_device,
            hw_capabilities,
            hw_agent_status,
            hw_list_printers,
            hw_print,
            hw_drawer,
            hw_scale_ports,
            hw_scale_reading
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
                .title("RebornPOS")
                .fullscreen(true)
                .maximized(true)
                .decorations(false)
                .resizable(true)
                .visible(true)
                .on_navigation(|url| is_allowed_navigation(&url))
                .build()?;
            let _ = win.set_fullscreen(true);
            let _ = win.set_focus();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start RebornPOS");
}

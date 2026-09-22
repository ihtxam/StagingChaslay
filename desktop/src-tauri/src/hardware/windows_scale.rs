use std::path::PathBuf;
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn hide_console(cmd: &mut Command) {
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
}

fn powershell_command() -> Command {
    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-ExecutionPolicy",
        "Bypass",
    ]);
    hide_console(&mut cmd);
    cmd
}

fn resolve_scale_script() -> Option<PathBuf> {
    let candidates = [
        "win-scale-read.ps1",
        "resources/win-scale-read.ps1",
        "resources\\win-scale-read.ps1",
    ];
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for name in candidates {
                let path = dir.join(name);
                if path.is_file() {
                    return Some(path);
                }
            }
        }
    }
    if let Ok(manifest) = std::env::var("CARGO_MANIFEST_DIR") {
        let base = PathBuf::from(manifest);
        for rel in [
            "resources/win-scale-read.ps1",
            "../print-agent/win-scale-read.ps1",
        ] {
            let path = base.join(rel);
            if path.is_file() {
                return Some(path);
            }
        }
    }
    None
}

fn run_scale_script(args: &[&str]) -> Result<serde_json::Value, String> {
    let script = resolve_scale_script()
        .ok_or_else(|| "win-scale-read.ps1 not found next to RebornPOS executable".to_string())?;
    let mut cmd = powershell_command();
    cmd.arg("-File").arg(&script);
    for arg in args {
        cmd.arg(arg);
    }
    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "scale script failed: {}{}",
            stderr.trim(),
            if stdout.trim().is_empty() {
                String::new()
            } else {
                format!(" ({})", stdout.trim())
            }
        ));
    }
    let stdout_owned = String::from_utf8_lossy(&output.stdout);
    let stdout = stdout_owned.trim();
    if stdout.is_empty() {
        return Ok(serde_json::json!({}));
    }
    serde_json::from_str(stdout).map_err(|e| format!("invalid scale script json: {e}; raw={stdout}"))
}

pub fn list_scale_devices() -> Result<Vec<serde_json::Value>, String> {
    let parsed = run_scale_script(&["-ListPorts"])?;
    let devices = parsed
        .get("devices")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(devices)
}

pub fn read_scale_via_script(
    port: &str,
    timeout_ms: u64,
) -> Result<serde_json::Value, String> {
    let parsed = run_scale_script(&[
        "-PortName",
        port,
        "-TimeoutMs",
        &timeout_ms.to_string(),
    ])?;
    if parsed.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        return Err(parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Scale read failed")
            .to_string());
    }
    use base64::Engine;
    let bytes = parsed
        .get("dataBase64")
        .and_then(|v| v.as_str())
        .and_then(|b64| base64::engine::general_purpose::STANDARD.decode(b64).ok())
        .unwrap_or_default();
    let reading = super::scale::find_latest_reading(&bytes);
    Ok(serde_json::json!({
        "reading": reading,
        "message": if reading.is_some() { serde_json::Value::Null } else { serde_json::json!("No stable frame yet — place item on scale") },
        "resolvedPort": parsed.get("resolvedPort").cloned().or_else(|| parsed.get("port").cloned()),
    }))
}

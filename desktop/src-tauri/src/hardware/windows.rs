use std::path::PathBuf;
use std::process::Command;

fn powershell_json(script: &str) -> Result<serde_json::Value, String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "powershell failed: {}{}",
            stderr.trim(),
            if stdout.trim().is_empty() {
                String::new()
            } else {
                format!(" ({})", stdout.trim())
            }
        ));
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim();
    if stdout.is_empty() {
        return Ok(serde_json::json!([]));
    }
    serde_json::from_str(stdout).map_err(|e| format!("invalid powershell json: {e}; raw={stdout}"))
}

pub fn list_printers() -> Result<Vec<serde_json::Value>, String> {
    let data = powershell_json(
        r#"
        $items = Get-CimInstance Win32_Printer | ForEach-Object {
            @{
                name = [string]$_.Name
                portName = [string]$_.PortName
                driverName = [string]$_.DriverName
                isDefault = ($_.Default -eq $true)
                status = [string]$_.PrinterStatus
            }
        }
        if ($null -eq $items) { '[]' } elseif ($items -is [System.Array]) { $items | ConvertTo-Json -Compress } else { @($items) | ConvertTo-Json -Compress }
        "#,
    )?;
    match data {
        serde_json::Value::Array(items) => Ok(items),
        serde_json::Value::Object(_) => Ok(vec![data]),
        _ => Ok(vec![]),
    }
}

fn resolve_raw_print_script() -> Option<PathBuf> {
    let candidates = [
        "win-raw-print.ps1",
        "resources/win-raw-print.ps1",
        "resources\\win-raw-print.ps1",
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
        for rel in ["resources/win-raw-print.ps1", "../print-agent/win-raw-print.ps1"] {
            let path = base.join(rel);
            if path.is_file() {
                return Some(path);
            }
        }
    }
    None
}

pub fn raw_print(printer_name: &str, data: &[u8], drawer_kick: bool) -> Result<String, String> {
    let script = resolve_raw_print_script().ok_or_else(|| {
        "win-raw-print.ps1 not found next to Chaslay POS executable".to_string()
    })?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_dir = std::env::temp_dir();
    let data_path = temp_dir.join(format!("chaslay-native-print-{stamp}.bin"));
    let name_path = temp_dir.join(format!("chaslay-native-printer-{stamp}.txt"));
    std::fs::write(&data_path, data).map_err(|e| e.to_string())?;
    std::fs::write(&name_path, printer_name).map_err(|e| e.to_string())?;

    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script.to_string_lossy().as_ref(),
        "-FilePath",
        data_path.to_string_lossy().as_ref(),
        "-PrinterNameFile",
        name_path.to_string_lossy().as_ref(),
    ]);
    if drawer_kick {
        cmd.arg("-DrawerKick");
    }
    let output = cmd.output().map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&data_path);
    let _ = std::fs::remove_file(&name_path);
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "{}{}",
            stderr.trim(),
            if stdout.trim().is_empty() {
                String::new()
            } else {
                format!(" ({})", stdout.trim())
            }
        ));
    }
    Ok(printer_name.to_string())
}

pub fn drawer_kick(printer_name: Option<&str>) -> Result<String, String> {
    let bytes = [0x1b, 0x70, 0x00, 0x19, 0xfa];
    let name = match printer_name {
        Some(n) if !n.trim().is_empty() => n.trim(),
        _ => default_printer_name()?,
    };
    raw_print(name, &bytes, true)
}

fn default_printer_name() -> Result<String, String> {
    let data = powershell_json(
        r#"
        $p = Get-CimInstance Win32_Printer -Filter "Default='True'" -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $p) { throw 'No default printer configured in Windows.' }
        [string]$p.Name
        "#,
    )?;
    match data {
        serde_json::Value::String(name) => Ok(name),
        _ => Err("No default printer configured in Windows.".to_string()),
    }
}

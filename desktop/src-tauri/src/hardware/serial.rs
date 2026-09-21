use std::io::Write;
use std::time::Duration;

const DEFAULT_BAUD: u32 = 9600;

fn normalize_com_port(port_name: &str) -> String {
    let raw = port_name.trim();
    let stripped = raw.trim_start_matches(r"\\.\");
    let upper = stripped.to_ascii_uppercase();
    if upper.starts_with("COM") {
        let digits = &upper[3..];
        if !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit()) {
            return format!("COM{}", digits.parse::<u32>().unwrap_or(0));
        }
    }
    raw.to_string()
}

fn open_path_for_com(port_name: &str) -> String {
    let com = normalize_com_port(port_name);
    let upper = com.to_ascii_uppercase();
    if upper.starts_with("COM") {
        let digits = &upper[3..];
        if let Ok(num) = digits.parse::<u32>() {
            if num >= 10 {
                return format!(r"\\.\{}", com);
            }
        }
    }
    com
}

pub fn list_serial_ports() -> Result<Vec<serde_json::Value>, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    Ok(ports
        .into_iter()
        .map(|p| {
            let port_type = match p.port_type {
                serialport::SerialPortType::UsbPort(info) => serde_json::json!({
                    "kind": "usb",
                    "vid": info.vid,
                    "pid": info.pid,
                    "serialNumber": info.serial_number,
                    "manufacturer": info.manufacturer,
                    "product": info.product,
                }),
                serialport::SerialPortType::BluetoothPort => {
                    serde_json::json!({ "kind": "bluetooth" })
                }
                serialport::SerialPortType::PciPort => serde_json::json!({ "kind": "pci" }),
                serialport::SerialPortType::Unknown => serde_json::json!({ "kind": "unknown" }),
            };
            let name = normalize_com_port(&p.port_name);
            serde_json::json!({
                "name": name,
                "portName": name,
                "portType": port_type,
            })
        })
        .collect())
}

pub fn list_serial_port_names() -> Result<Vec<String>, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    Ok(ports
        .into_iter()
        .map(|p| normalize_com_port(&p.port_name))
        .collect())
}

pub fn open_com_port(
    port_name: &str,
    baud_rate: u32,
) -> Result<Box<dyn serialport::SerialPort>, String> {
    let open_name = open_path_for_com(port_name);
    let baud = if baud_rate == 0 { DEFAULT_BAUD } else { baud_rate };
    serialport::new(&open_name, baud)
        .timeout(Duration::from_secs(5))
        .open()
        .map_err(|e| format!("Failed to open {}: {e}", normalize_com_port(port_name)))
}

pub fn print_raw_to_port(port_name: &str, baud_rate: u32, data: &[u8]) -> Result<String, String> {
    let mut port = open_com_port(port_name, baud_rate)?;
    port.write_all(data).map_err(|e| e.to_string())?;
    port.flush().map_err(|e| e.to_string())?;
    Ok(normalize_com_port(port_name))
}

pub fn extract_com_port_from_name(name: &str) -> Option<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return None;
    }
    let direct = normalize_com_port(trimmed);
    if direct.to_ascii_uppercase().starts_with("COM") {
        return Some(direct);
    }
    let upper = trimmed.to_ascii_uppercase();
    if let Some(start) = upper.rfind("(COM") {
        let slice = &upper[start + 1..];
        if let Some(end) = slice.find(')') {
            let com = normalize_com_port(&slice[..end]);
            if com.to_ascii_uppercase().starts_with("COM") {
                return Some(com);
            }
        }
    }
    None
}

pub fn resolve_com_port_for_print(
    printer_name: Option<&str>,
    port_name: Option<&str>,
) -> Option<String> {
    if let Some(port) = port_name {
        let com = extract_com_port_from_name(port);
        if com.is_some() {
            return com;
        }
    }
    printer_name.and_then(extract_com_port_from_name)
}

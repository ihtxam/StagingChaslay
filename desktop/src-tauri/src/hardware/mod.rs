#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
mod windows_scale;

mod scale;
mod serial;

pub fn native_print_available() -> bool {
    cfg!(target_os = "windows")
}

pub fn native_serial_available() -> bool {
    true
}

pub fn try_list_serial_ports() -> Result<Vec<serde_json::Value>, String> {
    serial::list_serial_ports()
}

pub fn try_list_serial_port_names() -> Result<Vec<String>, String> {
    serial::list_serial_port_names()
}

pub fn try_serial_print(port_name: &str, baud_rate: u32, data: &[u8]) -> Result<String, String> {
    serial::print_raw_to_port(port_name, baud_rate, data)
}

pub fn resolve_com_port_for_print(
    printer_name: Option<&str>,
    port_name: Option<&str>,
) -> Option<String> {
    serial::resolve_com_port_for_print(printer_name, port_name)
}

pub fn try_list_printers() -> Result<Vec<serde_json::Value>, String> {
    #[cfg(target_os = "windows")]
    {
        return windows::list_printers();
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("native printer listing is only available on Windows".to_string())
    }
}

pub fn try_raw_print(
    printer_name: &str,
    data: &[u8],
    drawer_kick: bool,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        return windows::raw_print(printer_name, data, drawer_kick);
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("native raw print is only available on Windows".to_string())
    }
}

pub fn try_drawer_kick(printer_name: Option<&str>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        return windows::drawer_kick(printer_name);
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("native cash drawer kick is only available on Windows".to_string())
    }
}

pub fn try_list_scale_devices() -> Result<Vec<serde_json::Value>, String> {
    #[cfg(target_os = "windows")]
    {
        match windows_scale::list_scale_devices() {
            Ok(devices) if !devices.is_empty() => return Ok(devices),
            Ok(_) => {}
            Err(_) => {}
        }
    }
    try_list_serial_ports()
}

pub fn try_read_scale(port: &str, timeout_ms: u64) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    {
        match windows_scale::read_scale_via_script(port, timeout_ms) {
            Ok(result) => return Ok(result),
            Err(_) => {}
        }
    }
    scale::read_scale_from_port(port, timeout_ms)
}

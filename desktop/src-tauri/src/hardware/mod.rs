#[cfg(target_os = "windows")]
mod windows;

pub fn native_print_available() -> bool {
    cfg!(target_os = "windows")
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

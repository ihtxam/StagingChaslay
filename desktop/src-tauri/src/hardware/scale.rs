use std::time::{Duration, Instant};

use super::serial;

const SOH: u8 = 0x01;
const STX: u8 = 0x02;
const ETX: u8 = 0x03;
const EOT: u8 = 0x04;
const FRAME_SIZE: usize = 16;

fn calculate_bcc(frame: &[u8]) -> u8 {
    let mut bcc = 0u8;
    for i in 0..12 {
        bcc ^= frame[i];
    }
    bcc ^ ETX
}

fn normalize_to_kg(value: f64, units: &str) -> f64 {
    match units.trim().to_ascii_uppercase().as_str() {
        "KG" | "K" => value,
        "G" => value / 1000.0,
        "LB" => value * 0.453_592_37,
        "OZ" => value * 0.028_349_523_1,
        _ => value,
    }
}

fn parse_frame(frame: &[u8]) -> Option<serde_json::Value> {
    if frame.len() < FRAME_SIZE {
        return None;
    }
    if frame[0] != SOH || frame[1] != STX || frame[13] != ETX || frame[14] != EOT {
        return None;
    }
    if calculate_bcc(frame) != frame[12] {
        return None;
    }

    let status_byte = frame[2];
    let sign_byte = frame[3];
    let weight_raw = String::from_utf8_lossy(&frame[4..10]).trim().to_string();
    let units = String::from_utf8_lossy(&frame[10..12]).trim().to_string();
    let status2 = frame[15];

    let status = match status_byte {
        0x53 => "STABLE",
        0x55 => "UNSTABLE",
        0x46 => "OVERLOAD",
        _ => "UNKNOWN",
    };

    let numeric = weight_raw.replace(' ', "").parse::<f64>();
    let numeric = match numeric {
        Ok(v) if v.is_finite() => v,
        _ => return None,
    };
    let signed = if sign_byte == 0x2d { -numeric } else { numeric };
    let weight_kg = normalize_to_kg(signed, &units);

    Some(serde_json::json!({
        "weightKg": weight_kg,
        "rawWeight": weight_raw,
        "units": units,
        "status": status,
        "isZero": status2 == 0x10,
        "isTare": status2 == 0x20,
    }))
}

pub fn find_latest_reading(buffer: &[u8]) -> Option<serde_json::Value> {
    if buffer.len() < FRAME_SIZE {
        return None;
    }
    let mut latest = None;
    let mut index = 0usize;
    while index + FRAME_SIZE <= buffer.len() {
        if buffer[index] == SOH && buffer[index + 1] == STX {
            latest = parse_frame(&buffer[index..index + FRAME_SIZE]).or(latest);
            index += FRAME_SIZE;
        } else {
            index += 1;
        }
    }
    latest
}

pub fn read_scale_from_port(port_name: &str, timeout_ms: u64) -> Result<serde_json::Value, String> {
    use std::io::Read;

    let timeout = Duration::from_millis(timeout_ms.clamp(300, 5000));
    let mut port = serial::open_com_port(port_name, 9600)?;
    port.set_timeout(Duration::from_millis(200))
        .map_err(|e| e.to_string())?;

    let mut chunks: Vec<u8> = Vec::new();
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        let mut buf = [0u8; 256];
        match port.read(&mut buf) {
            Ok(0) => std::thread::sleep(Duration::from_millis(40)),
            Ok(n) => chunks.extend_from_slice(&buf[..n]),
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => {
                std::thread::sleep(Duration::from_millis(40));
            }
            Err(e) => return Err(format!("Failed to read {}: {e}", port_name)),
        }
    }

    let reading = find_latest_reading(&chunks);
    Ok(serde_json::json!({
        "reading": reading,
        "message": if reading.is_some() { serde_json::Value::Null } else { serde_json::json!("No stable frame yet — place item on scale") },
        "resolvedPort": serial::normalize_com_port(port_name),
        "bytes": chunks.len(),
    }))
}

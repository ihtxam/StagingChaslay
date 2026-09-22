use std::path::Path;

fn ensure_sidecar_stub(manifest_dir: &Path) {
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("windows") {
        return;
    }
    let binaries = manifest_dir.join("binaries");
    std::fs::create_dir_all(&binaries).ok();
    let stub = binaries.join(format!("reborn-print-agent-{target}"));
    if stub.is_file() {
        return;
    }
    std::fs::write(&stub, b"#!/bin/sh\nexit 0\n").ok();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(&stub) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(&stub, perms);
        }
    }
}

fn main() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let resources_dir = manifest_dir.join("resources");
    std::fs::create_dir_all(&resources_dir).ok();
    for (src_name, dst_name) in [
        ("win-raw-print.ps1", "win-raw-print.ps1"),
        ("win-scale-read.ps1", "win-scale-read.ps1"),
    ] {
        let ps1_src = manifest_dir.join("../print-agent").join(src_name);
        if ps1_src.is_file() {
            let _ = std::fs::copy(&ps1_src, resources_dir.join(dst_name));
        }
    }
    ensure_sidecar_stub(manifest_dir);

    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "pos_env",
                "set_start_with_windows",
                "is_start_with_windows",
                "desktop_reload",
                "desktop_window_mode",
                "desktop_minimize",
                "desktop_toggle_window_mode",
                "sidecar_health",
                "ensure_print_agent_sidecar",
                "hw_capabilities",
                "hw_agent_status",
                "hw_list_printers",
                "hw_print",
                "hw_drawer",
                "hw_scale_ports",
                "hw_scale_reading",
            ]),
        ),
    )
    .expect("failed to run tauri build");
}

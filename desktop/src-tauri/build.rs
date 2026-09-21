fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "pos_env",
                "set_start_with_windows",
                "is_start_with_windows",
                "desktop_reload",
                "desktop_window_mode",
                "desktop_toggle_window_mode",
                "sidecar_health",
                "hw_agent_status",
                "hw_list_printers",
                "hw_print",
                "hw_drawer",
            ]),
        ),
    )
    .expect("failed to run tauri build");
}

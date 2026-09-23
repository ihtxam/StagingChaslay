use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_updater::UpdaterExt;

pub struct PendingUpdate(pub Mutex<Option<tauri_plugin_updater::Update>>);

pub struct DownloadedBytes(pub Mutex<Option<Vec<u8>>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub current_version: String,
    pub notes: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdateProgress {
    pub phase: &'static str,
    pub downloaded: u64,
    pub content_length: Option<u64>,
}

pub struct DownloadProgress {
    downloaded: Mutex<u64>,
    content_length: Mutex<Option<u64>>,
    ready: Mutex<bool>,
}

impl DownloadProgress {
    pub fn new() -> Self {
        Self {
            downloaded: Mutex::new(0),
            content_length: Mutex::new(None),
            ready: Mutex::new(false),
        }
    }

    pub fn reset(&self) {
        if let Ok(mut downloaded) = self.downloaded.lock() {
            *downloaded = 0;
        }
        if let Ok(mut content_length) = self.content_length.lock() {
            *content_length = None;
        }
        if let Ok(mut ready) = self.ready.lock() {
            *ready = false;
        }
    }

    pub fn mark_ready(&self) {
        if let Ok(mut ready) = self.ready.lock() {
            *ready = true;
        }
    }

    pub fn is_ready(&self) -> bool {
        self.ready.lock().map(|ready| *ready).unwrap_or(false)
    }

    pub fn snapshot(&self) -> DesktopUpdateProgress {
        DesktopUpdateProgress {
            phase: if self.is_ready() {
                "ready"
            } else {
                "downloading"
            },
            downloaded: self.downloaded.lock().map(|v| *v).unwrap_or(0),
            content_length: self.content_length.lock().ok().and_then(|v| *v),
        }
    }
}

fn track_chunk(progress: &DownloadProgress, chunk_length: usize, content_length: Option<u64>) {
    if let Ok(mut downloaded) = progress.downloaded.lock() {
        *downloaded += chunk_length as u64;
    }
    if content_length.is_some() {
        if let Ok(mut total) = progress.content_length.lock() {
            *total = content_length;
        }
    }
}

#[tauri::command]
pub async fn desktop_check_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
    downloaded: State<'_, DownloadedBytes>,
    progress: State<'_, DownloadProgress>,
) -> Result<DesktopUpdateInfo, String> {
    progress.reset();
    *downloaded.0.lock().map_err(|e| e.to_string())? = None;

    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => {
            let info = DesktopUpdateInfo {
                available: true,
                version: Some(update.version.clone()),
                current_version: update.current_version.clone(),
                notes: update.body.clone(),
            };
            *pending.0.lock().map_err(|e| e.to_string())? = Some(update);
            Ok(info)
        }
        Ok(None) => Ok(DesktopUpdateInfo {
            available: false,
            version: None,
            current_version: env!("CARGO_PKG_VERSION").to_string(),
            notes: None,
        }),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
pub async fn desktop_download_update(
    pending: State<'_, PendingUpdate>,
    downloaded: State<'_, DownloadedBytes>,
    progress: State<'_, DownloadProgress>,
) -> Result<DesktopUpdateProgress, String> {
    if progress.is_ready() {
        return Ok(progress.snapshot());
    }

    let update = pending
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .as_ref()
        .ok_or_else(|| "No pending update".to_string())?
        .clone();

    let bytes = update
        .download(
            |chunk_length, content_length| track_chunk(&progress, chunk_length, content_length),
            || progress.mark_ready(),
        )
        .await
        .map_err(|e| e.to_string())?;

    *downloaded.0.lock().map_err(|e| e.to_string())? = Some(bytes);
    Ok(progress.snapshot())
}

#[tauri::command]
pub async fn desktop_apply_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
    downloaded: State<'_, DownloadedBytes>,
    progress: State<'_, DownloadProgress>,
) -> Result<(), String> {
    let update = pending
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or_else(|| "No pending update".to_string())?;

    let cached_bytes = downloaded
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .take();

    if let Some(bytes) = cached_bytes {
        update.install(bytes).map_err(|e| e.to_string())?;
    } else {
        update
            .download_and_install(
                |chunk_length, content_length| {
                    track_chunk(&progress, chunk_length, content_length)
                },
                || progress.mark_ready(),
            )
            .await
            .map_err(|e| e.to_string())?;
    }

    app.restart();
}

#[tauri::command]
pub fn desktop_update_progress(progress: State<'_, DownloadProgress>) -> DesktopUpdateProgress {
    progress.snapshot()
}

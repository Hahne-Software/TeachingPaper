//! Native PDF Export (ADR-0004): the export document is loaded into a hidden window and printed
//! to a file with the platform's WebView print-to-PDF, without a print dialog.
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc;
use std::time::Duration;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::pdf_print;

const LOAD_TIMEOUT: Duration = Duration::from_secs(30);
const FONTS_TIMEOUT: Duration = Duration::from_secs(15);
const TITLE_RESTORE_TIMEOUT: Duration = Duration::from_secs(2);
const PRINT_TIMEOUT: Duration = Duration::from_secs(120);

/// Set as the document title once `document.fonts.ready` resolved: the only signal an external page
/// can send back without IPC.
const FONTS_READY_TITLE: &str = "tp-fonts-ready";
const WAIT_FOR_FONTS: &str = "document.fonts.ready.then(() => { window.__tpTitle = document.title; document.title = 'tp-fonts-ready'; });";
const RESTORE_TITLE: &str = "document.title = window.__tpTitle;";

/// Where the export document is staged and where the printer writes before the result replaces the target.
struct Staging {
    html: PathBuf,
    printed: tempfile::TempPath,
    // Removes the staged document when the export is over, however it ended.
    _dir: tempfile::TempDir,
}

impl Staging {
    fn new(html: &str, target: &Path) -> Result<Self, String> {
        let directory = target_directory(target)?;
        let dir = tempfile::tempdir().map_err(|error| error.to_string())?;
        let html_path = dir.path().join("export.html");
        std::fs::write(&html_path, html).map_err(|error| error.to_string())?;
        // Next to the target so the final rename stays on one file system. The handle is closed:
        // Windows refuses to let the printer write into a file that is still open.
        let printed = tempfile::Builder::new()
            .prefix(".tp-export-")
            .suffix(".pdf")
            .tempfile_in(directory)
            .map_err(|error| format!("Could not write next to the target. {error}"))?
            .into_temp_path();
        Ok(Self {
            html: html_path,
            printed,
            _dir: dir,
        })
    }
}

/// The directory the PDF goes to; it must exist and the target must not be a directory.
fn target_directory(target: &Path) -> Result<&Path, String> {
    if target.is_dir() {
        return Err(format!("{} is a folder.", target.display()));
    }
    let directory = target
        .parent()
        .filter(|dir| !dir.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    if !directory.is_dir() {
        return Err(format!(
            "The folder {} does not exist.",
            directory.display()
        ));
    }
    Ok(directory)
}

/// Moves a finished print over the target, but only if it is a PDF; otherwise the target stays as it was.
fn commit_pdf(printed: tempfile::TempPath, target: &Path) -> Result<(), String> {
    let bytes = std::fs::read(&printed).map_err(|error| error.to_string())?;
    if !bytes.starts_with(b"%PDF") {
        return Err("The print produced no PDF.".into());
    }
    printed
        .persist(target)
        .map_err(|error| error.error.to_string())
}

/// Closes the hidden window when the export is over, on success and on failure.
struct HiddenWindow(WebviewWindow);

impl Drop for HiddenWindow {
    fn drop(&mut self) {
        let _ = self.0.destroy();
    }
}

static NEXT_WINDOW: AtomicU32 = AtomicU32::new(0);

/// Tauri command: prints the export document to a PDF at `path`.
#[tauri::command]
pub async fn export_pdf(app: AppHandle, html: String, path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    let staging = Staging::new(&html, &target)?;
    let url = Url::from_file_path(&staging.html).map_err(|()| "Invalid export path.")?;

    let (loaded_tx, loaded_rx) = mpsc::channel::<()>();
    let (title_tx, title_rx) = mpsc::channel::<String>();
    let label = format!("export-pdf-{}", NEXT_WINDOW.fetch_add(1, Ordering::Relaxed));
    let window = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url))
        .visible(false)
        .inner_size(794.0, 1123.0)
        .on_page_load(move |_, payload| {
            if payload.event() == PageLoadEvent::Finished {
                let _ = loaded_tx.send(());
            }
        })
        .on_document_title_changed(move |_, title| {
            let _ = title_tx.send(title);
        })
        .build()
        .map_err(|error| error.to_string())?;
    let window = HiddenWindow(window);

    // Blocking waits must not run on the async runtime that also delivers the window events.
    tauri::async_runtime::spawn_blocking(move || {
        loaded_rx
            .recv_timeout(LOAD_TIMEOUT)
            .map_err(|_| "The export document did not load.".to_string())?;
        wait_for_fonts(&window.0, &title_rx)?;
        let (done_tx, done_rx) = mpsc::channel();
        let printed = staging.printed.to_path_buf();
        window
            .0
            .with_webview(move |webview| pdf_print::print(webview, printed, done_tx))
            .map_err(|error| error.to_string())?;
        done_rx
            .recv_timeout(PRINT_TIMEOUT)
            .map_err(|_| "The print did not finish.".to_string())??;
        commit_pdf(staging.printed, &target)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Waits until the fonts of the document are loaded, then puts its `<title>` back (it becomes the PDF title).
fn wait_for_fonts(window: &WebviewWindow, titles: &mpsc::Receiver<String>) -> Result<(), String> {
    window
        .eval(WAIT_FOR_FONTS)
        .map_err(|error| error.to_string())?;
    let deadline = std::time::Instant::now() + FONTS_TIMEOUT;
    loop {
        let left = deadline.saturating_duration_since(std::time::Instant::now());
        let title = titles
            .recv_timeout(left)
            .map_err(|_| "The fonts of the export document did not load.".to_string())?;
        if title == FONTS_READY_TITLE {
            break;
        }
    }
    window
        .eval(RESTORE_TITLE)
        .map_err(|error| error.to_string())?;
    // Print only once the real title is back; a missed event only costs the timeout.
    while let Ok(title) = titles.recv_timeout(TITLE_RESTORE_TIMEOUT) {
        if title != FONTS_READY_TITLE {
            break;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn staged(target: &Path) -> Staging {
        Staging::new("<html></html>", target).unwrap()
    }

    #[test]
    fn stages_the_document_and_cleans_up() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("Rome.pdf");
        let staging = staged(&target);
        assert_eq!(fs::read_to_string(&staging.html).unwrap(), "<html></html>");
        let html = staging.html.clone();
        drop(staging);
        assert!(!html.exists());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    }

    #[test]
    fn rejects_a_missing_folder() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("missing").join("Rome.pdf");
        let error = Staging::new("", &target).err().unwrap();
        assert!(error.contains("does not exist"), "{error}");
    }

    #[test]
    fn rejects_a_folder_as_target() {
        let dir = tempfile::tempdir().unwrap();
        let error = Staging::new("", dir.path()).err().unwrap();
        assert!(error.contains("is a folder"), "{error}");
    }

    #[test]
    fn replaces_the_target_with_a_finished_pdf() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("Rome.pdf");
        fs::write(&target, "old").unwrap();
        let staging = staged(&target);
        fs::write(&staging.printed, b"%PDF-1.4 new").unwrap();
        commit_pdf(staging.printed, &target).unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"%PDF-1.4 new");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn keeps_the_target_when_the_print_is_empty() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("Rome.pdf");
        fs::write(&target, "old").unwrap();
        let staging = staged(&target);
        let error = commit_pdf(staging.printed, &target).unwrap_err();
        assert_eq!(error, "The print produced no PDF.");
        assert_eq!(fs::read(&target).unwrap(), b"old");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn keeps_the_target_when_the_print_is_not_a_pdf() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("Rome.pdf");
        let staging = staged(&target);
        fs::write(&staging.printed, "<html>").unwrap();
        assert!(commit_pdf(staging.printed, &target).is_err());
        assert!(!target.exists());
    }
}

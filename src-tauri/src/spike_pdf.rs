//! Spike (issue #65): print a fixed HTML document to a PDF file with the native WebView, no dialog.
use base64::Engine;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

const FONT: &[u8] = include_bytes!("../spike/DejaVuSans.ttf");
const TEMPLATE: &str = include_str!("../spike/mod_doc.html");

/// Writes the document next to the target PDF and returns its `file://` URL.
fn document_url(pdf: &std::path::Path) -> Result<tauri::Url, String> {
    let b64 = base64::engine::general_purpose::STANDARD;
    let html = TEMPLATE.replace("__FONT__", &b64.encode(FONT));
    let file = pdf.with_extension("html");
    std::fs::write(&file, html).map_err(|e| e.to_string())?;
    tauri::Url::from_file_path(&file).map_err(|_| "bad path".to_string())
}

#[tauri::command]
pub async fn spike_print_pdf(app: AppHandle, path: String) -> Result<(), String> {
    let (loaded_tx, loaded_rx) = mpsc::channel::<()>();
    let url = document_url(std::path::Path::new(&path))?;
    let window = WebviewWindowBuilder::new(&app, "spike-print", WebviewUrl::External(url))
        .visible(false)
        .inner_size(794.0, 1123.0)
        .on_page_load(move |_, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                let _ = loaded_tx.send(());
            }
        })
        .build()
        .map_err(|e| e.to_string())?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        loaded_rx
            .recv_timeout(Duration::from_secs(30))
            .map_err(|_| "page did not load".to_string())?;
        // Give layout and font decoding a moment after the load event.
        std::thread::sleep(Duration::from_millis(500));
        let (done_tx, done_rx) = mpsc::channel::<Result<(), String>>();
        window
            .with_webview(move |wv| platform::print(wv, PathBuf::from(path), done_tx))
            .map_err(|e| e.to_string())?;
        let r = done_rx
            .recv_timeout(Duration::from_secs(60))
            .map_err(|_| "print did not finish".to_string())?;
        let _ = window.destroy();
        r
    })
    .await
    .map_err(|e| e.to_string())?;
    result
}

#[cfg(target_os = "linux")]
mod platform {
    use std::path::PathBuf;
    use std::sync::mpsc::Sender;
    use tauri::webview::PlatformWebview;
    use webkit2gtk::PrintOperationExt;

    // A4 in mm, zero margins, "Print to File" with a PDF output URI: no dialog is shown.
    pub fn print(wv: PlatformWebview, path: PathBuf, done: Sender<Result<(), String>>) {
        let op = webkit2gtk::PrintOperation::new(&wv.inner());
        let settings = gtk::PrintSettings::new();
        settings.set_printer("Print to File");
        settings.set(
            gtk::PRINT_SETTINGS_OUTPUT_FILE_FORMAT,
            Some("pdf"),
        );
        settings.set(
            gtk::PRINT_SETTINGS_OUTPUT_URI,
            Some(&format!("file://{}", path.display())),
        );
        let setup = gtk::PageSetup::new();
        setup.set_paper_size(&gtk::PaperSize::new(Some(gtk::PAPER_NAME_A4)));
        for f in [
            gtk::PageSetup::set_top_margin,
            gtk::PageSetup::set_bottom_margin,
            gtk::PageSetup::set_left_margin,
            gtk::PageSetup::set_right_margin,
        ] {
            f(&setup, 0.0, gtk::Unit::Mm);
        }
        op.set_print_settings(&settings);
        op.set_page_setup(&setup);
        let ok = done.clone();
        op.connect_finished(move |_| {
            let _ = ok.send(Ok(()));
        });
        op.connect_failed(move |_, e| {
            let _ = done.send(Err(e.to_string()));
        });
        op.print();
    }
}

#[cfg(windows)]
mod platform {
    use std::path::PathBuf;
    use std::sync::mpsc::Sender;
    use tauri::webview::PlatformWebview;
    use webview2_com::Microsoft::Web::WebView2::Win32::*;
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING};

    // A4 in inches, zero margins, no header/footer, backgrounds on.
    pub fn print(wv: PlatformWebview, path: PathBuf, done: Sender<Result<(), String>>) {
        let r = (|| -> windows::core::Result<()> {
            unsafe {
                let core = wv.controller().CoreWebView2()?;
                let core7: ICoreWebView2_7 = core.cast()?;
                let env6: ICoreWebView2Environment6 = wv.environment().cast()?;
                let s = env6.CreatePrintSettings()?;
                s.SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT)?;
                s.SetPageWidth(210.0 / 25.4)?;
                s.SetPageHeight(297.0 / 25.4)?;
                s.SetMarginTop(0.0)?;
                s.SetMarginBottom(0.0)?;
                s.SetMarginLeft(0.0)?;
                s.SetMarginRight(0.0)?;
                s.SetShouldPrintBackgrounds(true)?;
                s.SetShouldPrintHeaderAndFooter(false)?;
                let tx = done.clone();
                let handler = PrintToPdfCompletedHandler::create(Box::new(move |res, ok| {
                    let _ = tx.send(match res {
                        Ok(()) if ok => Ok(()),
                        Ok(()) => Err("PrintToPdf reported failure".into()),
                        Err(e) => Err(e.to_string()),
                    });
                    Ok(())
                }));
                core7.PrintToPdf(&HSTRING::from(path.as_os_str()), &s, &handler)
            }
        })();
        if let Err(e) = r {
            let _ = done.send(Err(e.to_string()));
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use objc2::rc::Retained;
    use objc2::{AnyThread, Message};
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{NSPrintInfo, NSPrintJobDisposition, NSPrintJobSavingURL, NSPrintSaveJob};
    use objc2_foundation::{NSDictionary, NSPoint, NSRect, NSSize, NSString, NSURL};
    use objc2_web_kit::WKWebView;
    use std::path::PathBuf;
    use std::sync::mpsc::Sender;
    use tauri::webview::PlatformWebview;

    // A4 in points (595.28 x 841.89), zero margins, "save job" to a URL: no dialog is shown.
    pub fn print(wv: PlatformWebview, path: PathBuf, done: Sender<Result<(), String>>) {
        unsafe {
            let view: &WKWebView = &*(wv.inner() as *const WKWebView);
            let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
            let attrs: Retained<NSDictionary<_, AnyObject>> = NSDictionary::from_slices(
                &[NSPrintJobDisposition, NSPrintJobSavingURL],
                &[
                    &*Retained::cast_unchecked::<AnyObject>(NSPrintSaveJob.retain()),
                    &*Retained::cast_unchecked::<AnyObject>(url),
                ],
            );
            let info = NSPrintInfo::initWithDictionary(NSPrintInfo::alloc(), &attrs);
            info.setPaperSize(NSSize::new(595.28, 841.89));
            info.setTopMargin(0.0);
            info.setBottomMargin(0.0);
            info.setLeftMargin(0.0);
            info.setRightMargin(0.0);
            let op = view.printOperationWithPrintInfo(&info);
            op.setShowsPrintPanel(false);
            op.setShowsProgressPanel(false);
            if let Some(v) = op.view() {
                v.setFrame(NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(595.28, 841.89)));
            }
            let ok = op.runOperation();
            let _ = done.send(if ok { Ok(()) } else { Err("runOperation returned false".into()) });
        }
    }
}

//! Throwaway spike (#65): print a fixed HTML document to a PDF through each platform's WebView.
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::Duration;
use tauri::webview::{PageLoadEvent, PlatformWebview};
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

type Done = mpsc::Sender<Result<(), String>>;

pub async fn print_fixture(app: AppHandle, path: PathBuf) -> Result<(), String> {
    let (loaded_tx, loaded_rx) = mpsc::channel::<()>();
    let window = WebviewWindowBuilder::new(
        &app,
        "spike-print",
        WebviewUrl::App("spike/print.html".into()),
    )
    .visible(false)
    .inner_size(794.0, 1123.0)
    .on_page_load(move |_, payload| {
        if payload.event() == PageLoadEvent::Finished {
            let _ = loaded_tx.send(());
        }
    })
    .build()
    .map_err(|e| e.to_string())?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        loaded_rx
            .recv_timeout(Duration::from_secs(30))
            .map_err(|e| format!("page load: {e}"))?;
        // Let the bundled fonts finish loading.
        std::thread::sleep(Duration::from_millis(1000));
        let (tx, rx) = mpsc::channel();
        window
            .with_webview(move |wv| print_platform(wv, &path, tx))
            .map_err(|e| e.to_string())?;
        let r = rx
            .recv_timeout(Duration::from_secs(60))
            .map_err(|e| format!("print: {e}"))?;
        let _ = window.destroy();
        r
    })
    .await
    .map_err(|e| e.to_string())?;
    result
}

#[cfg(target_os = "linux")]
fn print_platform(wv: PlatformWebview, path: &Path, done: Done) {
    use webkit2gtk::{PrintOperation, PrintOperationExt};

    let paper = gtk::PaperSize::new(Some("iso_a4"));
    let setup = gtk::PageSetup::new();
    setup.set_paper_size(&paper);
    setup.set_top_margin(0.0, gtk::Unit::Mm);
    setup.set_bottom_margin(0.0, gtk::Unit::Mm);
    setup.set_left_margin(0.0, gtk::Unit::Mm);
    setup.set_right_margin(0.0, gtk::Unit::Mm);

    let settings = gtk::PrintSettings::new();
    settings.set_printer("Print to File");
    settings.set("output-file-format", Some("pdf"));
    settings.set("output-uri", Some(&format!("file://{}", path.display())));
    settings.set_paper_size(&paper);

    let op = PrintOperation::new(&wv.inner());
    op.set_page_setup(&setup);
    op.set_print_settings(&settings);
    let ok = done.clone();
    op.connect_finished(move |_| {
        let _ = ok.send(Ok(()));
    });
    op.connect_failed(move |_, e| {
        let _ = done.send(Err(e.to_string()));
    });
    op.print();
}

#[cfg(windows)]
fn print_platform(wv: PlatformWebview, path: &Path, done: Done) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT, ICoreWebView2_7, ICoreWebView2Environment6,
    };
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{HSTRING, Interface};

    let run = || -> windows::core::Result<()> {
        unsafe {
            let core: ICoreWebView2_7 = wv.controller().CoreWebView2()?.cast()?;
            let env: ICoreWebView2Environment6 = wv.environment().cast()?;
            let settings = env.CreatePrintSettings()?;
            settings.SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT)?;
            // A4 in inches
            settings.SetPageWidth(8.27)?;
            settings.SetPageHeight(11.69)?;
            settings.SetMarginTop(0.0)?;
            settings.SetMarginBottom(0.0)?;
            settings.SetMarginLeft(0.0)?;
            settings.SetMarginRight(0.0)?;
            settings.SetShouldPrintBackgrounds(true.into())?;
            settings.SetShouldPrintHeaderAndFooter(false.into())?;
            let tx = done.clone();
            let handler = PrintToPdfCompletedHandler::create(Box::new(move |res, ok| {
                let _ = tx.send(match res {
                    Ok(()) if ok.as_bool() => Ok(()),
                    Ok(()) => Err("PrintToPdf reported failure".to_string()),
                    Err(e) => Err(e.to_string()),
                });
                Ok(())
            }));
            core.PrintToPdf(&HSTRING::from(path.as_os_str()), &settings, &handler)
        }
    };
    if let Err(e) = run() {
        let _ = done.send(Err(e.to_string()));
    }
}

#[cfg(target_os = "macos")]
fn print_platform(wv: PlatformWebview, path: &Path, done: Done) {
    use objc2_app_kit::{NSPrintInfo, NSPrintJobSavingURL, NSPrintSaveJob};
    use objc2_foundation::{NSSize, NSString, NSURL};
    use objc2_web_kit::WKWebView;

    let webview: &WKWebView = unsafe { &*wv.inner().cast() };
    let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
    unsafe {
        let info = NSPrintInfo::new();
        // A4 in points
        info.setPaperSize(NSSize::new(595.0, 842.0));
        info.setTopMargin(0.0);
        info.setBottomMargin(0.0);
        info.setLeftMargin(0.0);
        info.setRightMargin(0.0);
        info.setJobDisposition(NSPrintSaveJob);
        info.dictionary()
            .setObject_forKey(&url, NSPrintJobSavingURL);
        let op = webview.printOperationWithPrintInfo(&info);
        op.setShowsPrintPanel(false);
        op.setShowsProgressPanel(false);
        op.view().unwrap().setFrame(webview.frame());
        let ok = op.runOperation();
        let _ = done.send(if ok {
            Ok(())
        } else {
            Err("runOperation returned NO".to_string())
        });
    }
}

#[cfg(not(any(target_os = "linux", windows, target_os = "macos")))]
fn print_platform(_wv: PlatformWebview, _path: &Path, done: Done) {
    let _ = done.send(Err("unsupported platform".to_string()));
}

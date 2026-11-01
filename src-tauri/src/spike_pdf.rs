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
            settings.SetPageWidth(8.2677)?;
            settings.SetPageHeight(11.6929)?;
            settings.SetMarginTop(0.0)?;
            settings.SetMarginBottom(0.0)?;
            settings.SetMarginLeft(0.0)?;
            settings.SetMarginRight(0.0)?;
            settings.SetShouldPrintBackgrounds(true.into())?;
            settings.SetShouldPrintHeaderAndFooter(false.into())?;
            let tx = done.clone();
            let handler = PrintToPdfCompletedHandler::create(Box::new(move |res, ok| {
                let _ = tx.send(match res {
                    Ok(()) if ok => Ok(()),
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
    use objc2::rc::Retained;
    use objc2::runtime::ProtocolObject;
    use objc2_app_kit::{NSPrintInfo, NSPrintJobSavingURL, NSPrintSaveJob, NSWindow};
    use objc2_foundation::{NSSize, NSString, NSURL};
    use objc2_web_kit::WKWebView;

    let webview: &WKWebView = unsafe { &*wv.inner().cast() };
    let window: Retained<NSWindow> = unsafe { Retained::retain(wv.ns_window().cast()).unwrap() };
    let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
    unsafe {
        let info = NSPrintInfo::new();
        // A4 in points
        info.setPaperSize(NSSize::new(595.28, 841.89));
        info.setTopMargin(0.0);
        info.setBottomMargin(0.0);
        info.setLeftMargin(0.0);
        info.setRightMargin(0.0);
        info.setJobDisposition(NSPrintSaveJob);
        info.dictionary()
            .setObject_forKey(&url, ProtocolObject::from_ref(NSPrintJobSavingURL));
        let op = webview.printOperationWithPrintInfo(&info);
        op.setShowsPrintPanel(false);
        op.setShowsProgressPanel(false);
        op.view().unwrap().setFrame(webview.frame());
        // Asynchronous: the synchronous runOperation blocks the main thread forever for a
        // WKWebView. Completion is detected by polling the output file.
        op.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
            &window,
            None,
            None,
            std::ptr::null_mut(),
        );
    }
    let path = path.to_path_buf();
    std::thread::spawn(move || {
        let mut last = 0;
        for _ in 0..100 {
            std::thread::sleep(Duration::from_millis(500));
            let len = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            if len > 0 && len == last {
                let _ = done.send(Ok(()));
                return;
            }
            last = len;
        }
        let _ = done.send(Err("output file never appeared".to_string()));
    });
}

#[cfg(not(any(target_os = "linux", windows, target_os = "macos")))]
fn print_platform(_wv: PlatformWebview, _path: &Path, done: Done) {
    let _ = done.send(Err("unsupported platform".to_string()));
}

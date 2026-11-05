//! Print the WebView to a PDF file with each platform's native API (ADR-0004, spike #65).
use std::path::PathBuf;
use std::sync::mpsc::Sender;
use tauri::webview::PlatformWebview;

/// Reports when the PDF is written, or why it was not.
pub type Done = Sender<Result<(), String>>;

#[cfg(target_os = "linux")]
pub fn print(webview: PlatformWebview, path: PathBuf, done: Done) {
    use webkit2gtk::{PrintOperation, PrintOperationExt};

    let Ok(uri) = tauri::Url::from_file_path(&path) else {
        let _ = done.send(Err("Invalid export path.".into()));
        return;
    };
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
    settings.set("output-uri", Some(uri.as_str()));
    settings.set_paper_size(&paper);

    let operation = PrintOperation::new(&webview.inner());
    operation.set_page_setup(&setup);
    operation.set_print_settings(&settings);
    let finished = done.clone();
    operation.connect_finished(move |_| {
        let _ = finished.send(Ok(()));
    });
    operation.connect_failed(move |_, error| {
        let _ = done.send(Err(error.to_string()));
    });
    operation.print();
}

#[cfg(windows)]
pub fn print(webview: PlatformWebview, path: PathBuf, done: Done) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT, ICoreWebView2_7, ICoreWebView2Environment6,
    };
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{HSTRING, Interface};

    let run = || -> windows::core::Result<()> {
        // SAFETY: the controller and environment belong to the live hidden window.
        unsafe {
            let core: ICoreWebView2_7 = webview.controller().CoreWebView2()?.cast()?;
            let environment: ICoreWebView2Environment6 = webview.environment().cast()?;
            let settings = environment.CreatePrintSettings()?;
            settings.SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT)?;
            // A4 in inches
            settings.SetPageWidth(8.2677)?;
            settings.SetPageHeight(11.6929)?;
            settings.SetMarginTop(0.0)?;
            settings.SetMarginBottom(0.0)?;
            settings.SetMarginLeft(0.0)?;
            settings.SetMarginRight(0.0)?;
            settings.SetShouldPrintBackgrounds(true)?;
            settings.SetShouldPrintHeaderAndFooter(false)?;
            let finished = done.clone();
            let handler = PrintToPdfCompletedHandler::create(Box::new(move |result, ok| {
                let _ = finished.send(match result {
                    Ok(()) if ok => Ok(()),
                    Ok(()) => Err("The print failed.".to_string()),
                    Err(error) => Err(error.to_string()),
                });
                Ok(())
            }));
            core.PrintToPdf(&HSTRING::from(path.as_os_str()), &settings, &handler)
        }
    };
    if let Err(error) = run() {
        let _ = done.send(Err(error.to_string()));
    }
}

#[cfg(target_os = "macos")]
pub fn print(webview: PlatformWebview, path: PathBuf, done: Done) {
    use objc2::rc::Retained;
    use objc2::runtime::ProtocolObject;
    use objc2_app_kit::{NSPrintInfo, NSPrintJobSavingURL, NSPrintSaveJob, NSWindow};
    use objc2_foundation::{NSSize, NSString, NSURL};
    use objc2_web_kit::WKWebView;
    use std::time::Duration;

    // SAFETY: the pointers belong to the live hidden window; with_webview runs on the main thread.
    let (view, window): (&WKWebView, Retained<NSWindow>) = unsafe {
        let Some(window) = Retained::retain(webview.ns_window().cast()) else {
            let _ = done.send(Err("The export window has no native window.".into()));
            return;
        };
        (&*webview.inner().cast(), window)
    };
    let url = NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()));
    // SAFETY: plain AppKit calls on the main thread with objects created above.
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
        let operation = view.printOperationWithPrintInfo(&info);
        operation.setShowsPrintPanel(false);
        operation.setShowsProgressPanel(false);
        if let Some(print_view) = operation.view() {
            print_view.setFrame(view.frame());
        }
        // Asynchronous: the synchronous runOperation blocks the main thread forever for a WKWebView.
        operation.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
            &window,
            None,
            None,
            std::ptr::null_mut(),
        );
    }
    // Completion is detected by the output file: written (`%PDF`) and no longer growing.
    std::thread::spawn(move || {
        let mut last = 0;
        for _ in 0..240 {
            std::thread::sleep(Duration::from_millis(250));
            let bytes = std::fs::read(&path).unwrap_or_default();
            if bytes.starts_with(b"%PDF") && bytes.len() == last {
                let _ = done.send(Ok(()));
                return;
            }
            last = bytes.len();
        }
        let _ = done.send(Err("The print produced no file.".into()));
    });
}

#[cfg(not(any(target_os = "linux", windows, target_os = "macos")))]
pub fn print(_webview: PlatformWebview, _path: PathBuf, done: Done) {
    let _ = done.send(Err("Exporting is not supported on this platform.".into()));
}

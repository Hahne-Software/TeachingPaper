mod atomic_write;
mod spike_pdf;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};

#[tauri::command]
async fn spike_print_pdf(app: tauri::AppHandle, path: String) -> Result<(), String> {
    spike_pdf::print_fixture(app, path.into()).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            atomic_write::write_file_atomic,
            atomic_write::file_exists,
            spike_print_pdf
        ])
        .setup(|app| {
            let handle = app.handle();

            if let Ok(out) = std::env::var("SPIKE_PRINT_PDF") {
                let h = handle.clone();
                tauri::async_runtime::spawn(async move {
                    let r = spike_pdf::print_fixture(h.clone(), out.into()).await;
                    eprintln!("SPIKE_RESULT: {r:?}");
                    h.exit(if r.is_ok() { 0 } else { 1 });
                });
            }

            let recent_menu = SubmenuBuilder::new(handle, "Open Recent")
                .item(
                    &MenuItemBuilder::with_id("open-recent-clear", "Clear Recent")
                        .enabled(false)
                        .build(handle)?,
                )
                .build()?;

            let file_menu = SubmenuBuilder::new(handle, "File")
                .item(
                    &MenuItemBuilder::with_id("file-new", "New")
                        .accelerator("CmdOrCtrl+N")
                        .build(handle)?,
                )
                .item(
                    &MenuItemBuilder::with_id("open-file", "Open File…")
                        .accelerator("CmdOrCtrl+O")
                        .build(handle)?,
                )
                .item(
                    &MenuItemBuilder::with_id("open-folder", "Open Folder…")
                        .accelerator("CmdOrCtrl+Shift+O")
                        .build(handle)?,
                )
                .item(&recent_menu)
                .separator()
                .item(
                    &MenuItemBuilder::with_id("file-save", "Save")
                        .accelerator("CmdOrCtrl+S")
                        .build(handle)?,
                )
                .item(
                    &MenuItemBuilder::with_id("file-save-as", "Save As…")
                        .accelerator("CmdOrCtrl+Shift+S")
                        .build(handle)?,
                )
                .separator()
                .item(&PredefinedMenuItem::close_window(handle, None)?)
                // Not the predefined Quit: it exits without a close request, so unsaved
                // changes would be lost without asking.
                .item(
                    &MenuItemBuilder::with_id("app-quit", "Quit")
                        .accelerator("CmdOrCtrl+Q")
                        .build(handle)?,
                )
                .build()?;

            let edit_menu = SubmenuBuilder::new(handle, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_menu = SubmenuBuilder::new(handle, "View")
                .item(
                    &MenuItemBuilder::with_id("view-zoom-in", "Zoom In")
                        .accelerator("CmdOrCtrl+Plus")
                        .build(handle)?,
                )
                .item(
                    &MenuItemBuilder::with_id("view-zoom-out", "Zoom Out")
                        .accelerator("CmdOrCtrl+-")
                        .build(handle)?,
                )
                .item(
                    &MenuItemBuilder::with_id("view-zoom-reset", "Actual Size")
                        .accelerator("CmdOrCtrl+0")
                        .build(handle)?,
                )
                .separator()
                .fullscreen()
                .build()?;

            let menu = MenuBuilder::new(handle)
                .items(&[&file_menu, &edit_menu, &view_menu])
                .build()?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let Some(window) = app.get_webview_window("main") else {
                return;
            };
            if event.id() == "app-quit" {
                // A close request lets the frontend ask about unsaved changes first.
                let _ = window.close();
            } else {
                // Forward custom menu actions to the frontend.
                let _ = window.emit("menu-event", event.id().0.as_str());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

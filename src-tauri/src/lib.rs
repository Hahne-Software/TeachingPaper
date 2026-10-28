mod atomic_write;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![atomic_write::write_file_atomic])
        .setup(|app| {
            let handle = app.handle();

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
                .item(&PredefinedMenuItem::quit(handle, None)?)
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
            // Forward custom menu actions to the frontend.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("menu-event", event.id().0.as_str());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

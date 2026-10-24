use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

/// Mirrors the "minimize to tray on close" setting from the frontend.
static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(true);
/// Bumped on every schedule_wake call so only the latest one fires.
static WAKE_GENERATION: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
fn set_close_to_tray(enabled: bool) {
    CLOSE_TO_TRAY.store(enabled, Ordering::Relaxed);
}

/// Wake the frontend at `at_ms` (epoch ms), or cancel with `None`.
///
/// A hidden webview's timers can be throttled to about once a minute, so
/// while the window sits in the tray the phase end would be noticed late.
/// An event from Rust runs the frontend's tick right on time.
#[tauri::command]
fn schedule_wake(app: AppHandle, at_ms: Option<u64>) {
    let generation = WAKE_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let Some(at_ms) = at_ms else { return };
    std::thread::spawn(move || {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        std::thread::sleep(Duration::from_millis(at_ms.saturating_sub(now_ms)));
        if WAKE_GENERATION.load(Ordering::SeqCst) == generation {
            let _ = app.emit("timer:wake", ());
        }
    });
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "开始 / 暂停", true, None::<&str>)?;
    let skip = MenuItem::with_id(app, "skip", "跳过当前阶段", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出 Focus", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show, &toggle, &skip, &separator, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Focus")
        .menu(&menu)
        // macOS opens the menu on any click; elsewhere left click shows the window.
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "toggle" => {
                let _ = app.emit("tray:toggle", ());
            }
            "skip" => {
                let _ = app.emit("tray:skip", ());
            }
            "quit" => app.exit(0),
            _ => {}
        });

    #[cfg(not(target_os = "macos"))]
    {
        use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
        tray = tray.on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
    }

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![set_close_to_tray, schedule_wake])
        .setup(|app| {
            build_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" && CLOSE_TO_TRAY.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

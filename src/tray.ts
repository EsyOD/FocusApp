// Frontend side of the tray icon built in src-tauri/src/lib.rs.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TrayIcon } from "@tauri-apps/api/tray";

const isTauri = "__TAURI_INTERNALS__" in window;

const tray = isTauri ? TrayIcon.getById("main") : Promise.resolve(null);
let lastStatus = "";

/**
 * Show the countdown on the tray: next to the icon on macOS (the menu bar
 * has room for text) and as the hover tooltip everywhere.
 */
export function setTrayStatus(clock: string | null, label: string): void {
  const status = clock ? `${clock} ${label}` : label;
  if (status === lastStatus) return;
  lastStatus = status;
  void tray.then((t) => {
    if (!t) return;
    void t.setTooltip(clock ? `Focus · ${label} 剩余 ${clock}` : "Focus");
    void t.setTitle(clock ?? "");
  });
}

export function setCloseToTray(enabled: boolean): void {
  if (isTauri) void invoke("set_close_to_tray", { enabled });
}

/** Ask the backend to wake the timer at `atMs` even if the window is hidden. */
export function scheduleWake(atMs: number | null): void {
  if (isTauri) void invoke("schedule_wake", { atMs });
}

export function onTrayAction(handlers: { toggle: () => void; skip: () => void; wake: () => void }): void {
  if (!isTauri) return;
  void listen("tray:toggle", handlers.toggle);
  void listen("tray:skip", handlers.skip);
  void listen("timer:wake", handlers.wake);
}

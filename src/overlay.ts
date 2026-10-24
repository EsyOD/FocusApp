// Main-window side of the break overlay: one borderless, always-on-top
// window per monitor, so there is no screen left to keep working on.
import { listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors } from "@tauri-apps/api/window";
import type { Phase } from "./timer";

export const SKIP_BREAK_EVENT = "break:skip";
const LABEL_PREFIX = "overlay-";

const isTauri = "__TAURI_INTERNALS__" in window;

export interface OverlayOptions {
  phase: Phase;
  endsAt: number;
  allowSkip: boolean;
  task: string;
}

let open: WebviewWindow[] = [];
// Bumped on every show/hide so a show that is still awaiting the monitor
// list doesn't open windows after the break was already ended.
let generation = 0;

export async function showBreakOverlay(options: OverlayOptions): Promise<void> {
  if (!isTauri) return;
  await hideBreakOverlay();
  const mine = generation;

  const query = new URLSearchParams({
    phase: options.phase,
    endsAt: String(options.endsAt),
    skip: options.allowSkip ? "1" : "0",
    task: options.task,
  });
  const monitors = await availableMonitors();
  if (mine !== generation) return;

  open = monitors.map((monitor, i) => {
    // Window options take logical pixels; convert with that monitor's scale.
    const position = monitor.position.toLogical(monitor.scaleFactor);
    const size = monitor.size.toLogical(monitor.scaleFactor);
    return new WebviewWindow(`${LABEL_PREFIX}${i}`, {
      url: `overlay.html?${query}`,
      title: "Focus 休息中",
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      decorations: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      visibleOnAllWorkspaces: true,
      shadow: false,
      focus: i === 0,
    });
  });
}

export async function hideBreakOverlay(): Promise<void> {
  generation++;
  const windows = open;
  open = [];
  // destroy() bypasses the overlay's own close guard.
  await Promise.all(windows.map((w) => w.destroy().catch(() => {})));
}

export function onSkipBreakRequested(handler: () => void): void {
  if (isTauri) void listen(SKIP_BREAK_EVENT, handler);
}

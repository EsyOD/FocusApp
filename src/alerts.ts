import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { PhaseFinished } from "./timer";

const isTauri = "__TAURI_INTERNALS__" in window;

let permission: Promise<boolean> | null = null;

/** Ask for notification permission once; later calls reuse the answer. */
export function ensureNotificationPermission(): Promise<boolean> {
  permission ??= (async () => {
    try {
      if (isTauri) {
        return (await isPermissionGranted()) || (await requestPermission()) === "granted";
      }
      if (!("Notification" in window)) return false;
      return Notification.permission === "granted" || (await Notification.requestPermission()) === "granted";
    } catch {
      return false;
    }
  })();
  return permission;
}

function message({ phase, next }: PhaseFinished, task: string): { title: string; body: string } {
  if (phase === "focus") {
    const done = task ? `「${task}」这一轮完成了。` : "这一轮专注完成了。";
    return {
      title: "专注结束，休息一下",
      body: `${done}${next === "longBreak" ? "来一次长休息吧。" : "起来活动一下。"}`,
    };
  }
  return { title: "休息结束", body: "准备好就开始下一个番茄。" };
}

export async function notifyPhaseFinished(finished: PhaseFinished, task: string): Promise<void> {
  if (!(await ensureNotificationPermission())) return;
  const { title, body } = message(finished, task);
  if (isTauri) sendNotification({ title, body });
  else new Notification(title, { body });
}

let audio: AudioContext | null = null;

/**
 * A short two-note chime synthesized with Web Audio, so there's no sound
 * file to bundle. Rising for "go focus", falling for "take a break".
 */
export function playChime(toBreak: boolean): void {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    void ctx.resume();
    const notes = toBreak ? [880, 660] : [660, 880];
    notes.forEach((freq, i) => {
      const at = ctx.currentTime + i * 0.25;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.65);
    });
  } catch {
    // Audio unavailable; the notification still goes out.
  }
}

import { DEFAULT_CONFIG, type TimerConfig, sanitizeConfig } from "./timer";

export interface Settings extends TimerConfig {
  notifications: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_CONFIG,
  notifications: true,
  sound: true,
};

const KEY = "focus.settings.v1";

/** Validate untrusted input (stored JSON or form values) into Settings. */
export function sanitizeSettings(input: unknown): Settings {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    ...sanitizeConfig(raw),
    notifications: typeof raw.notifications === "boolean" ? raw.notifications : DEFAULT_SETTINGS.notifications,
    sound: typeof raw.sound === "boolean" ? raw.sound : DEFAULT_SETTINGS.sound,
  };
}

// The Tauri webview keeps localStorage per app, so it survives restarts.
export function loadSettings(): Settings {
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: settings still apply for this session.
  }
}

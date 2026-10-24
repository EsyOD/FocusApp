import { DEFAULT_CONFIG, type TimerConfig, sanitizeConfig } from "./timer";

export interface Settings extends TimerConfig {
  notifications: boolean;
  sound: boolean;
  /** Cover every screen during breaks; the break then starts on its own. */
  breakOverlay: boolean;
  /** Show a "skip break" button on the overlay for emergencies. */
  allowSkipBreak: boolean;
}

const FLAGS = ["notifications", "sound", "breakOverlay", "allowSkipBreak"] as const;

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_CONFIG,
  notifications: true,
  sound: true,
  breakOverlay: true,
  allowSkipBreak: true,
};

const KEY = "focus.settings.v1";

/** Validate untrusted input (stored JSON or form values) into Settings. */
export function sanitizeSettings(input: unknown): Settings {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const settings: Settings = { ...DEFAULT_SETTINGS, ...sanitizeConfig(raw) };
  for (const flag of FLAGS) {
    if (typeof raw[flag] === "boolean") settings[flag] = raw[flag];
  }
  return settings;
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

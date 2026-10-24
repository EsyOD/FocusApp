import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "./settings";

describe("settings", () => {
  it("falls back to defaults for missing or malformed input", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ sound: "yes", notifications: 1 })).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values", () => {
    expect(
      sanitizeSettings({ focusMinutes: 45, sound: false, notifications: false, breakOverlay: false, allowSkipBreak: false, closeToTray: false }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      focusMinutes: 45,
      sound: false,
      notifications: false,
      breakOverlay: false,
      allowSkipBreak: false,
      closeToTray: false,
    });
  });
});

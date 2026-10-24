import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  formatClock,
  initialState,
  pause,
  remainingMs,
  reset,
  skip,
  start,
  tick,
} from "./timer";

const config = DEFAULT_CONFIG;
const MIN = 60_000;

describe("timer", () => {
  it("starts in a stopped 25 minute focus phase", () => {
    const s = initialState(config);
    expect(s.phase).toBe("focus");
    expect(s.running).toBe(false);
    expect(remainingMs(s, 0)).toBe(25 * MIN);
  });

  it("counts down from absolute time while running", () => {
    const s = start(initialState(config), 1_000);
    expect(remainingMs(s, 1_000 + 10 * MIN)).toBe(15 * MIN);
  });

  it("freezes remaining time when paused and resumes from it", () => {
    let s = start(initialState(config), 0);
    s = pause(s, 5 * MIN);
    expect(remainingMs(s, 100 * MIN)).toBe(20 * MIN);
    s = start(s, 100 * MIN);
    expect(remainingMs(s, 102 * MIN)).toBe(18 * MIN);
  });

  it("reset restores the full phase duration and stops", () => {
    let s = start(initialState(config), 0);
    s = reset(pause(s, 7 * MIN), config);
    expect(s.running).toBe(false);
    expect(s.remainingMs).toBe(25 * MIN);
  });

  it("finishes focus into a short break, stopped", () => {
    const s = start(initialState(config), 0);
    expect(tick(s, config, 24 * MIN).finished).toBeNull();
    const { state, finished } = tick(s, config, 25 * MIN + 500);
    expect(finished).toEqual({ phase: "focus", next: "shortBreak" });
    expect(state.phase).toBe("shortBreak");
    expect(state.running).toBe(false);
    expect(state.remainingMs).toBe(5 * MIN);
    expect(state.completedFocus).toBe(1);
  });

  it("gives a long break after every fourth focus session", () => {
    let s = initialState(config);
    const phases: string[] = [];
    for (let i = 0; i < 8; i++) {
      s = skip(s, config);
      phases.push(s.phase);
    }
    expect(phases).toEqual([
      "shortBreak", "focus", "shortBreak", "focus",
      "shortBreak", "focus", "longBreak", "focus",
    ]);
  });

  it("formats the clock as mm:ss, rounding partial seconds up", () => {
    expect(formatClock(25 * MIN)).toBe("25:00");
    expect(formatClock(61_001)).toBe("01:02");
    expect(formatClock(0)).toBe("00:00");
  });
});

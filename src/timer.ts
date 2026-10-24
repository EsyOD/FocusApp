// Pure Pomodoro state machine. All time math is based on absolute
// timestamps so the countdown stays accurate even if the UI tick is late
// (e.g. the window was hidden or the machine slept).

export type Phase = "focus" | "shortBreak" | "longBreak";

export interface TimerConfig {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** A long break replaces the short break after this many focus sessions. */
  longBreakEvery: number;
}

export const DEFAULT_CONFIG: TimerConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
};

export interface TimerState {
  phase: Phase;
  running: boolean;
  /** Epoch ms when the current phase ends; only meaningful while running. */
  endsAt: number | null;
  /** Ms left in the phase; authoritative while paused. */
  remainingMs: number;
  /** Focus sessions finished since the app started (drives long breaks). */
  completedFocus: number;
}

/** Emitted when a phase runs to zero, so callers can notify and record it. */
export interface PhaseFinished {
  phase: Phase;
  next: Phase;
}

export function phaseDurationMs(phase: Phase, config: TimerConfig): number {
  const minutes =
    phase === "focus"
      ? config.focusMinutes
      : phase === "shortBreak"
        ? config.shortBreakMinutes
        : config.longBreakMinutes;
  return minutes * 60_000;
}

export function initialState(config: TimerConfig): TimerState {
  return {
    phase: "focus",
    running: false,
    endsAt: null,
    remainingMs: phaseDurationMs("focus", config),
    completedFocus: 0,
  };
}

export function remainingMs(state: TimerState, now: number): number {
  if (!state.running || state.endsAt === null) return state.remainingMs;
  return Math.max(0, state.endsAt - now);
}

export function start(state: TimerState, now: number): TimerState {
  if (state.running) return state;
  return { ...state, running: true, endsAt: now + state.remainingMs };
}

export function pause(state: TimerState, now: number): TimerState {
  if (!state.running) return state;
  return { ...state, running: false, endsAt: null, remainingMs: remainingMs(state, now) };
}

/** Restart the current phase from its full duration, stopped. */
export function reset(state: TimerState, config: TimerConfig): TimerState {
  return {
    ...state,
    running: false,
    endsAt: null,
    remainingMs: phaseDurationMs(state.phase, config),
  };
}

function nextPhase(state: TimerState, config: TimerConfig): { phase: Phase; completedFocus: number } {
  if (state.phase !== "focus") return { phase: "focus", completedFocus: state.completedFocus };
  const completedFocus = state.completedFocus + 1;
  const phase = completedFocus % config.longBreakEvery === 0 ? "longBreak" : "shortBreak";
  return { phase, completedFocus };
}

/**
 * Move to the next phase, stopped. Skipping a focus session still counts
 * toward the long-break cycle so the rhythm doesn't drift.
 */
export function skip(state: TimerState, config: TimerConfig): TimerState {
  const { phase, completedFocus } = nextPhase(state, config);
  return {
    phase,
    running: false,
    endsAt: null,
    remainingMs: phaseDurationMs(phase, config),
    completedFocus,
  };
}

/**
 * Advance the clock. When the running phase hits zero, switch to the next
 * phase (stopped, so the user chooses when to begin) and report it.
 */
export function tick(
  state: TimerState,
  config: TimerConfig,
  now: number,
): { state: TimerState; finished: PhaseFinished | null } {
  if (!state.running || remainingMs(state, now) > 0) return { state, finished: null };
  const next = skip(state, config);
  return { state: next, finished: { phase: state.phase, next: next.phase } };
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

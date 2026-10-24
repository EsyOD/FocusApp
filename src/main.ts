import { getCurrentWindow } from "@tauri-apps/api/window";
import { ensureNotificationPermission, notifyPhaseFinished, playChime } from "./alerts";
import { hideBreakOverlay, onSkipBreakRequested, showBreakOverlay } from "./overlay";
import { type FocusRecord, loadHistory, saveHistory } from "./stats";
import { renderStats } from "./stats-view";
import { DEFAULT_SETTINGS, type Settings, loadSettings, sanitizeSettings, saveSettings } from "./settings";
import {
  type Phase,
  type TimerState,
  applyConfig,
  formatClock,
  initialState,
  pause,
  phaseDurationMs,
  remainingMs,
  reset,
  skip,
  start,
  tick,
} from "./timer";

const PHASE_LABEL: Record<Phase, string> = {
  focus: "专注",
  shortBreak: "短休息",
  longBreak: "长休息",
};

const CIRCUMFERENCE = 2 * Math.PI * 90;

// Settings is a superset of TimerConfig, so it is passed to the timer as-is.
let settings: Settings = loadSettings();
let state: TimerState = initialState(settings);
let overlayShown = false;
const focusHistory: FocusRecord[] = loadHistory();

const app = document.querySelector<HTMLElement>(".app")!;
const clock = document.getElementById("clock")!;
const round = document.getElementById("round")!;
const progress = document.querySelector<SVGCircleElement>(".progress")!;
const toggleBtn = document.getElementById("toggle") as HTMLButtonElement;
const resetBtn = document.getElementById("reset") as HTMLButtonElement;
const skipBtn = document.getElementById("skip") as HTMLButtonElement;
const taskInput = document.getElementById("task") as HTMLInputElement;

// The window title doubles as a glanceable countdown in the taskbar/dock.
// Outside Tauri (plain `npm run dev` in a browser) fall back to document.title.
const isTauri = "__TAURI_INTERNALS__" in window;
let lastTitle = "";
function setTitle(title: string) {
  if (title === lastTitle) return;
  lastTitle = title;
  if (isTauri) void getCurrentWindow().setTitle(title);
  else document.title = title;
}

function render(now = Date.now()) {
  const left = remainingMs(state, now);
  const total = phaseDurationMs(state.phase, settings);

  app.dataset.phase = state.phase;
  for (const tab of document.querySelectorAll<HTMLElement>("[data-tab]")) {
    tab.classList.toggle("active", tab.dataset.tab === state.phase);
  }

  clock.textContent = formatClock(left);
  progress.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - Math.min(1, left / total)));
  round.textContent =
    state.phase === "focus" ? `第 ${state.completedFocus + 1} 个番茄` : `已完成 ${state.completedFocus} 个番茄`;
  toggleBtn.textContent = state.running ? "暂停" : left < total ? "继续" : "开始";
  taskInput.disabled = state.running && state.phase === "focus";

  setTitle(state.running ? `${formatClock(left)} · ${PHASE_LABEL[state.phase]}` : "Focus");
}

function loop() {
  const now = Date.now();
  const result = tick(state, settings, now);
  state = result.state;
  if (result.finished) {
    const task = taskInput.value.trim();
    if (result.finished.phase === "focus") {
      focusHistory.push({ endedAt: now, minutes: settings.focusMinutes, task });
      saveHistory(focusHistory);
    }
    if (settings.sound) playChime(result.finished.phase === "focus");
    if (settings.notifications) void notifyPhaseFinished(result.finished, task);
    if (result.finished.phase === "focus" && settings.breakOverlay) {
      // The overlay is the break, so it starts counting right away.
      state = start(state, now);
      overlayShown = true;
      void showBreakOverlay({
        phase: state.phase,
        endsAt: state.endsAt!,
        allowSkip: settings.allowSkipBreak,
        task,
      });
    }
  }
  syncOverlay();
  render(now);
}

/** Close the overlay as soon as the break is over, however it ended. */
function syncOverlay() {
  if (overlayShown && !(state.phase !== "focus" && state.running)) {
    overlayShown = false;
    void hideBreakOverlay();
  }
}

onSkipBreakRequested(() => {
  if (state.phase === "focus") return;
  state = skip(state, settings);
  syncOverlay();
  render();
});

// With skipping disabled, the main window's controls mustn't be a back door.
const breakLocked = () => overlayShown && !settings.allowSkipBreak;

toggleBtn.addEventListener("click", () => {
  if (breakLocked()) return;
  const now = Date.now();
  state = state.running ? pause(state, now) : start(state, now);
  // Ask on the first user gesture rather than at launch, when it's clear why.
  if (settings.notifications) void ensureNotificationPermission();
  render(now);
});

resetBtn.addEventListener("click", () => {
  if (breakLocked()) return;
  state = reset(state, settings);
  syncOverlay();
  render();
});

skipBtn.addEventListener("click", () => {
  if (breakLocked()) return;
  state = skip(state, settings);
  syncOverlay();
  render();
});

const statsDialog = document.getElementById("stats") as HTMLDialogElement;
document.getElementById("open-stats")!.addEventListener("click", () => {
  renderStats(focusHistory);
  statsDialog.showModal();
});

const settingsDialog = document.getElementById("settings") as HTMLDialogElement;
const settingsForm = settingsDialog.querySelector("form")!;

function fillSettingsForm(values: Settings) {
  for (const [key, value] of Object.entries(values)) {
    const input = settingsForm.elements.namedItem(key) as HTMLInputElement | null;
    if (!input) continue;
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = String(value);
  }
}

document.getElementById("open-settings")!.addEventListener("click", () => {
  fillSettingsForm(settings);
  // returnValue sticks from the last close; clear it so Esc doesn't count as save.
  settingsDialog.returnValue = "";
  settingsDialog.showModal();
});

document.getElementById("restore-defaults")!.addEventListener("click", () => {
  fillSettingsForm(DEFAULT_SETTINGS);
});

settingsDialog.addEventListener("close", () => {
  if (settingsDialog.returnValue !== "save") return;
  const form = new FormData(settingsForm);
  const values: Record<string, unknown> = Object.fromEntries(form);
  // Unchecked boxes are absent from FormData, so read every checkbox explicitly.
  for (const box of settingsForm.querySelectorAll<HTMLInputElement>("input[type=checkbox]")) {
    values[box.name] = box.checked;
  }
  const next = sanitizeSettings(values);
  state = applyConfig(state, settings, next);
  settings = next;
  saveSettings(settings);
  if (settings.notifications) void ensureNotificationPermission();
  render();
});

// Space toggles the timer unless the user is typing or a dialog is open.
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && document.activeElement !== taskInput && !settingsDialog.open && !statsDialog.open) {
    e.preventDefault();
    toggleBtn.click();
  }
});

render();
setInterval(loop, 250);

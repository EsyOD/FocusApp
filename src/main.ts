import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DEFAULT_CONFIG,
  type Phase,
  type TimerState,
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

const config = DEFAULT_CONFIG;
let state: TimerState = initialState(config);

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
  const total = phaseDurationMs(state.phase, config);

  app.dataset.phase = state.phase;
  for (const tab of document.querySelectorAll<HTMLElement>("[data-tab]")) {
    tab.classList.toggle("active", tab.dataset.tab === state.phase);
  }

  clock.textContent = formatClock(left);
  progress.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - left / total));
  round.textContent =
    state.phase === "focus" ? `第 ${state.completedFocus + 1} 个番茄` : `已完成 ${state.completedFocus} 个番茄`;
  toggleBtn.textContent = state.running ? "暂停" : left < total ? "继续" : "开始";
  taskInput.disabled = state.running && state.phase === "focus";

  setTitle(state.running ? `${formatClock(left)} · ${PHASE_LABEL[state.phase]}` : "Focus");
}

function loop() {
  const now = Date.now();
  const result = tick(state, config, now);
  state = result.state;
  if (result.finished) {
    // Steps 2–4 hook in here: system notification, break overlay, stats record.
  }
  render(now);
}

toggleBtn.addEventListener("click", () => {
  const now = Date.now();
  state = state.running ? pause(state, now) : start(state, now);
  render(now);
});

resetBtn.addEventListener("click", () => {
  state = reset(state, config);
  render();
});

skipBtn.addEventListener("click", () => {
  state = skip(state, config);
  render();
});

// Space toggles the timer unless the user is typing in the task box.
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && document.activeElement !== taskInput) {
    e.preventDefault();
    toggleBtn.click();
  }
});

render();
setInterval(loop, 250);

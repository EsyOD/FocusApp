// The page shown inside each break overlay window. It only counts down and
// offers the optional skip; the main window owns the timer and closes the
// overlay when the break ends.
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SKIP_BREAK_EVENT } from "./overlay";
import { formatClock } from "./timer";

const TIPS = [
  "离开屏幕，站起来走一走。",
  "看看远处，让眼睛放松 20 秒。",
  "喝口水，伸个懒腰。",
  "深呼吸几次，肩膀放松。",
];

const params = new URLSearchParams(location.search);
const endsAt = Number(params.get("endsAt")) || Date.now();
const longBreak = params.get("phase") === "longBreak";
const allowSkip = params.get("skip") === "1";
const task = params.get("task") ?? "";

const root = document.querySelector<HTMLElement>(".overlay")!;
const clock = document.getElementById("clock")!;
const skipBtn = document.getElementById("skip") as HTMLButtonElement;

root.dataset.phase = longBreak ? "longBreak" : "shortBreak";
document.getElementById("kicker")!.textContent = longBreak ? "长休息" : "休息一下";
document.getElementById("tip")!.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
if (task) {
  const done = document.getElementById("done")!;
  done.textContent = `刚刚专注完成：${task}`;
  done.hidden = false;
}

const isTauri = "__TAURI_INTERNALS__" in window;

if (allowSkip) {
  skipBtn.hidden = false;
  skipBtn.addEventListener("click", () => {
    if (isTauri) void emit(SKIP_BREAK_EVENT);
  });
}

// Without the skip option, Alt+F4 / Cmd+W shouldn't get around the break.
if (isTauri && !allowSkip) {
  void getCurrentWindow().onCloseRequested((e) => e.preventDefault());
}

function render() {
  clock.textContent = formatClock(Math.max(0, endsAt - Date.now()));
}

render();
setInterval(render, 250);

import { type FocusRecord, formatMinutes, startOfDay, summarize } from "./stats";

const WEEKDAY = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const MAX_TASKS = 6;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  // textContent, never innerHTML: task names are user input.
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderStats(records: FocusRecord[], now = Date.now()): void {
  const s = summarize(records, now);
  const today = startOfDay(now);

  document.getElementById("stat-today")!.textContent = String(s.today.count);
  document.getElementById("stat-today-time")!.textContent = formatMinutes(s.today.minutes);
  document.getElementById("stat-week")!.textContent = String(s.week.count);
  document.getElementById("stat-week-time")!.textContent = formatMinutes(s.week.minutes);
  document.getElementById("stat-streak")!.textContent = String(s.streak);

  const bars = document.getElementById("stat-days")!;
  const peak = Math.max(1, ...s.days.map((d) => d.count));
  bars.replaceChildren(
    ...s.days.map((d) => {
      const date = new Date(d.start);
      const label = d.start === today ? "今天" : WEEKDAY[date.getDay()];
      const bar = el("div", d.start === today ? "bar today" : "bar");
      bar.setAttribute("role", "row");
      bar.title = `${date.getMonth() + 1}月${date.getDate()}日：${d.count} 个番茄，${formatMinutes(d.minutes)}`;
      const fill = el("div", d.count ? "fill" : "fill empty");
      // Leave room for the value and day labels inside the 140px column.
      fill.style.height = `${(d.count / peak) * 90}px`;
      bar.append(el("span", "value", d.count ? String(d.count) : ""), fill, el("span", "day", label));
      return bar;
    }),
  );

  const list = document.getElementById("stat-tasks")!;
  const top = s.tasks.slice(0, MAX_TASKS);
  const most = Math.max(1, ...top.map((t) => t.minutes));
  list.replaceChildren(
    ...top.map((t) => {
      const item = el("li");
      const meter = el("div", "meter");
      const fill = el("span");
      fill.style.width = `${(t.minutes / most) * 100}%`;
      meter.append(fill);
      item.append(el("span", "name", t.task), el("span", "amount", `${t.count} 个 · ${formatMinutes(t.minutes)}`), meter);
      return item;
    }),
  );
  document.getElementById("stat-empty")!.hidden = s.tasks.length > 0;
}

// Focus history: one record per completed focus session, kept locally, plus
// pure aggregation helpers for the stats view.

export interface FocusRecord {
  /** Epoch ms when the session finished. */
  endedAt: number;
  minutes: number;
  /** What the user said they'd focus on; empty if they left it blank. */
  task: string;
}

export interface DayBucket {
  /** Local midnight of the day, epoch ms. */
  start: number;
  count: number;
  minutes: number;
}

export interface TaskTotal {
  task: string;
  count: number;
  minutes: number;
}

export interface Summary {
  today: { count: number; minutes: number };
  week: { count: number; minutes: number };
  /** The last 7 days, oldest first, ending today. */
  days: DayBucket[];
  /** This week's tasks by time spent, most first. */
  tasks: TaskTotal[];
  /** Consecutive days up to today (or yesterday) with at least one session. */
  streak: number;
}

export const UNTITLED_TASK = "未填写";

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday 00:00 local time of the week containing t. */
export function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t));
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return d.getTime();
}

function addDays(dayStart: number, n: number): number {
  // Go through Date so DST shifts don't push us off midnight.
  const d = new Date(dayStart);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

function total(records: FocusRecord[]) {
  return { count: records.length, minutes: records.reduce((sum, r) => sum + r.minutes, 0) };
}

export function summarize(records: FocusRecord[], now: number): Summary {
  const today = startOfDay(now);
  const week = startOfWeek(now);

  const days: DayBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = addDays(today, -i);
    const end = addDays(start, 1);
    days.push({ start, ...total(records.filter((r) => r.endedAt >= start && r.endedAt < end)) });
  }

  const thisWeek = records.filter((r) => r.endedAt >= week);
  const byTask = new Map<string, TaskTotal>();
  for (const r of thisWeek) {
    const task = r.task.trim() || UNTITLED_TASK;
    const entry = byTask.get(task) ?? { task, count: 0, minutes: 0 };
    entry.count++;
    entry.minutes += r.minutes;
    byTask.set(task, entry);
  }

  const activeDays = new Set(records.map((r) => startOfDay(r.endedAt)));
  let streak = 0;
  // A streak isn't broken until today ends without a session.
  let day = activeDays.has(today) ? today : addDays(today, -1);
  while (activeDays.has(day)) {
    streak++;
    day = addDays(day, -1);
  }

  return {
    today: total(records.filter((r) => r.endedAt >= today)),
    week: total(thisWeek),
    days,
    tasks: [...byTask.values()].sort((a, b) => b.minutes - a.minutes || b.count - a.count),
    streak,
  };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

const KEY = "focus.history.v1";

function isRecord(x: unknown): x is FocusRecord {
  const r = x as FocusRecord;
  return !!r && Number.isFinite(r.endedAt) && Number.isFinite(r.minutes) && typeof r.task === "string";
}

export function loadHistory(): FocusRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

export function saveHistory(records: FocusRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    // Storage unavailable: history still shows for this session.
  }
}

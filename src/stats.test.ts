import { describe, expect, it } from "vitest";
import { type FocusRecord, UNTITLED_TASK, formatMinutes, startOfWeek, summarize } from "./stats";

// Local times, so the tests hold in any time zone. 2026-10-22 is a Thursday.
const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();
const now = at(22, 15);

const rec = (day: number, hour: number, task = "写周报", minutes = 25): FocusRecord => ({
  endedAt: at(day, hour),
  minutes,
  task,
});

describe("stats", () => {
  it("weeks start on Monday", () => {
    expect(startOfWeek(now)).toBe(new Date(2026, 9, 19).getTime());
    expect(startOfWeek(new Date(2026, 9, 25, 23).getTime())).toBe(new Date(2026, 9, 19).getTime());
  });

  it("totals today and this week", () => {
    const s = summarize([rec(22, 9), rec(22, 10), rec(20, 9), rec(18, 9)], now);
    expect(s.today).toEqual({ count: 2, minutes: 50 });
    // The 18th is the previous Sunday, so it's outside this week.
    expect(s.week).toEqual({ count: 3, minutes: 75 });
  });

  it("buckets the last 7 days, oldest first", () => {
    const s = summarize([rec(22, 9), rec(16, 9), rec(15, 9)], now);
    expect(s.days).toHaveLength(7);
    expect(s.days[0].start).toBe(new Date(2026, 9, 16).getTime());
    expect(s.days.map((d) => d.count)).toEqual([1, 0, 0, 0, 0, 0, 1]);
  });

  it("ranks this week's tasks by time and labels blank ones", () => {
    const s = summarize([rec(22, 9, "写周报"), rec(21, 9, "读论文", 50), rec(20, 9, "  ")], now);
    expect(s.tasks.map((t) => [t.task, t.minutes])).toEqual([
      ["读论文", 50],
      ["写周报", 25],
      [UNTITLED_TASK, 25],
    ]);
  });

  it("counts a streak through yesterday when today has no session yet", () => {
    expect(summarize([rec(21, 9), rec(20, 9), rec(18, 9)], now).streak).toBe(2);
    expect(summarize([rec(22, 9), rec(21, 9), rec(20, 9)], now).streak).toBe(3);
    expect(summarize([rec(19, 9)], now).streak).toBe(0);
  });

  it("formats minutes", () => {
    expect(formatMinutes(45)).toBe("45 分钟");
    expect(formatMinutes(120)).toBe("2 小时");
    expect(formatMinutes(135)).toBe("2 小时 15 分");
  });
});

import { describe, expect, it } from "vitest";
import { addDays, dayDiff, daysInMonth, monthRows, todayISO, weekStartMonday } from "./dates";

describe("日期工具", () => {
  it("weekStartMonday：周一起始", () => {
    // 2026-09-01 周二 → 所在周周一为 08-31；09-14 周一 → 自身
    expect(weekStartMonday("2026-09-01")).toBe("2026-08-31");
    expect(weekStartMonday("2026-09-14")).toBe("2026-09-14");
    expect(weekStartMonday("2026-09-20")).toBe("2026-09-14");
  });

  it("addDays/dayDiff 跨月正确", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayDiff("2026-08-30", "2026-09-02")).toBe(3);
    expect(dayDiff("2026-09-02", "2026-08-30")).toBe(-3);
  });

  it("daysInMonth 闰年", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 9)).toBe(30);
  });

  it("monthRows 2026-08：行首均周一、含补齐、6 行（TC-CAL-002）", () => {
    const rows = monthRows(2026, 8);
    expect(rows).toHaveLength(6);
    expect(rows[0][0]).toBe("2026-07-27");
    expect(rows[5][0]).toBe("2026-08-31");
    // 补齐格为上月/下月日期
    expect(rows[0][4]).toBe("2026-07-31");
    expect(rows[5][6]).toBe("2026-09-06");
    for (const row of rows) {
      expect(weekStartMonday(row[0])).toBe(row[0]);
    }
  });

  it("todayISO 为合法日期串", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
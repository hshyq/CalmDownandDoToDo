// 拖拽改期纯函数单测（TC-CAL-013/014，PRD 5.3 v1.8）。
import { describe, expect, it } from "vitest";
import { shiftRange, todoDropDates } from "./drag";

describe("shiftRange 横条拖拽平移", () => {
  it("向后拖：起止日期同偏移平移，跨度不变", () => {
    expect(shiftRange("2026-09-01", "2026-09-03", "2026-09-08")).toEqual({
      startDate: "2026-09-08",
      endDate: "2026-09-10",
    });
  });

  it("向前拖：允许负偏移", () => {
    expect(shiftRange("2026-09-08", "2026-09-10", "2026-09-01")).toEqual({
      startDate: "2026-09-01",
      endDate: "2026-09-03",
    });
  });

  it("拖到原开始日所在格：偏移 0，日期不变", () => {
    expect(shiftRange("2026-09-01", "2026-09-03", "2026-09-01")).toEqual({
      startDate: "2026-09-01",
      endDate: "2026-09-03",
    });
  });

  it("跨月平移：大小月进位正确", () => {
    expect(shiftRange("2026-08-30", "2026-09-02", "2026-09-28")).toEqual({
      startDate: "2026-09-28",
      endDate: "2026-10-01",
    });
  });

  it("单日事项：平移后开始=结束=目标格日期", () => {
    expect(shiftRange("2026-09-15", "2026-09-15", "2026-09-20")).toEqual({
      startDate: "2026-09-20",
      endDate: "2026-09-20",
    });
  });
});

describe("todoDropDates 待办拖入日历", () => {
  it("开始=结束=目标格日期", () => {
    expect(todoDropDates("2026-09-08")).toEqual({ startDate: "2026-09-08", endDate: "2026-09-08" });
  });
});

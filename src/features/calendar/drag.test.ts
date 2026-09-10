// 拖拽改期纯函数单测（TC-CAL-013/014/018，PRD 5.3 v1.8/v1.11）。
import { describe, expect, it } from "vitest";
import { clampEdge, shiftRange, todoDropDates } from "./drag";

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

describe("clampEdge 横条头尾拖拽（TC-CAL-018）", () => {
  const base = { startDate: "2026-09-08", endDate: "2026-09-08" };

  it("拖头：单日事项开始提前，结束不变", () => {
    expect(clampEdge(base, "start", "2026-09-05")).toEqual({ startDate: "2026-09-05", endDate: "2026-09-08" });
  });

  it("拖尾：结束延后，开始不变", () => {
    expect(clampEdge(base, "end", "2026-09-10")).toEqual({ startDate: "2026-09-08", endDate: "2026-09-10" });
  });

  it("拖头不允许越过结束日期（钳制到结束日）", () => {
    expect(clampEdge(base, "start", "2026-09-12")).toEqual({ startDate: "2026-09-08", endDate: "2026-09-08" });
  });

  it("拖尾不允许早于开始日期（钳制到开始日）", () => {
    expect(clampEdge(base, "end", "2026-09-01")).toEqual({ startDate: "2026-09-08", endDate: "2026-09-08" });
  });

  it("跨月拖拽：允许拖到相邻月", () => {
    expect(clampEdge({ startDate: "2026-09-01", endDate: "2026-09-03" }, "end", "2026-10-05")).toEqual({
      startDate: "2026-09-01",
      endDate: "2026-10-05",
    });
  });

  it("拖到原值：日期不变（原地收手不写库）", () => {
    expect(clampEdge(base, "start", "2026-09-08")).toEqual(base);
    expect(clampEdge(base, "end", "2026-09-08")).toEqual(base);
  });
});

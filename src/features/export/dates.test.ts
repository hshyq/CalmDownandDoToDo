// TXT 导出纯函数测试：与后端 store/export.rs 行为对齐（TC-EXP-001/002/007）。
import { describe, expect, it } from "vitest";
import { daysInMonth, defaultExportRange, maxEndDate, shortcutRange } from "./dates";

describe("defaultExportRange 默认范围=当前月首~下月末", () => {
  it("普通月", () => {
    expect(defaultExportRange("2026-09-16")).toEqual({ start: "2026-09-01", end: "2026-10-31" });
  });
  it("12 月跨年：下月=次年 1 月", () => {
    expect(defaultExportRange("2026-12-08")).toEqual({ start: "2026-12-01", end: "2027-01-31" });
  });
  it("下月为小月", () => {
    expect(defaultExportRange("2026-03-20")).toEqual({ start: "2026-03-01", end: "2026-04-30" });
  });
});

describe("maxEndDate 结束上限=开始+6 个月−1 天", () => {
  it("用户定义示例", () => {
    expect(maxEndDate("2026-09-16")).toBe("2027-03-15");
  });
  it("月初 1 日减一天=上月最后一天（目标月 2 月非闰）", () => {
    expect(maxEndDate("2026-09-01")).toBe("2027-02-28");
  });
  it("月末同日不存在→钳到目标月末再减一天", () => {
    expect(maxEndDate("2026-08-31")).toBe("2027-02-27");
  });
  it("年末跨年", () => {
    expect(maxEndDate("2026-12-15")).toBe("2027-06-14");
  });
  it("目标月为闰年 2 月（钳 29 再减）", () => {
    expect(maxEndDate("2027-08-31")).toBe("2028-02-28");
  });
});

describe("daysInMonth", () => {
  it("闰年判定", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
  });
});

describe("shortcutRange 快捷范围（TC-EXP-007，开始一律=今天）", () => {
  it("一周内 = 今天+7 天", () => {
    expect(shortcutRange("w", "2026-09-17")).toEqual({ start: "2026-09-17", end: "2026-09-24" });
  });
  it("一个月内 = 今天+1 个月−1 天", () => {
    expect(shortcutRange(1, "2026-09-17")).toEqual({ start: "2026-09-17", end: "2026-10-16" });
  });
  it("两个月内 = 今天+2 个月−1 天", () => {
    expect(shortcutRange(2, "2026-09-17")).toEqual({ start: "2026-09-17", end: "2026-11-16" });
  });
  it("跨年：12 月选一个月内", () => {
    expect(shortcutRange(1, "2026-12-08")).toEqual({ start: "2026-12-08", end: "2027-01-07" });
  });
  it("月末钳制：8-31 选一个月内（目标月无 31 日 → 钳 28 再减）", () => {
    expect(shortcutRange(1, "2026-08-31")).toEqual({ start: "2026-08-31", end: "2026-09-29" });
  });
});

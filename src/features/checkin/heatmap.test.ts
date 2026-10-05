// 打卡纯函数单测（PRD 6.11 v1.25；对应 TC-CK-009/010/013 归属规则与 TC-CK-015 分档）。
import { describe, expect, it } from "vitest";
import {
  attributionDate,
  bandRows,
  bucketize,
  dateSeq,
  levelOf,
  monthMarks,
  statsOf,
  weekColumns,
} from "./heatmap";
import { addDays } from "../calendar/dates";
import type { Item } from "../../services/types";

const mk = (over: Partial<Item>): Item => ({
  id: 1,
  category_id: 1,
  title: "t",
  description: null,
  start_date: null,
  start_time: null,
  end_date: null,
  end_time: null,
  due_date: null,
  due_time: null,
  created_at: "",
  is_checkin: false,
  habit_id: null,
  ...over,
});

describe("归属日期：开始优先/截止兜底（TC-CK-009/010/013）", () => {
  it("有开始用开始；仅截止用截止；均空为 null", () => {
    expect(attributionDate(mk({ start_date: "2026-08-01", due_date: "2026-07-01" }))).toBe("2026-08-01");
    expect(attributionDate(mk({ due_date: "2026-07-15" }))).toBe("2026-07-15");
    expect(attributionDate(mk({}))).toBeNull();
  });
});

describe("分桶与档位（TC-CK-015）", () => {
  it("按打卡项×日期计数；多天事项只归开始日一格；未勾打卡不进桶", () => {
    const items = [
      mk({ is_checkin: true, habit_id: 1, start_date: "2026-08-01", end_date: "2026-08-05" }),
      mk({ is_checkin: true, habit_id: 1, start_date: "2026-08-01", end_date: "2026-08-01" }),
      mk({ is_checkin: true, habit_id: 1, due_date: "2026-08-02" }),
      mk({ is_checkin: true, habit_id: 2, start_date: "2026-08-01", end_date: "2026-08-01" }),
      mk({ start_date: "2026-08-03", end_date: "2026-08-03" }),
    ];
    const bucket = bucketize(items);
    expect(bucket.get(1)?.get("2026-08-01")).toBe(2);
    expect(bucket.get(1)?.get("2026-08-02")).toBe(1);
    expect(bucket.get(1)?.get("2026-08-05")).toBeUndefined();
    expect(bucket.get(2)?.get("2026-08-01")).toBe(1);
    expect(bucket.has(5)).toBe(false);
  });

  it("levelOf：0/1/2~3/4+ 四档", () => {
    expect(levelOf(0)).toBe(0);
    expect(levelOf(1)).toBe(1);
    expect(levelOf(3)).toBe(2);
    expect(levelOf(4)).toBe(3);
    expect(levelOf(9)).toBe(3);
  });
});

describe("统计（今日/连续/本月）", () => {
  it("今天有打卡从今天起算；今天无从最近打卡日起算", () => {
    const days = new Map([
      ["2026-08-27", 1],
      ["2026-08-28", 2],
      ["2026-08-30", 1],
      ["2026-08-31", 1],
    ]);
    // today=08-31：08-31、08-30 断档前连续 2 天
    expect(statsOf(days, "2026-08-31")).toEqual({ today: 1, streak: 2, month: 5 });
    // today=09-01（未打卡）：从最近打卡日 08-31 起向前 08-31/08-30 → 2
    expect(statsOf(days, "2026-09-01")).toEqual({ today: 0, streak: 2, month: 0 });
    // 空记录
    expect(statsOf(new Map(), "2026-09-01")).toEqual({ today: 0, streak: 0, month: 0 });
  });
});

describe("热力图几何", () => {
  it("dateSeq 含两端", () => {
    expect(dateSeq("2026-08-30", "2026-09-02")).toEqual(["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
    expect(dateSeq("2026-09-01", "2026-08-31")).toEqual([]);
  });

  it("weekColumns 从 start 所在周一开始、每列一周", () => {
    // 2026-08-31 是周一
    expect(weekColumns("2026-08-31", "2026-08-31")).toEqual(["2026-08-31"]);
    // start=2026-09-02（周三）→ 周一=08-31；end=09-09（周三）→ 列 08-31、09-07
    expect(weekColumns("2026-09-02", "2026-09-09")).toEqual(["2026-08-31", "2026-09-07"]);
  });

  it("monthMarks：每月首列标注；相邻列距<2 去前留后（近1月场景只留主体月）", () => {
    // 近 1 月：第一列 7/27（周一，仅含月末补齐）与第二列 8/3 相邻 → 只留 8月
    const cols = ["2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"];
    expect(monthMarks(cols)).toEqual(new Map([[1, "8月"]]));
    // 常规跨度：每月首列标注；仍相邻的（7月@2 与 8月@3 距 1）去前留后
    const cols2 = ["2026-06-01", "2026-06-29", "2026-07-27", "2026-08-24"];
    expect(monthMarks(cols2)).toEqual(new Map([[0, "6月"], [3, "8月"]]));
  });
});

describe("紧凑热力带分段（v1.26）", () => {
  it("近6月按三个月分段（183 天跨 7 个自然月 → 3 行），总天数不变", () => {
    const end = "2026-10-05";
    const start = addDays(end, -(183 - 1)); // 2026-04-06
    const rows = bandRows(start, end);
    expect(rows.length).toBe(3);
    expect(rows[0].days[0]).toBe(start);
    expect(rows[2].days[rows[2].days.length - 1]).toBe(end);
    const total = rows.reduce((s, r) => s + r.days.length, 0);
    expect(total).toBe(183);
  });

  it("近1年分段，行标签同年省年、单月行只显示一个月", () => {
    const end = "2026-10-05";
    const start = addDays(end, -(365 - 1)); // 2025-10-05
    const rows = bandRows(start, end);
    expect(rows.length).toBe(5);
    expect(rows.map((r) => r.label)).toEqual([
      "2025.10~12",
      "2026.1~3",
      "2026.4~6",
      "2026.7~9",
      "2026.10",
    ]);
    expect(rows.reduce((s, r) => s + r.days.length, 0)).toBe(365);
  });

  it("跨年行标签带两个年（如 2025.11~2026.1）", () => {
    const rows = bandRows("2025-11-15", "2026-02-10");
    expect(rows.length).toBe(2);
    expect(rows[0].label).toBe("2025.11~2026.1");
    expect(rows[0].days[0]).toBe("2025-11-15");
    expect(rows[1].label).toBe("2026.2");
    expect(rows[1].days[rows[1].days.length - 1]).toBe("2026-02-10");
  });
});

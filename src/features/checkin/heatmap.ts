// 打卡视图纯函数（PRD 6.11 v1.25）：归属日期、分桶聚合、4 档色阶、连续/本月统计、
// 热力图周列与月份标注（相邻标签列距<2 去前留后）。展示组件 CheckinView 消费。
import type { Item } from "../../services/types";
import { addDays, weekStartMonday } from "../calendar/dates";

/** 查看范围（v1.25 原型确认）：方块粒度=1 天 */
export type CkRange = "1m" | "3m" | "6m" | "1y";

export const RANGE_DAYS: Record<CkRange, number> = { "1m": 30, "3m": 91, "6m": 183, "1y": 365 };

export const RANGE_LABEL: Record<CkRange, string> = {
  "1m": "近1月",
  "3m": "近3月",
  "6m": "近6月",
  "1y": "近1年",
};

/** 打卡归属日期（PRD 6.11 v1.25）：开始日期优先，开始为空用截止日期；均空返回 null（不参与统计）。 */
export const attributionDate = (it: Pick<Item, "start_date" | "due_date">): string | null =>
  it.start_date || it.due_date || null;

/** 次数→色阶档位：0 无 / 1 次 / 2~3 次 / 4 次+（GitHub 式 4 档）。 */
export const levelOf = (n: number): 0 | 1 | 2 | 3 => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3);

/** 日期序列 [start..end]（含两端，start>end 返回空）。 */
export const dateSeq = (start: string, end: string): string[] => {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
};

/** 打卡事项 → 每打卡项的「日期→次数」分桶（跳过无归属日期的记录）。 */
export const bucketize = (items: Item[]): Map<number, Map<string, number>> => {
  const out = new Map<number, Map<string, number>>();
  for (const it of items) {
    if (!it.is_checkin || it.habit_id === null) continue;
    const d = attributionDate(it);
    if (d === null) continue;
    let m = out.get(it.habit_id);
    if (!m) {
      m = new Map();
      out.set(it.habit_id, m);
    }
    m.set(d, (m.get(d) ?? 0) + 1);
  }
  return out;
};

/** 统计（今日次数 / 连续天数 / 本月次数）；连续天数今天无打卡则从最近打卡日起算。 */
export const statsOf = (
  days: Map<string, number>,
  today: string,
): { today: number; streak: number; month: number } => {
  let month = 0;
  for (const [d, n] of days) if (d.slice(0, 7) === today.slice(0, 7)) month += n;
  const todayCount = days.get(today) ?? 0;
  let streak = 0;
  let cur: string | null = todayCount > 0 ? today : null;
  if (cur === null) {
    // 今天未打卡：从最近一次打卡日向前数
    const sorted = [...days.keys()].sort();
    cur = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  }
  while (cur !== null && (days.get(cur) ?? 0) > 0) {
    streak++;
    cur = addDays(cur, -1);
  }
  return { today: todayCount, streak, month };
};

/** 聚焦大图的周列首日序列：从 start 所在周的周一开始、每列一周，直到覆盖 end（v1.25 原型确认：列=周、行=周一~周日）。 */
export const weekColumns = (start: string, end: string): string[] => {
  const cols: string[] = [];
  for (let d = weekStartMonday(start); d <= end; d = addDays(d, 7)) cols.push(d);
  return cols;
};

/** 月份标注（v1.25 原型确认）：每月首个周列标注；相邻标签列距<2 时去掉前一个、保留数据主体月。 */
export const monthMarks = (cols: string[]): Map<number, string> => {
  const marks: Array<{ col: number; label: string }> = [];
  let lastM = -1;
  cols.forEach((w, i) => {
    const m = Number(w.slice(5, 7));
    if (m !== lastM) {
      marks.push({ col: i, label: `${m}月` });
      lastM = m;
    }
  });
  for (let k = 1; k < marks.length; ) {
    if (marks[k].col - marks[k - 1].col < 2) marks.splice(k - 1, 1);
    else k++;
  }
  return new Map(marks.map((m) => [m.col, m.label]));
};

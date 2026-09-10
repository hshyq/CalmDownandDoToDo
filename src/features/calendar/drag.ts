// 拖拽改期纯函数（PRD 5.3 v1.8）：日历横条平移 / 待办条目拖入日历。
// 时分由调用方原样保留，本模块只负责日期计算。
import { addDays, dayDiff } from "./dates";

/** dataTransfer 自定义类型：区分拖拽来源（日历横条 / 待办条目） */
export const BAR_MIME = "application/x-cal-bar";
export const TODO_MIME = "application/x-cal-todo";

/** 拖拽改期后的起止日期 */
export interface ShiftedDates {
  startDate: string;
  endDate: string;
}

/**
 * 横条拖拽：按 dropDate 相对原开始日期的偏移天数整体平移起止日期（跨度不变）。
 * 例：09-01~09-03 拖到 09-08 → 09-08~09-10；拖回更早日期允许负偏移。
 */
export function shiftRange(startDate: string, endDate: string, dropDate: string): ShiftedDates {
  const offset = dayDiff(startDate, dropDate);
  return { startDate: addDays(startDate, offset), endDate: addDays(endDate, offset) };
}

/** 待办拖入日历：开始=结束=目标格日期（PRD 5.3 v1.8）。 */
export function todoDropDates(dropDate: string): ShiftedDates {
  return { startDate: dropDate, endDate: dropDate };
}

/**
 * 横条头尾拖拽（PRD 5.3 v1.11）：拖左缘改开始日期、拖右缘改结束日期。
 * 钳制：拖头不得越过结束日期，拖尾不得早于开始日期（另一端保持不变）。
 */
export function clampEdge(
  current: ShiftedDates,
  edge: "start" | "end",
  dropDate: string,
): ShiftedDates {
  if (edge === "start") {
    return {
      startDate: dropDate < current.endDate ? dropDate : current.endDate,
      endDate: current.endDate,
    };
  }
  return {
    startDate: current.startDate,
    endDate: dropDate > current.startDate ? dropDate : current.startDate,
  };
}

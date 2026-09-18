// 拖拽改期纯函数（PRD 5.3 v1.8）：日历横条平移 / 待办条目拖入日历。
// 时分由调用方原样保留，本模块只负责日期计算。
import { addDays, dayDiff } from "./dates";
import type { Item, ItemDraft } from "../../services/types";

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
 * 日历横条拖入待办面板的数据变更（PRD 5.2 v1.16，用户确认）：
 * 结束日期→截止日期、结束时刻→截止时刻，结束日期/时刻清空，开始信息保留；
 * 返回完整 ItemDraft（update_item 为全字段更新，必须携带全部现有字段，仅 fieldValues 不传以保留）。
 */
export function calendarToTodoDraft(it: Item): ItemDraft {
  return {
    categoryId: it.category_id,
    title: it.title,
    description: it.description,
    startDate: it.start_date,
    startTime: it.start_time,
    endDate: null,
    endTime: null,
    dueDate: it.end_date,
    dueTime: it.end_time,
  };
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

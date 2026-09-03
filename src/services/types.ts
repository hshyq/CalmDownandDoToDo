// 与 Rust 结构体对齐的前端类型（AGENTS：禁止 any，两侧行为必须对齐）。

/** 分类（对应 `store::categories::Category`） */
export interface Category {
  id: number;
  name: string;
  color: string;
  sort_order: number;
  kind: "normal" | "uncategorized";
}

export const OVERVIEW = "overview" as const;
export type TabId = number | typeof OVERVIEW;

export type DeleteMode = "cascade" | "move_to_uncategorized";
/** 日历查询结果（对应 store::CalendarItem；起止日期均非空） */
export interface CalendarItem {
  id: number;
  category_id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string;
  end_time: string | null;
}

export function isCalendarItemArr(v: unknown): v is CalendarItem[] {
  if (!Array.isArray(v)) return false;
  return v.every((x) => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as Record<string, unknown>;
    return typeof o.id === "number" && typeof o.title === "string" && typeof o.start_date === "string";
  });
}

/** 事项（对应 store::items::Item；null=未填） */
export interface Item {
  id: number;
  category_id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  due_date: string | null;
  due_time: string | null;
  created_at: string;
}

/** 新增/编辑表单载荷（对应 commands::items::ItemDraft，camelCase） */
export interface ItemDraft {
  categoryId: number;
  title: string;
  description: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  dueDate: string | null;
  dueTime: string | null;
}

/** 日历归属：起止日期都填（PRD 5.1） */
export function isCalendarItem(it: Pick<Item, "start_date" | "end_date">): boolean {
  return !!it.start_date && !!it.end_date;
}

export function isItem(v: unknown): v is Item {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "number" && typeof o.title === "string" && typeof o.category_id === "number";
}

export function isItemArray(v: unknown): v is Item[] {
  return Array.isArray(v) && v.every(isItem);
}


/** 判断 IPC 返回是否为分类（运行时防御，禁止 any）。 */
export function isCategory(v: unknown): v is Category {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "number" &&
    typeof o.name === "string" &&
    typeof o.color === "string" &&
    typeof o.sort_order === "number" &&
    (o.kind === "normal" || o.kind === "uncategorized")
  );
}

export function isCategoryArray(v: unknown): v is Category[] {
  return Array.isArray(v) && v.every(isCategory);
}
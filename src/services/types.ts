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
/** 待办查询结果（对应 store::TodoItem；截止可空=「长期规划」沉底） */
export interface TodoItem {
  id: number;
  category_id: number;
  title: string;
  due_date: string | null;
  due_time: string | null;
  created_at: string;
}

export function isTodoItemArr(v: unknown): v is TodoItem[] {
  if (!Array.isArray(v)) return false;
  return v.every((x) => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as Record<string, unknown>;
    return typeof o.id === "number" && typeof o.title === "string";
  });
}

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
  /** 当前分类模板字段值（P6：仅覆盖当前模板字段，切分类不迁移旧值，PRD 4.3） */
  fieldValues?: FieldValuePayload[];
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

// ===== P6 自定义字段（PRD 4.3/6.5/6.6；与 store::fields::FieldDef / fieldconvert 对齐） =====

/** 六种字段类型（对应 FieldType::as_str） */
export type FieldType =
  | "text"
  | "multiline"
  | "number"
  | "date"
  | "single_choice"
  | "multi_choice";

/** 字段类型中文名（原型 TYPE_LABEL） */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "单行文本",
  multiline: "多行文本",
  number: "数字",
  date: "日期",
  single_choice: "单选",
  multi_choice: "多选",
};

/** 字段模板（对应 store::fields::FieldDef；options_json 为 JSON 数组文本，仅单选/多选有） */
export interface FieldDef {
  id: number;
  category_id: number;
  name: string;
  type: FieldType;
  options_json: string | null;
  sort_order: number;
}

export function isFieldDef(v: unknown): v is FieldDef {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "number" &&
    typeof o.category_id === "number" &&
    typeof o.name === "string" &&
    typeof o.type === "string" &&
    (o.type === "text" || o.type === "multiline" || o.type === "number" ||
      o.type === "date" || o.type === "single_choice" || o.type === "multi_choice") &&
    (o.options_json === null || typeof o.options_json === "string") &&
    typeof o.sort_order === "number"
  );
}

export function isFieldDefArray(v: unknown): v is FieldDef[] {
  return Array.isArray(v) && v.every(isFieldDef);
}

/** 事项字段值行（对应 commands::fields::FieldValueRow；value_json 为 JSON 文本，null=无值） */
export interface FieldValueRow {
  field_def_id: number;
  value_json: string | null;
}

export function isFieldValueRowArray(v: unknown): v is FieldValueRow[] {
  if (!Array.isArray(v)) return false;
  return v.every((x) => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as Record<string, unknown>;
    return typeof o.field_def_id === "number" &&
      (o.value_json === null || typeof o.value_json === "string");
  });
}

/** 事项新增/编辑载荷中的字段值（对应 commands::items::FieldValuePayload；后端 serde camelCase，故字段名为 fieldDefId；value=value_json 文本，null=清空） */
export interface FieldValuePayload {
  fieldDefId: number;
  value: string | null;
}


// ===== P7 撤销/重做（对应 commands::undo::UndoDepthPayload） =====

/** 撤销栈深度（Rust → 前端刷新按钮态）。 */
export interface UndoDepth {
  undo: number;
  redo: number;
}

export function isUndoDepth(v: unknown): v is UndoDepth {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.undo === "number" && typeof o.redo === "number";
}

// ===== 日期类型（PRD 5.5 v1.12；对应 store::daytypes::DayTypeRow） =====

/** 日期类型值：工作日 / 休息日 / 法定假日（仅存覆盖项，未指定按星期推算）。 */
export type DayType = "work" | "rest" | "holiday";

/** 日期类型角标中文名与循环顺序（默认→班→休→假→默认）。 */
export const DAY_TYPE_LABELS: Record<DayType, string> = {
  work: "班",
  rest: "休",
  holiday: "假",
};

/** 日期类型覆盖行（date=YYYY-MM-DD）。 */
export interface DayTypeRow {
  date: string;
  day_type: DayType;
}

export function isDayTypeRowArray(v: unknown): v is DayTypeRow[] {
  if (!Array.isArray(v)) return false;
  return v.every((x) => {
    if (typeof x !== "object" || x === null) return false;
    const o = x as Record<string, unknown>;
    return (
      typeof o.date === "string" &&
      (o.day_type === "work" || o.day_type === "rest" || o.day_type === "holiday")
    );
  });
}

/** 未指定时的默认推算：周六日=休息日，其余=工作日（PRD 5.5）。 */
export function defaultDayType(date: string): DayType {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday === 0 || weekday === 6 ? "rest" : "work";
}

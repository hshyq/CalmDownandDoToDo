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
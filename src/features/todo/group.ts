// 待办分组纯函数（PRD 5.2）：按截止年月分组；无截止=「长期规划」沉底。
import type { TodoItem } from "../../services/types";

export const LONG_TERM = "长期规划";
const LONG_TERM_KEY = "__longterm__";

export interface TodoGroup {
  key: string; // YYYY-MM 或 __longterm__
  label: string; // 2026-08 或 长期规划
  items: TodoItem[];
}

/** 保持传入顺序（store 已按 截止日期/时刻/created_at 排序），仅按年月切组并让长期规划沉底。 */
export function groupTodos(items: readonly TodoItem[]): TodoGroup[] {
  const map = new Map<string, TodoGroup>();
  for (const it of items) {
    const key = it.due_date ? it.due_date.slice(0, 7) : LONG_TERM_KEY;
    const label = it.due_date ? it.due_date.slice(0, 7) : LONG_TERM;
    const g = map.get(key);
    if (g) g.items.push(it);
    else map.set(key, { key, label, items: [it] });
  }
  const groups: TodoGroup[] = [];
  const longTerm = map.get(LONG_TERM_KEY);
  for (const [key, g] of map) {
    if (key !== LONG_TERM_KEY) groups.push(g);
  }
  groups.sort((a, b) => a.key.localeCompare(b.key));
  if (longTerm) groups.push(longTerm);
  return groups;
}
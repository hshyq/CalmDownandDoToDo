// 浏览器预览（非 Tauri）时的分类模拟数据，语义与后端 seed 一致（PRD 4.1）。
import type { CalendarItem, Category, DeleteMode, Item, ItemDraft } from "./types";

const seed: Category[] = [
  { id: 1, name: "生活", color: "#34B96F", sort_order: 0, kind: "normal" },
  { id: 2, name: "工作", color: "#4F8EF7", sort_order: 1, kind: "normal" },
  { id: 3, name: "娱乐", color: "#F5A623", sort_order: 2, kind: "normal" },
  { id: 4, name: "学习", color: "#9B59B6", sort_order: 3, kind: "normal" },
  { id: 5, name: "未分类", color: "#9E9E9E", sort_order: 1000, kind: "uncategorized" },
];

let seq = 100;
let cats: Category[] = [...seed];

const clone = (): Category[] => cats.map((c) => ({ ...c }));

export const mockApi = {
  async list(): Promise<Category[]> {
    return clone().sort((a, b) => a.sort_order - b.sort_order);
  },
  async create(name: string, color: string): Promise<Category> {
    const sort_order = Math.max(0, ...cats.map((c) => c.sort_order)) + 1;
    const c: Category = { id: seq++, name, color, sort_order, kind: "normal" };
    cats.push(c);
    return { ...c };
  },
  async rename(id: number, name: string): Promise<void> {
    cats = cats.map((c) => (c.id === id ? { ...c, name } : c));
  },
  async setColor(id: number, color: string): Promise<void> {
    cats = cats.map((c) => (c.id === id ? { ...c, color } : c));
  },
  async countItems(_categoryId: number): Promise<number> {
    return 0; // 预览模式无事项数据，恒 0（删除走直接确认）
  },
  async remove(id: number, _mode: DeleteMode): Promise<void> {
    cats = cats.filter((c) => c.id !== id);
  },
  /** 仅预览用：重置为种子（开发调试）。 */
  reset(): void {
    cats = [...seed];
  },
};

let itemSeq = 1;
let items: Item[] = [];

export const mockItemApi = {
  async list(categoryId: number | null): Promise<Item[]> {
    const now = new Date().toISOString();
    return items
      .filter((it) => categoryId === null || it.category_id === categoryId)
      .map((it) => ({ ...it, created_at: it.created_at || now }));
  },
  async create(draft: ItemDraft): Promise<Item> {
    const it: Item = {
      id: itemSeq++,
      category_id: draft.categoryId,
      title: draft.title,
      description: draft.description,
      start_date: draft.startDate,
      start_time: draft.startTime,
      end_date: draft.endDate,
      end_time: draft.endTime,
      due_date: draft.dueDate,
      due_time: draft.dueTime,
      created_at: new Date().toISOString(),
    };
    items.push(it);
    return { ...it };
  },
  async update(id: number, draft: ItemDraft): Promise<Item> {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) throw new Error("事项不存在");
    const it = { ...items[idx], category_id: draft.categoryId, title: draft.title,
      description: draft.description, start_date: draft.startDate, start_time: draft.startTime,
      end_date: draft.endDate, end_time: draft.endTime, due_date: draft.dueDate, due_time: draft.dueTime };
    items[idx] = it;
    return { ...it };
  },
  async remove(id: number): Promise<void> {
    items = items.filter((i) => i.id !== id);
  },
  async calendar(viewStart: string, viewEnd: string, categoryId: number | null): Promise<CalendarItem[]> {
    return items
      .filter((it) => it.start_date && it.end_date &&
        it.start_date <= viewEnd && it.end_date >= viewStart &&
        (categoryId === null || it.category_id === categoryId))
      .map((it) => ({ id: it.id, category_id: it.category_id, title: it.title,
        start_date: it.start_date!, start_time: it.start_time, end_date: it.end_date!, end_time: it.end_time }));
  },
  async getDetail(id: number): Promise<Item> {
    const it = items.find((x) => x.id === id);
    if (!it) throw new Error("事项不存在");
    return { ...it };
  },

};

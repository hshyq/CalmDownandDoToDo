// 浏览器预览（非 Tauri）时的分类模拟数据，语义与后端 seed 一致（PRD 4.1）。
import type { CalendarItem, Category, DeleteMode, Habit, Item, ItemDraft } from "./types";

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
      is_checkin: draft.isCheckin ?? false,
      habit_id: draft.habitId ?? null,
    };
    items.push(it);
    return { ...it };
  },
  async update(id: number, draft: ItemDraft): Promise<Item> {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) throw new Error("事项不存在");
    const it = { ...items[idx], category_id: draft.categoryId, title: draft.title,
      description: draft.description, start_date: draft.startDate, start_time: draft.startTime,
      end_date: draft.endDate, end_time: draft.endTime, due_date: draft.dueDate, due_time: draft.dueTime,
      is_checkin: draft.isCheckin ?? false,
      habit_id: draft.habitId !== undefined ? draft.habitId : items[idx].habit_id };
    items[idx] = it;
    return { ...it };
  },
  async remove(id: number): Promise<void> {
    items = items.filter((i) => i.id !== id);
  },
  // 批量删除（PRD 6.10 v1.23）：mock 预览与真实 IPC 行为对齐（返回实际删除条数）
  async removeBatch(ids: number[]): Promise<number> {
    const set = new Set(ids);
    const before = items.length;
    items = items.filter((i) => !set.has(i.id));
    return before - items.length;
  },
  // 打卡视图数据（PRD 6.11 v1.25）：归属日期（开始优先/截止兜底）在范围内
  async checkins(start: string, end: string): Promise<Item[]> {
    return items
      .filter((it) => {
        if (!it.is_checkin || it.habit_id === null) return false;
        const d = it.start_date || it.due_date;
        return d !== null && d >= start && d <= end;
      })
      .slice()
      .sort((a, b) => (b.start_date || b.due_date || "").localeCompare(a.start_date || a.due_date || ""));
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

// ===== 打卡项 mock（PRD 6.11 v1.25；浏览器预览与真实 IPC 行为对齐） =====
let habitSeq = 1;
let habits: Habit[] = [];

export const mockHabitApi = {
  async list(): Promise<Habit[]> {
    return habits.map((h) => ({ ...h }));
  },
  async create(name: string, color: string): Promise<Habit> {
    const n = name.trim();
    if (!n) throw new Error("打卡项名称不能为空");
    if (habits.some((h) => h.name === n)) throw new Error("已存在同名打卡项");
    const h: Habit = {
      id: habitSeq++,
      name: n,
      color,
      sort_order: habits.length,
      created_at: new Date().toISOString(),
      template_json: null,
    };
    habits.push(h);
    return { ...h };
  },
  async rename(id: number, name: string): Promise<void> {
    const n = name.trim();
    if (!n) throw new Error("打卡项名称不能为空");
    if (habits.some((h) => h.name === n && h.id !== id)) throw new Error("已存在同名打卡项");
    const h = habits.find((x) => x.id === id);
    if (!h) throw new Error("打卡项不存在");
    h.name = n;
  },
  async setColor(id: number, color: string): Promise<void> {
    const h = habits.find((x) => x.id === id);
    if (!h) throw new Error("打卡项不存在");
    h.color = color;
  },
  async setTemplate(id: number, json: string | null): Promise<void> {
    const h = habits.find((x) => x.id === id);
    if (!h) throw new Error("打卡项不存在");
    if (json !== null && json.trim() !== "") JSON.parse(json); // 与后端同步的可解析校验
    h.template_json = json !== null && json.trim() === "" ? null : json;
  },
  async remove(id: number): Promise<number> {
    let n = 0;
    items = items.map((it) => {
      if (it.habit_id === id && it.is_checkin) {
        n++;
        return { ...it, is_checkin: false, habit_id: null };
      }
      return it;
    });
    habits = habits.filter((h) => h.id !== id);
    return n;
  },
};

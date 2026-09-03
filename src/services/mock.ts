// 浏览器预览（非 Tauri）时的分类模拟数据，语义与后端 seed 一致（PRD 4.1）。
import type { Category, DeleteMode } from "./types";

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
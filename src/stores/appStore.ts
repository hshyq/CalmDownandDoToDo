// 全局 UI 状态（zustand，P2/P3：分类、标签、事项列表）。
import { create } from "zustand";
import { categoryApi, itemApi, inTauri } from "../services/ipc";
import { mockApi, mockItemApi } from "../services/mock";
import type { Category, DeleteMode, Item, ItemDraft, TabId } from "../services/types";

const categorySource = inTauri() ? categoryApi : mockApi;
const itemSource = inTauri() ? itemApi : mockItemApi;

interface AppStore {
  categories: Category[];
  items: Item[];
  activeTab: TabId;
  ready: boolean;
  /** 数据版本号：事项/分类写操作后递增，供日历/待办跨面板刷新（P5 引入） */
  dataVersion: number;
  bump: () => void;
  load: () => Promise<void>;
  switchTab: (tab: TabId) => void;
  create: (name: string, color: string) => Promise<void>;
  rename: (id: number, name: string) => Promise<void>;
  setColor: (id: number, color: string) => Promise<void>;
  remove: (id: number, mode: DeleteMode) => Promise<void>;
  loadItems: () => Promise<void>;
  createItem: (draft: ItemDraft) => Promise<void>;
  updateItem: (id: number, draft: ItemDraft) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
}

/** 当前标签的分类过滤：总览=null（全部）。 */
function scopeOf(activeTab: TabId): number | null {
  return activeTab === "overview" ? null : activeTab;
}

export const useAppStore = create<AppStore>((set, get) => ({
  categories: [],
  items: [],
  activeTab: "overview",
  ready: false,
  dataVersion: 0,
  bump() {
    set((s) => ({ dataVersion: s.dataVersion + 1 }));
  },
  async load() {
    const categories = await categorySource.list();
    set({ categories, ready: true });
  },
  switchTab(tab) {
    set({ activeTab: tab });
  },
  async create(name, color) {
    await categorySource.create(name, color);
    set({ categories: await categorySource.list() });
  },
  async rename(id, name) {
    await categorySource.rename(id, name);
    set({ categories: await categorySource.list() });
  },
  async setColor(id, color) {
    await categorySource.setColor(id, color);
    set({ categories: await categorySource.list() });
  },
  async remove(id, mode) {
    await categorySource.remove(id, mode);
    const active = get().activeTab;
    if (active === id) set({ activeTab: "overview" });
    set({ categories: await categorySource.list() });
    await get().loadItems();
    get().bump();
  },
  async loadItems() {
    const { activeTab } = get();
    const items = await itemSource.list(scopeOf(activeTab));
    set({ items });
  },
  async createItem(draft) {
    await itemSource.create(draft);
    await get().loadItems();
    get().bump();
  },
  async updateItem(id, draft) {
    await itemSource.update(id, draft);
    // 编辑可换分类：若切走，当前列表不再包含 → 刷新后由 activeTab 过滤
    await get().loadItems();
    get().bump();
  },
  async deleteItem(id) {
    await itemSource.remove(id);
    await get().loadItems();
    get().bump();
  },
}));

// 全局 UI 状态（zustand，P2：分类与标签）。
import { create } from "zustand";
import { categoryApi } from "../services/ipc";
import { mockApi } from "../services/mock";
import { inTauri } from "../services/ipc";
import type { Category, DeleteMode, TabId } from "../services/types";

const api = inTauri() ? categoryApi : mockApi;

interface AppStore {
  categories: Category[];
  activeTab: TabId;
  ready: boolean;
  load: () => Promise<void>;
  switchTab: (tab: TabId) => void;
  create: (name: string, color: string) => Promise<void>;
  rename: (id: number, name: string) => Promise<void>;
  setColor: (id: number, color: string) => Promise<void>;
  remove: (id: number, mode: DeleteMode) => Promise<void>;
}

export const useAppStore = create<AppStore>((set) => ({
  categories: [],
  activeTab: "overview",
  ready: false,
  async load() {
    const categories = await api.list();
    set({ categories, ready: true });
  },
  switchTab(tab) {
    set({ activeTab: tab });
  },
  async create(name, color) {
    await api.create(name, color);
    set({ categories: await api.list() });
  },
  async rename(id, name) {
    await api.rename(id, name);
    set({ categories: await api.list() });
  },
  async setColor(id, color) {
    await api.setColor(id, color);
    set({ categories: await api.list() });
  },
  async remove(id, mode) {
    await api.remove(id, mode);
    if (useAppStore.getState().activeTab === id) {
      set({ activeTab: "overview" });
    }
    set({ categories: await api.list() });
  },
}));
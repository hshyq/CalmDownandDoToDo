// 撤销/重做按钮态（镜像 Rust undo 栈，P7）。深度变化经 undo-depth 事件同步；
// undo/redo 成功后刷新分类/事项并 bump 数据版本，驱动日历/待办跨面板重查。
import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { inTauri, undoApi } from "../services/ipc";
import { useAppStore } from "./appStore";
import type { UndoDepth } from "../services/types";

interface UndoStore {
  canUndo: boolean;
  canRedo: boolean;
  /** 初始化：监听深度事件并查询当前深度（幂等，仅 Tauri 内生效）。 */
  init: () => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  setDepth: (d: UndoDepth) => void;
}

let initStarted = false;

/** 撤销/重做改变的是数据库数据：刷新分类与当前列表并 bump，让日历/待办视图重新查询。 */
async function refreshAll(): Promise<void> {
  const app = useAppStore.getState();
  await app.load();
  await app.loadItems();
  app.bump();
}

async function refreshDepth(): Promise<void> {
  try {
    useUndoStore.getState().setDepth(await undoApi.depth());
  } catch {
    /* 深度查询失败不阻塞后续操作 */
  }
}

export const useUndoStore = create<UndoStore>((set, get) => ({
  canUndo: false,
  canRedo: false,
  async init() {
    if (initStarted) return;
    initStarted = true;
    if (!inTauri()) return;
    try {
      await listen<UndoDepth>("undo-depth", (e) => get().setDepth(e.payload));
    } catch {
      /* 事件订阅失败时按钮态依赖主动刷新兜底 */
    }
    await refreshDepth();
  },
  async undo() {
    if (!get().canUndo) return;
    await undoApi.undo();
    await refreshAll();
    await refreshDepth();
  },
  async redo() {
    if (!get().canRedo) return;
    await undoApi.redo();
    await refreshAll();
    await refreshDepth();
  },
  setDepth(d) {
    set({ canUndo: d.undo > 0, canRedo: d.redo > 0 });
  },
}));

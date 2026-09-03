// IPC 封装：invoke + 错误统一转中文友好提示（AGENTS 第 5 节）。
import { invoke } from "@tauri-apps/api/core";
import type { Category, DeleteMode } from "./types";
import { isCategory, isCategoryArray } from "./types";

/** 当前是否运行在 Tauri 窗口内（浏览器预览时走 mock）。 */
export const inTauri = (): boolean => "__TAURI_INTERNALS__" in window;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    // 后端已返回中文提示；未知异常兜底
    const msg = typeof e === "string" ? e : e instanceof Error ? e.message : "操作失败，请重试";
    throw new Error(msg);
  }
}

export const categoryApi = {
  async list(): Promise<Category[]> {
    const v = await call<unknown>("list_categories");
    if (!isCategoryArray(v)) throw new Error("分类数据格式异常");
    return v;
  },
  async create(name: string, color: string): Promise<Category> {
    const v = await call<unknown>("create_category", { name, color });
    if (!isCategory(v)) throw new Error("分类数据格式异常");
    return v;
  },
  async rename(id: number, name: string): Promise<void> {
    await call<void>("rename_category", { id, name });
  },
  async setColor(id: number, color: string): Promise<void> {
    await call<void>("set_category_color", { id, color });
  },
  async countItems(categoryId: number): Promise<number> {
    const v = await call<unknown>("count_items_in_category", { categoryId });
    return typeof v === "number" ? v : 0;
  },
  async remove(id: number, mode: DeleteMode): Promise<void> {
    await call<void>("delete_category", { id, mode });
  },
};
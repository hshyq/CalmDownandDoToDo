// IPC 封装：invoke + 错误统一转中文友好提示（AGENTS 第 5 节）。
import { invoke } from "@tauri-apps/api/core";
import type { CalendarItem, Category, DeleteMode, FieldDef, FieldValueRow, Item, ItemDraft, TodoItem, UndoDepth } from "./types";
import {
  isCalendarItemArr,
  isCategory,
  isCategoryArray,
  isItem,
  isItemArray,
  isTodoItemArr,  isFieldDef,  isFieldDefArray,  isFieldValueRowArray,  isUndoDepth,
} from "./types";

/** 当前是否运行在 Tauri 窗口内（浏览器预览时走 mock）。 */
export const inTauri = (): boolean => "__TAURI_INTERNALS__" in window;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    const msg =
      typeof e === "string" ? e : e instanceof Error ? e.message : "操作失败，请重试";
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

export const itemApi = {
  async calendar(
    viewStart: string,
    viewEnd: string,
    categoryId: number | null,
  ): Promise<CalendarItem[]> {
    const v = await call<unknown>("list_calendar_items", { viewStart, viewEnd, categoryId });
    if (!isCalendarItemArr(v)) throw new Error("日历数据格式异常");
    return v;
  },
  async todo(categoryId: number | null): Promise<TodoItem[]> {
    const v = await call<unknown>("list_todo_items", { categoryId });
    if (!isTodoItemArr(v)) throw new Error("待办数据格式异常");
    return v;
  },
  async getDetail(id: number): Promise<Item> {
    const v = await call<unknown>("get_item_detail", { id });
    if (!isItem(v)) throw new Error("事项数据格式异常");
    return v;
  },
  async list(categoryId: number | null): Promise<Item[]> {
    const v = await call<unknown>("list_items", { categoryId });
    if (!isItemArray(v)) throw new Error("事项数据格式异常");
    return v;
  },
  async create(draft: ItemDraft): Promise<Item> {
    const v = await call<unknown>("create_item", { draft });
    if (!isItem(v)) throw new Error("事项数据格式异常");
    return v;
  },
  async update(id: number, draft: ItemDraft): Promise<Item> {
    const v = await call<unknown>("update_item", { id, draft });
    if (!isItem(v)) throw new Error("事项数据格式异常");
    return v;
  },
  async remove(id: number): Promise<void> {
    await call<void>("delete_item", { id });
  },
};


/** 自定义字段 IPC（对应 commands::fields，PRD 4.3/6.5/6.6；命令参数经 Tauri camelCase→snake_case 转换）。 */
export const fieldApi = {
  /** 分类字段模板（按 sort_order 升序）。 */
  async list(categoryId: number): Promise<FieldDef[]> {
    const v = await call<unknown>("list_fields", { categoryId });
    if (!isFieldDefArray(v)) throw new Error("字段数据格式异常");
    return v;
  },
  /** 新建字段；单选/多选必须带非空 options。 */
  async create(categoryId: number, name: string, fieldType: string, options: string[] | null): Promise<FieldDef> {
    const v = await call<unknown>("create_field", { categoryId, name, fieldType, options });
    if (!isFieldDef(v)) throw new Error("字段数据格式异常");
    return v;
  },
  async rename(id: number, name: string): Promise<void> {
    await call<void>("rename_field", { id, name });
  },
  async remove(id: number): Promise<void> {
    await call<void>("delete_field", { id });
  },
  /** 编辑选项列表（单选/多选）：不在新选项内的已填值被清空（PRD 6.5）。 */
  async setOptions(id: number, options: string[]): Promise<void> {
    await call<void>("set_field_options", { id, options });
  },
  /** 一次字段编辑保存（改名/改类型/选项）= 一步撤销（P7，后端 save_field 复合命令）。 */
  async saveField(id: number, name: string, newType: string | null, options: string[] | null): Promise<void> {
    await call<void>("save_field", { id, name, newType, options });
  },
  /** 修改类型：按 6.6 矩阵迁移历史值（计入撤销栈）。 */
  async changeType(id: number, fieldType: string): Promise<void> {
    await call<void>("change_field_type", { id, fieldType });
  },
  /** 上移/下移（direction: "up" | "down"）。 */
  async move(id: number, direction: "up" | "down"): Promise<void> {
    await call<void>("move_field", { id, direction });
  },
  /** 某事项全部字段值（跨分类保留，PRD 4.3；展示层按当前分类模板过滤）。 */
  async listItemValues(itemId: number): Promise<FieldValueRow[]> {
    const v = await call<unknown>("list_item_field_values", { itemId });
    if (!isFieldValueRowArray(v)) throw new Error("字段值数据格式异常");
    return v;
  },
};


/** 撤销/重做 IPC（PRD 6.7；深度变化由后端 emit undo-depth 事件同步按钮态）。 */
export const undoApi = {
  async undo(): Promise<void> {
    await call<void>("undo");
  },
  async redo(): Promise<void> {
    await call<void>("redo");
  },
  async depth(): Promise<UndoDepth> {
    const v = await call<unknown>("undo_depth");
    if (!isUndoDepth(v)) throw new Error("撤销深度数据格式异常");
    return v;
  },
};




/** 备份 IPC（PRD 6.8：路径由 tauri-plugin-dialog 提供；导入整库替换计入撤销栈）。 */
export const backupApi = {
  /** 默认导出路径（data\backups\日历待办备份_<时间>.json），供「另存为」默认文件名。 */
  async defaultPath(): Promise<string> {
    const v = await call<unknown>("default_backup_path");
    return typeof v === "string" ? v : "";
  },
  /** 导出备份到指定路径。 */
  async export(path: string): Promise<void> {
    await call<void>("export_backup", { path });
  },
  /** 导入备份（整库替换；导入前状态可撤销）。 */
  async import(path: string): Promise<void> {
    await call<void>("import_backup", { path });
  },
};

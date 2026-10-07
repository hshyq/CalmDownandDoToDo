// 列表拖拽排序 hook（v1.28 ①④）：HTML5 DnD，落点上下半区决定插前/插后。
// 重排逻辑在 features/dnd/reorder.ts 纯函数；本 hook 只管理拖拽状态与事件绑定。
import { useState } from "react";
import { isBeforeHalf } from "./reorder";

export interface ListDragApi {
  /** 当前拖拽项 id（无拖拽为 null）。 */
  dragId: number | null;
  /** 当前悬停目标与插入方位（指示线渲染依据）。 */
  over: { id: number; before: boolean } | null;
  onDragStart: (id: number) => (e: React.DragEvent) => void;
  onDragOver: (id: number) => (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (id: number) => (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

/**
 * @param canDrag 该 id 是否允许拖拽（如总览/未分类固定不可拖）
 * @param onReorder 拖拽落定回调（fromId、toId、before），仅当 from≠to 时触发
 */
export function useListDrag(
  canDrag: (id: number) => boolean,
  onReorder: (fromId: number, toId: number, before: boolean) => void,
): ListDragApi {
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<{ id: number; before: boolean } | null>(null);

  const clear = () => {
    setDragId(null);
    setOver(null);
  };

  return {
    dragId,
    over,
    onDragStart: (id) => (e) => {
      if (!canDrag(id)) return;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(id));
      setDragId(id);
    },
    onDragOver: (id) => (e) => {
      if (dragId === null || dragId === id || !canDrag(id)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      setOver({ id, before: isBeforeHalf(e.clientY, rect.top, rect.height) });
    },
    onDragLeave: () => setOver(null),
    onDrop: (id) => (e) => {
      e.preventDefault();
      const from = dragId;
      const before = over?.before ?? true;
      clear();
      if (from !== null && from !== id) onReorder(from, id, before);
    },
    onDragEnd: clear,
  };
}

/** 指示线 class：over 目标行按方位返回 drop-before / drop-after。 */
export function dropLineClass(over: { id: number; before: boolean } | null, id: number): string {
  if (!over || over.id !== id) return "";
  return over.before ? "drop-before" : "drop-after";
}

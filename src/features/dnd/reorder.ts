// 列表拖拽重排纯函数（v1.28 ①④：打卡项/左侧分类共用）。
// 拖拽落点在目标行上/下半区 → 插到其前/后；重排不修改原数组。

/**
 * 将 fromId 项移到 toId 项之前（before=true）或之后，返回新数组。
 * fromId/toId 相同、任一不存在时返回 null（表示无需重排/非法）。
 */
export function reorderById<T extends { id: number }>(
  list: readonly T[],
  fromId: number,
  toId: number,
  before: boolean,
): T[] | null {
  if (fromId === toId) return null;
  const from = list.findIndex((x) => x.id === fromId);
  if (from < 0) return null;
  const to = list.findIndex((x) => x.id === toId);
  if (to < 0) return null;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  let target = next.findIndex((x) => x.id === toId);
  if (!before) target += 1;
  next.splice(target, 0, moved);
  return next;
}

/** 拖拽落点是否在目标行上半区（决定插到该行之前/之后）。 */
export function isBeforeHalf(eY: number, elTop: number, elHeight: number): boolean {
  return eY - elTop < elHeight / 2;
}

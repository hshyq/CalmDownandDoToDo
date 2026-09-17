// 待办当前时间线纯函数（PRD 5.2 v1.15；TC-DUE-010）。

/**
 * 当前时间线插入序号：按截止时间升序的条目流中，「截止日 ≤ today」的最后一条之后；
 * 全部条目在未来（或无条目）时返回 0，即插在列表最顶部。无截止（长期规划哨兵
 * 9999-12-31 恒大于今天）不计入，故永远在线下方。
 */
export const nowLineIndex = (todos: { due_date?: string | null }[], today: string): number => {
  let idx = 0;
  todos.forEach((t, i) => {
    if (t.due_date && t.due_date <= today) idx = i + 1;
  });
  return idx;
};

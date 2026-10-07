import { describe, expect, it } from "vitest";
import { isBeforeHalf, reorderById } from "./reorder";

describe("reorderById（v1.28 拖拽重排）", () => {
  const list = [
    { id: 1, name: "甲" },
    { id: 2, name: "乙" },
    { id: 3, name: "丙" },
    { id: 4, name: "丁" },
  ];

  it("插到目标之前：1 → 3 前", () => {
    expect(reorderById(list, 1, 3, true)).toEqual([
      { id: 2, name: "乙" },
      { id: 1, name: "甲" },
      { id: 3, name: "丙" },
      { id: 4, name: "丁" },
    ]);
  });

  it("插到目标之后：1 → 3 后", () => {
    expect(reorderById(list, 1, 3, false)).toEqual([
      { id: 2, name: "乙" },
      { id: 3, name: "丙" },
      { id: 1, name: "甲" },
      { id: 4, name: "丁" },
    ]);
  });

  it("向下拖：4 → 2 前", () => {
    expect(reorderById(list, 4, 2, true)?.map((x) => x.id)).toEqual([1, 4, 2, 3]);
  });

  it("相邻向后拖：2 → 3 后不跳位", () => {
    expect(reorderById(list, 2, 3, false)?.map((x) => x.id)).toEqual([1, 3, 2, 4]);
  });

  it("原数组不被修改", () => {
    reorderById(list, 1, 4, true);
    expect(list.map((x) => x.id)).toEqual([1, 2, 3, 4]);
  });

  it("同 id / 未知 id 返回 null", () => {
    expect(reorderById(list, 2, 2, true)).toBeNull();
    expect(reorderById(list, 9, 2, true)).toBeNull();
    expect(reorderById(list, 1, 9, false)).toBeNull();
  });
});

describe("isBeforeHalf（落点上下半区）", () => {
  it("上半区 true / 下半区 false / 中点归下半区", () => {
    expect(isBeforeHalf(110, 100, 40)).toBe(true);
    expect(isBeforeHalf(130, 100, 40)).toBe(false);
    expect(isBeforeHalf(120, 100, 40)).toBe(false);
  });
});

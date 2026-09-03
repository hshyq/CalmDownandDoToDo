import { describe, expect, it } from "vitest";
import { groupTodos, LONG_TERM } from "./group";
import type { TodoItem } from "../../services/types";

const t = (id: number, due: string | null, time: string | null): TodoItem => ({
  id, category_id: 2, title: "事项" + id, due_date: due, due_time: time, created_at: "t",
});

describe("待办分组（PRD 5.2）", () => {
  it("按年月分组、无截止沉底为长期规划", () => {
    const g = groupTodos([
      t(1, "2026-09-10", "10:00"),
      t(2, null, null),
      t(3, "2026-08-15", null),
      t(4, null, null),
    ]);
    expect(g.map((x) => x.label)).toEqual(["2026-08", "2026-09", LONG_TERM]);
    expect(g[0].items.map((x) => x.id)).toEqual([3]);
    expect(g[1].items.map((x) => x.id)).toEqual([1]);
    expect(g[2].items.map((x) => x.id)).toEqual([2, 4]);
  });

  it("空列表", () => {
    expect(groupTodos([])).toEqual([]);
  });
});
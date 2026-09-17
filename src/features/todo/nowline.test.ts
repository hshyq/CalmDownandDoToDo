// 当前时间线插入位置测试（TC-DUE-010，PRD 5.2 v1.15）。
import { describe, expect, it } from "vitest";
import { nowLineIndex } from "./nowline";

const t = (dd: string | null) => ({ due_date: dd });

describe("nowLineIndex 当前时间线插入序号", () => {
  it("插在截止≤今天的最后一条之后（TC-DUE-010：09-15 与 09-19，今天 09-17）", () => {
    const todos = [t("2026-09-15"), t("2026-09-19")];
    expect(nowLineIndex(todos, "2026-09-17")).toBe(1);
  });
  it("今天截止的条目也在线上方（≤今天）", () => {
    const todos = [t("2026-09-17"), t("2026-09-18")];
    expect(nowLineIndex(todos, "2026-09-17")).toBe(1);
  });
  it("全部在未来 → 插在最顶部（0）", () => {
    expect(nowLineIndex([t("2026-09-18"), t("2026-09-25")], "2026-09-17")).toBe(0);
  });
  it("全部已到期 → 插在最后一条之后", () => {
    expect(nowLineIndex([t("2026-09-01"), t("2026-09-15")], "2026-09-17")).toBe(2);
  });
  it("无截止（长期规划哨兵 9999-12-31）不计入，永远在线下方", () => {
    const todos = [t("2026-09-15"), t("9999-12-31"), t(null)];
    expect(nowLineIndex(todos, "2026-09-17")).toBe(1);
  });
  it("空列表 → 0", () => {
    expect(nowLineIndex([], "2026-09-17")).toBe(0);
  });
});

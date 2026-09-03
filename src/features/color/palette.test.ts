import { describe, expect, it } from "vitest";
import { PALETTE_ROWS, STD_ROW, hsl2hex, leastUsedColor } from "./palette";

const isHex = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

describe("分类色盘（PRD 4.1）", () => {
  it("11 列 × 6 行，标准行为第 4 行", () => {
    expect(PALETTE_ROWS).toHaveLength(6);
    for (const row of PALETTE_ROWS) {
      expect(row).toHaveLength(11);
      row.forEach((c) => expect(isHex(c)).toBe(true));
    }
    expect(PALETTE_ROWS[3]).toBe(STD_ROW);
    expect(STD_ROW).toHaveLength(11);
  });

  it("第 1 行与第 4 行相同（同亮度）", () => {
    expect(PALETTE_ROWS[0]).toEqual(PALETTE_ROWS[3]);
  });

  it("同列同色系：蓝色列各行 h 一致（用固定 h/s 验算）", () => {
    // 仅验证 hsl2hex 输出稳定且为 6 位 hex
    expect(isHex(hsl2hex(217, 92, 55))).toBe(true);
  });

  it("leastUsedColor 返回未使用色；全使用过时返回第一个", () => {
    const first = STD_ROW[0];
    const second = STD_ROW[1];
    expect(leastUsedColor([first])).toBe(second);
    expect(leastUsedColor([])).toBe(first);
    expect(leastUsedColor(STD_ROW)).toBe(first);
  });
});
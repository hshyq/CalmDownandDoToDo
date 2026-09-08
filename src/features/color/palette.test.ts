import { describe, expect, it } from "vitest";
import {
  PALETTE_ROWS,
  STD_ROW,
  hexToHsv,
  hsvToHex,
  isLightBg,
  leastUsedColor,
  textColorOn,
} from "./palette";

const isHex = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

describe("分类色盘（PRD 4.1 v1.9 墨刀式）", () => {
  it("5 行 × 9 列，标准行为第 3 行（标准饱和档）", () => {
    expect(PALETTE_ROWS).toHaveLength(5);
    for (const row of PALETTE_ROWS) {
      expect(row).toHaveLength(9);
      row.forEach((c) => expect(isHex(c)).toBe(true));
    }
    expect(PALETTE_ROWS[2]).toBe(STD_ROW);
  });

  it("第 1 行为灰阶（r=g=b），含黑与白两端", () => {
    for (const c of PALETTE_ROWS[0]) {
      const r = parseInt(c.slice(1, 3), 16);
      const g = parseInt(c.slice(3, 5), 16);
      const b = parseInt(c.slice(5, 7), 16);
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
    expect(PALETTE_ROWS[0][0]).toBe("#000000");
    expect(PALETTE_ROWS[0][8]).toBe("#FFFFFF");
  });

  it("彩色各行首列为红色系且由浅到深（行 1 亮度 > 行 4）", () => {
    const firsts = PALETTE_ROWS.slice(1).map((row) => row[0]);
    firsts.forEach((c) => expect(isHex(c)).toBe(true));
    expect(firsts).toEqual(["#DE868F", "#BD3124", "#951D1D", "#641013"]);
  });

  it("leastUsedColor 返回未使用色；全使用过时返回第一个", () => {
    const first = STD_ROW[0];
    const second = STD_ROW[1];
    expect(leastUsedColor([first])).toBe(second);
    expect(leastUsedColor([])).toBe(first);
    expect(leastUsedColor(STD_ROW)).toBe(first);
  });
});

describe("色块文字颜色自适应（PRD 5.4 v1.9）", () => {
  it("亮背景用深字，暗背景用白字", () => {
    expect(textColorOn("#FFFFFF")).toBe("#1F1F1F");
    expect(textColorOn("#FCCA00")).toBe("#1F1F1F"); // 明黄
    expect(textColorOn("#93D2F3")).toBe("#1F1F1F"); // 浅蓝
    expect(textColorOn("#000000")).toBe("#FFFFFF");
    expect(textColorOn("#BD3124")).toBe("#FFFFFF"); // 标准红
    expect(textColorOn("#4095E5")).toBe("#FFFFFF"); // 标准蓝
  });

  it("isLightBg 以 YIQ 160 为界", () => {
    expect(isLightBg("#FFBF6B")).toBe(true); // YIQ≈181
    expect(isLightBg("#E99D42")).toBe(true); // YIQ≈169
    expect(isLightBg("#951D1D")).toBe(false);
  });
});

describe("HSV 转换（SV 取色面板）", () => {
  it("已知色值往返一致", () => {
    for (const c of ["#BD3124", "#FCCA00", "#4095E5", "#000000", "#FFFFFF", "#777777"]) {
      const { h, s, v } = hexToHsv(c);
      expect(hsvToHex(h, s, v)).toBe(c.toLowerCase());
    }
  });

  it("hsvToHex 边界：红/黑/白", () => {
    expect(hsvToHex(0, 100, 100)).toBe("#ff0000");
    expect(hsvToHex(120, 50, 0)).toBe("#000000"); // v=0 恒黑
    expect(hsvToHex(200, 0, 100)).toBe("#ffffff"); // s=0 恒灰白
  });

  it("非法 HEX 容错为黑色", () => {
    expect(hexToHsv("not-a-color")).toEqual({ h: 0, s: 0, v: 0 });
  });
});

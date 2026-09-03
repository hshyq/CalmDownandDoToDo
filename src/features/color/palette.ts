// 分类色盘（PRD 4.1 v1.3）：11 列 × 6 行，第 1 行=第 4 行，每列同色系由浅到深。
// 算法与 `doc/原型.html` 一致，作为前端纯函数并配 vitest 单测。

/** 列定义：[名称, 色相, 饱和度%] */
export const HUES: ReadonlyArray<readonly [string, number, number]> = [
  ["灰", 0, 0],
  ["红", 4, 80],
  ["橙", 28, 94],
  ["黄", 48, 96],
  ["绿", 135, 62],
  ["青", 185, 82],
  ["蓝", 217, 92],
  ["紫", 262, 68],
  ["品红", 300, 74],
  ["粉", 335, 88],
  ["棕", 22, 46],
];

/** 各行亮度%（第 1=第 4 行由同一亮度值保证，见 PALETTE_ROWS 注释） */
const ROW_L = [55, 86, 70, 55, 38, 24];

/** HSL → #RRGGBB（s/l 为 0~100 的百分数）。 */
export function hsl2hex(h: number, s: number, l: number): string {
  const ss = s / 100;
  const ll = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const v =
      ll -
      a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** 11×6 色盘（行 0 与行 3 亮度相同 → 同色）。 */
export const PALETTE_ROWS: string[][] = ROW_L.map((l) =>
  HUES.map(([, h, s]) => hsl2hex(h, s, l)),
);

/** 标准行（第 4 行，索引 3）：新建分类默认取此行中使用最少的颜色（PRD 4.1）。 */
export const STD_ROW: string[] = PALETTE_ROWS[3];

/** 标准行中使用次数最少的颜色；并列取靠前者。 */
export function leastUsedColor(usedColors: readonly string[]): string {
  const lower = new Set(usedColors.map((c) => c.toLowerCase()));
  let best = STD_ROW[0];
  let min = Number.MAX_SAFE_INTEGER;
  for (const c of STD_ROW) {
    const n = lower.has(c.toLowerCase()) ? 1 : 0;
    if (n < min) {
      min = n;
      best = c;
    }
  }
  return best;
}
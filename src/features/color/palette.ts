// 分类色盘（PRD 4.1 v1.9）：墨刀（Mockitt）式低饱和色板。
// 结构 = 1 行灰阶（9 档）+ 4 行彩色（9 色系，行 2~5 由浅到深）；色值取自墨刀取色器实测。
// 另含「色块文字颜色自适应」（PRD 5.4 v1.9）与 SV 取色面板所需 HSV 转换纯函数。

/** 墨刀式色板：行 0=灰阶；行 1~4 彩色列为同一色系的浅→深。 */
export const PALETTE_ROWS: string[][] = [
  ["#000000", "#333333", "#4F4F4F", "#6C6C6C", "#9A9A9A", "#BEBEBE", "#CECECE", "#EFEFEF", "#FFFFFF"],
  ["#DE868F", "#FCCA00", "#F4CE98", "#FEFA83", "#CCF783", "#B4FDFF", "#93D2F3", "#7F83F7", "#B886F8"],
  ["#BD3124", "#E99D42", "#FFBF6B", "#FFF81D", "#A2EF4D", "#75F9FD", "#4095E5", "#0F40F5", "#7728F5"],
  ["#951D1D", "#A16222", "#CBA43F", "#BFBF3D", "#81B337", "#54BCBD", "#347CAF", "#0014B7", "#591BB7"],
  ["#641013", "#744E20", "#9B7D31", "#817F26", "#567722", "#377F7F", "#215476", "#000A7B", "#3B0E7B"],
];

/** 标准行（第 3 行，标准饱和档）：新建分类默认取此行中使用最少的颜色（PRD 4.1）。 */
export const STD_ROW: string[] = PALETTE_ROWS[2];

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

/** #RRGGBB → [r, g, b]；非法输入返回黑色。 */
export function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const v = m[1];
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
}

/** 色块背景是否偏亮（YIQ 亮度 > 160）→ 其上文字应用深色（PRD 5.4）。 */
export function isLightBg(hex: string): boolean {
  const [r, g, b] = hexRgb(hex);
  return (299 * r + 587 * g + 114 * b) / 1000 > 160;
}

/** 色块上的文字颜色：亮背景深字、暗背景白字（PRD 5.4）。 */
export function textColorOn(hex: string): string {
  return isLightBg(hex) ? "#1F1F1F" : "#FFFFFF";
}

export interface Hsv {
  h: number; // 0~360
  s: number; // 0~100
  v: number; // 0~100
}

/** #RRGGBB → HSV（s/v 为 0~100 百分数）；非法输入返回红色。 */
export function hexToHsv(hex: string): Hsv {
  const [r0, g0, b0] = hexRgb(hex);
  const r = r0 / 255;
  const g = g0 / 255;
  const b = b0 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  return { h, s, v: max * 100 };
}

/** HSV → #RRGGBB（s/v 为 0~100 百分数）。 */
export function hsvToHex(h: number, s: number, v: number): string {
  const ss = Math.min(100, Math.max(0, s)) / 100;
  const vv = Math.min(100, Math.max(0, v)) / 100;
  const c = vv * ss;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const seg = Math.floor(hp);
  const rgb: [number, number, number] =
    seg === 0 ? [c, x, 0] :
    seg === 1 ? [x, c, 0] :
    seg === 2 ? [0, c, x] :
    seg === 3 ? [0, x, c] :
    seg === 4 ? [x, 0, c] : [c, 0, x];
  const m = vv - c;
  return "#" + rgb
    .map((ch) => Math.round((ch + m) * 255).toString(16).padStart(2, "0"))
    .join("");
}

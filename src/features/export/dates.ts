// TXT 导出纯函数（PRD 6.9 / v1.14；展示无关，配 vitest）。
// 与后端 store/export.rs 的 half_year_limit 规则保持一致：开始 + 6 个月 − 1 天，
// 目标月不存在同日时钳到当月最后一天再减一天（如 2026-08-31 → 2027-02-27）。

/** 补零成两位。 */
const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 指定年月的天数（含闰年）。 */
export const daysInMonth = (y: number, m: number): number => {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
};

/** 导出范围弹窗默认值：当前月首日 ~ 下月末日（整月边界，PRD 6.9）。 */
export const defaultExportRange = (today: string): { start: string; end: string } => {
  const [y, m] = today.split("-").map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return {
    start: `${y}-${pad2(m)}-01`,
    end: `${ny}-${pad2(nm)}-${pad2(daysInMonth(ny, nm))}`,
  };
};

/** 结束日期可选上限 = 开始日期 + 6 个月 − 1 天（PRD 6.9，用户定义）。 */
export const maxEndDate = (start: string): string => {
  const [ys, ms, ds] = start.split("-").map(Number);
  // 加 6 个月（仅年月进位）
  const total = ys * 12 + (ms - 1) + 6;
  const y2 = Math.floor(total / 12);
  const m2 = (total % 12) + 1;
  // 目标月无同日则钳到当月最后一天，再减一天
  const clamped = Math.min(ds, daysInMonth(y2, m2));
  if (clamped >= 2) return `${y2}-${pad2(m2)}-${pad2(clamped - 1)}`;
  // 1 日减一天 = 上月最后一天
  const t = y2 * 12 + (m2 - 1) - 1;
  const y3 = Math.floor(t / 12);
  const m3 = (t % 12) + 1;
  return `${y3}-${pad2(m3)}-${pad2(daysInMonth(y3, m3))}`;
};

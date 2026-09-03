// 日期纯函数（UTC 解析避免时区歧义；日期一律 YYYY-MM-DD 字符串，与 SQLite 文本比较一致）。
// 规则：周一为每周第一天（PRD 5.3）。

export interface YMD {
  y: number;
  m: number; // 1~12
  d: number;
}

export function parseISO(iso: string): YMD {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function toISO(ymd: YMD): string {
  const mm = String(ymd.m).padStart(2, "0");
  const dd = String(ymd.d).padStart(2, "0");
  return ymd.y + "-" + mm + "-" + dd;
}

/** from → to 相差天数（to - from，可为负）。 */
export function dayDiff(fromIso: string, toIso: string): number {
  const a = parseISO(fromIso);
  const b = parseISO(toIso);
  const ms =
    Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86400000);
}

export function addDays(iso: string, n: number): string {
  const a = parseISO(iso);
  const dt = new Date(Date.UTC(a.y, a.m - 1, a.d + n));
  return toISO({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

/** 所在周的周一（周一起始）。 */
export function weekStartMonday(iso: string): string {
  const a = parseISO(iso);
  const dt = new Date(Date.UTC(a.y, a.m - 1, a.d));
  const idx = (dt.getUTCDay() + 6) % 7; // 周一=0
  return addDays(iso, -idx);
}

/** 当月天数（month: 1~12）。 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 本地今天（YYYY-MM-DD）。 */
export function todayISO(): string {
  const now = new Date();
  return toISO({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

/**
 * 月视图按周切行（补齐前后月，行首均为周一）。
 * 返回行数组，每行 7 个日期字符串。
 */
export function monthRows(year: number, month: number): string[][] {
  const first = toISO({ y: year, m: month, d: 1 });
  const ws = weekStartMonday(first);
  const total = dayDiff(ws, first) + daysInMonth(year, month);
  const nRows = Math.ceil(total / 7);
  const rows: string[][] = [];
  for (let r = 0; r < nRows; r++) {
    const row: string[] = [];
    for (let i = 0; i < 7; i++) row.push(addDays(ws, r * 7 + i));
    rows.push(row);
  }
  return rows;
}

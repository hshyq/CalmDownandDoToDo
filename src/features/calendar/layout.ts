// 横条布局纯函数（对应技术方案 5.1 / PRD 5.3）。
// 排序键 (cs, start_time, ce, id)：无时刻视为 00:00、相同按创建顺序（PRD 5.3 v1.4 / TC-CAL-011）。
import { dayDiff } from "./dates";

export interface CalItemLite {
  id: number;
  startDate: string;
  startTime?: string | null;
  endDate: string;
}

/** 布局结果：cs/ce 为行内列（0~6），lane<0 表示溢出（进入 +N）。 */
export interface Placed {
  id: number;
  cs: number;
  ce: number;
  lane: number;
}

/**
 * 对一行（rowStart~rowEnd，通常周一~周日）布局横条：
 * 过滤与行交集 → 分段（跨行截断到 [0,6]）→ 排序 → 贪心泳道。
 */
export function layoutRow(
  rowStart: string,
  rowEnd: string,
  items: readonly CalItemLite[],
  maxLanes: number,
): Placed[] {
  const segs = items
    .filter((it) => it.startDate && it.endDate && it.startDate <= rowEnd && it.endDate >= rowStart)
    .map((it) => {
      const cs = dayDiff(rowStart, it.startDate < rowStart ? rowStart : it.startDate);
      const ce = dayDiff(rowStart, it.endDate > rowEnd ? rowEnd : it.endDate);
      return { it, cs, ce };
    })
    .sort(
      (a, b) =>
        a.cs - b.cs ||
        (a.it.startTime || "00:00").localeCompare(b.it.startTime || "00:00") ||
        a.ce - b.ce ||
        a.it.id - b.it.id,
    );

  const laneEnds: number[] = [];
  const out: Placed[] = [];
  for (const s of segs) {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] >= s.cs) lane += 1;
    if (lane >= maxLanes) {
      out.push({ id: s.it.id, cs: s.cs, ce: s.ce, lane: -1 });
      continue;
    }
    laneEnds[lane] = s.ce;
    out.push({ id: s.it.id, cs: s.cs, ce: s.ce, lane });
  }
  return out;
}

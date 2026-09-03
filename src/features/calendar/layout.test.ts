import { describe, expect, it } from "vitest";
import { layoutRow } from "./layout";
import type { CalItemLite } from "./layout";

const wk = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"];

const item = (id: number, sd: string, ed: string, st?: string): CalItemLite => ({ id, startDate: sd, endDate: ed, startTime: st ?? null });

describe("横条布局（技术方案 5.1 / PRD 5.3）", () => {
  it("跨格连续覆盖（TC-CAL-004）", () => {
    const out = layoutRow(wk[0], wk[6], [item(1, "2026-09-08", "2026-09-10")], 4);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ cs: 1, ce: 3, lane: 0 });
  });

  it("行内截断：跨出行边界只显示行内段（TC-CAL-005 布局部分）", () => {
    // 事项 08-30 ~ 09-02：在 09-07 行不出现；在 08-31~09-06 行内为 08-31~09-02
    const none = layoutRow("2026-09-07", "2026-09-13", [item(1, "2026-08-30", "2026-09-02")], 4);
    expect(none).toHaveLength(0);

    const row0831 = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"];
    const seg = layoutRow(row0831[0], row0831[6], [item(1, "2026-08-30", "2026-09-02")], 4);
    expect(seg[0]).toMatchObject({ cs: 0, ce: 2 });
  });

  it("同格多条泳道不重叠（TC-CAL-006）", () => {
    const out = layoutRow(wk[0], wk[6], [
      item(1, "2026-09-08", "2026-09-09"),
      item(2, "2026-09-09", "2026-09-10"),
    ], 4);
    const byId = new Map(out.map((o) => [o.id, o]));
    expect(byId.get(1)!.lane).toBeLessThan(byId.get(2)!.lane);
  });

  it("超过容量溢出 lane=-1（TC-CAL-007 布局部分）", () => {
    const items: CalItemLite[] = [1, 2, 3, 4, 5].map((i) => item(i, "2026-09-09", "2026-09-09"));
    const out = layoutRow(wk[0], wk[6], items, 4);
    expect(out.filter((o) => o.lane >= 0)).toHaveLength(4);
    expect(out.filter((o) => o.lane < 0)).toHaveLength(1);
  });

  it("按开始时间升序、相同按创建顺序、无时刻视为 00:00（TC-CAL-011）", () => {
    const out = layoutRow(wk[0], wk[6], [
      item(1, "2026-09-09", "2026-09-09", "20:47"),
      item(2, "2026-09-09", "2026-09-09", "19:47"),
      item(3, "2026-09-09", "2026-09-09"),
    ], 4);
    const sorted = out.sort((a, b) => a.lane - b.lane).map((o) => o.id);
    // 无时刻(00:00)=id3 → id2(19:47) → id1(20:47)
    expect(sorted).toEqual([3, 2, 1]);
  });
});
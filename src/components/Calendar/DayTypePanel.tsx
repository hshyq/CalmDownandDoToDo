// 日期类型管理面板（PRD 5.5 v1.12；v1.18 起嵌入设置弹窗「日期类型」tab，自包含数据拉取）。
// 月历网格点击循环切换 班→休→假→恢复默认；翻月按需拉取当月覆盖项。
import { useEffect, useState } from "react";
import { monthRows, toISO } from "../../features/calendar/dates";
import { defaultDayType, DAY_TYPE_LABELS } from "../../services/types";
import type { DayType } from "../../services/types";
import { dayTypeApi } from "../../services/ipc";

const CYCLE: Record<string, DayType | null> = {
  "": "work",
  work: "rest",
  rest: "holiday",
  holiday: null, // 恢复默认
};

/** 单元格角标样式类。 */
const TYPE_CLASS: Record<DayType, string> = { work: "work", rest: "rest", holiday: "holiday" };

export default function DayTypePanel() {
  const now = new Date();
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [dayTypes, setDayTypes] = useState<Record<string, DayType>>({});
  const [toast, setToast] = useState("");

  const mKey = toISO({ y: ym.y, m: ym.m, d: 1 }).slice(0, 7);
  const monthStart = `${mKey}-01`;
  const monthEnd = `${mKey}-${String(new Date(ym.y, ym.m, 0).getDate()).padStart(2, "0")}`;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  };

  // 翻月按需拉取当月覆盖项
  useEffect(() => {
    let cancelled = false;
    dayTypeApi
      .list(monthStart, monthEnd)
      .then((rows) => {
        if (!cancelled) setDayTypes(Object.fromEntries(rows.map((r) => [r.date, r.day_type])));
      })
      .catch(() => {
        if (!cancelled) showToast("加载日期类型失败，请重试");
      });
    return () => {
      cancelled = true;
    };
  }, [monthStart, monthEnd]);

  const shiftMonth = (dir: 1 | -1) => {
    const total = ym.y * 12 + (ym.m - 1) + dir;
    setYm({ y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 + 1 });
  };

  const typeOf = (date: string): DayType => dayTypes[date] ?? defaultDayType(date);
  const cycle = (date: string) => {
    const next = CYCLE[dayTypes[date] ?? ""];
    dayTypeApi
      .set(date, next ?? null)
      .then(() => {
        setDayTypes((prev) => {
          const copy = { ...prev };
          if (next) copy[date] = next;
          else delete copy[date];
          return copy;
        });
      })
      .catch((e) => showToast(e instanceof Error ? e.message : "设置日期类型失败，请重试"));
  };

  return (
    <div className="set-body">
      {toast ? <div className="toast">{toast}</div> : null}
      <div className="pk-head">
        <button type="button" className="pk-nav" onClick={() => shiftMonth(-1)}>‹</button>
        <b>{ym.y}年{ym.m}月</b>
        <button type="button" className="pk-nav" onClick={() => shiftMonth(1)}>›</button>
      </div>
      <div className="dt-grid">
        {monthRows(ym.y, ym.m).map((row) =>
          row.map((date) => {
            const dim = date.slice(0, 7) !== mKey;
            const t = typeOf(date);
            return (
              <button type="button" key={date}
                className={"dt-cell" + (dim ? " dim" : "")}
                onClick={() => cycle(date)}>
                {Number(date.slice(8))}
                <span className={"dtype " + TYPE_CLASS[t]}>{DAY_TYPE_LABELS[t]}</span>
              </button>
            );
          }),
        )}
      </div>
      <div className="dt-legend">
        <span><span className={"dtype " + TYPE_CLASS.work}>班</span>工作日</span>
        <span><span className={"dtype " + TYPE_CLASS.rest}>休</span>休息日</span>
        <span><span className={"dtype " + TYPE_CLASS.holiday}>假</span>法定假日</span>
      </div>
      <div className="iempty" style={{ textAlign: "left" }}>
        默认周一~周五为工作日、周六周日为休息日；点击日期循环切换 班→休→假→恢复默认。
        指定后的类型会以色条标注在日历格上（法定假日的日期数字显示为红色），Ctrl+Z 可撤销。
      </div>
    </div>
  );
}

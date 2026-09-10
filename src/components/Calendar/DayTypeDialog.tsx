// 日期类型管理弹窗（PRD 5.5 v1.12）：月历网格点击循环切换 班→休→假→恢复默认。
import { useState } from "react";
import Modal from "../Modal/Modal";
import { monthRows, parseISO, toISO } from "../../features/calendar/dates";
import { defaultDayType, DAY_TYPE_LABELS } from "../../services/types";
import type { DayType } from "../../services/types";

const CYCLE: Record<string, DayType | null> = {
  "": "work",
  work: "rest",
  rest: "holiday",
  holiday: null, // 恢复默认
};

interface Props {
  /** 打开时浏览的月份（取自当前 cursor）。 */
  cursor: string;
  /** 全部已指定覆盖项（date → type）。 */
  dayTypes: Record<string, DayType>;
  /** 设置/清除某日类型（调用方负责 IPC 与状态更新）。 */
  onChange: (date: string, dayType: DayType | null) => void;
  onClose: () => void;
}

/** 单元格角标样式类。 */
const TYPE_CLASS: Record<DayType, string> = { work: "work", rest: "rest", holiday: "holiday" };

export default function DayTypeDialog({ cursor, dayTypes, onChange, onClose }: Props) {
  const [ym, setYm] = useState<{ y: number; m: number }>(() => parseISO(cursor.slice(0, 8) + "01"));
  const shiftMonth = (dir: 1 | -1) => {
    const total = ym.y * 12 + (ym.m - 1) + dir;
    setYm({ y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 + 1 });
  };

  const mKey = toISO({ y: ym.y, m: ym.m, d: 1 }).slice(0, 7);
  const typeOf = (date: string): DayType => dayTypes[date] ?? defaultDayType(date);
  const cycle = (date: string) => {
    const next = CYCLE[dayTypes[date] ?? ""];
    onChange(date, next ?? null);
  };

  return (
    <Modal
      title="日期类型"
      onClose={onClose}
      width={430}
      footer={
        <>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn-ghost" onClick={onClose}>关闭</button>
        </>
      }
    >
      <div className="iform">
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
          指定后的类型会以角标标注在日历格上，Ctrl+Z 可撤销。
        </div>
      </div>
    </Modal>
  );
}

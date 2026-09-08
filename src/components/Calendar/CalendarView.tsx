// P4 日历视图：周/月网格 + 横条泳道布局 + +N 浮层 + 格内「+」快捷新建。
import { useCallback, useEffect, useRef, useState } from "react";
import ItemModal from "../Items/ItemModal";
import FieldManager from "../fields/FieldManager";
import { useUndoStore } from "../../stores/undoStore";
import { useAppStore } from "../../stores/appStore";
import { itemApi } from "../../services/ipc";
import { OVERVIEW } from "../../services/types";
import type { CalendarItem, Category, Item, ItemDraft } from "../../services/types";
import { addDays, daysInMonth, monthRows, parseISO, toISO, todayISO, weekStartMonday } from "../../features/calendar/dates";
import { layoutRow } from "../../features/calendar/layout";
import type { CalItemLite } from "../../features/calendar/layout";
import { BAR_MIME, TODO_MIME, shiftRange, todoDropDates } from "../../features/calendar/drag";
import type { ShiftedDates } from "../../features/calendar/drag";

type ViewMode = "week" | "month";

interface ModalState {
  open: boolean;
  item: Item | null;
  defaultCatId: number;
  allowPick: boolean;
  presetDate?: string;
}

export default function CalendarView() {
  const { categories, activeTab, ready, dataVersion, updateItem } = useAppStore();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<string>(todayISO());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [fmCat, setFmCat] = useState<Category | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  // 年月选择面板（原型 pk-* 契约）：浏览的年月；null=关闭
  const [pick, setPick] = useState<{ y: number; m: number } | null>(null);
  const { canUndo, canRedo, undo: runUndo, redo: runRedo } = useUndoStore();
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const pendingDateRef = useRef("");

  const scope = activeTab === OVERVIEW ? null : activeTab;

  const onUndo = async () => {
    try { await runUndo(); showToast("已撤销"); }
    catch (e) { showToast(e instanceof Error ? e.message : "撤销失败，请重试"); }
  };
  const onRedo = async () => {
    try { await runRedo(); showToast("已重做"); }
    catch (e) { showToast(e instanceof Error ? e.message : "重做失败，请重试"); }
  };
  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2200);
  };

  const rows: string[][] = (() => {
    if (view === "week") {
      const ws = weekStartMonday(cursor);
      return [[0, 1, 2, 3, 4, 5, 6].map((n) => addDays(ws, n))];
    }
    const { y, m } = parseISO(cursor);
    return monthRows(y, m);
  })();

  const viewStart = rows[0][0];
  const viewEnd = rows[rows.length - 1][6];
  const monthKey = cursor.slice(0, 7);
  const catOf = (id: number): Category | undefined => categories.find((c) => c.id === id);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await itemApi.calendar(viewStart, viewEnd, scope);
      setItems(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加载日历失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [viewStart, viewEnd, scope]);

  useEffect(() => {
    if (ready) void reload();
  }, [ready, reload, dataVersion]);

  const nav = (dir: 1 | -1) => {
    if (view === "week") setCursor(addDays(cursor, 7 * dir));
    else {
      const { y, m } = parseISO(cursor);
      const target = new Date(Date.UTC(y, m - 1 + dir, 1));
      setCursor(toISO({ y: target.getUTCFullYear(), m: target.getUTCMonth() + 1, d: 1 }));
    }
  };

  const openEdit = async (id: number) => {
    try {
      const detail = await itemApi.getDetail(id);
      setModal({ open: true, item: detail, defaultCatId: detail.category_id, allowPick: false, presetDate: "" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "打开事项失败，请重试");
    }
  };

  const openCreate = (date: string, allowPick: boolean) => {
    const def = allowPick ? (categories[0]?.id ?? 0) : (scope ?? categories[0]?.id ?? 0);
    setDay(null);
    pendingDateRef.current = date;
    setModal({ open: true, item: null, defaultCatId: def, allowPick, presetDate: date });
  };

  // 拖拽改期（PRD 5.3 v1.8）：仅改起止日期，标题/描述/截止/分类/字段值原样保留；
  // 走 update_item（已接撤销包装），不传 fieldValues → 库中字段值不动。
  const moveItem = async (id: number, dates: ShiftedDates) => {
    try {
      const detail = await itemApi.getDetail(id);
      if (detail.start_date === dates.startDate && detail.end_date === dates.endDate) return;
      const draft: ItemDraft = {
        categoryId: detail.category_id,
        title: detail.title,
        description: detail.description,
        startDate: dates.startDate,
        startTime: detail.start_time,
        endDate: dates.endDate,
        endTime: detail.end_time,
        dueDate: detail.due_date,
        dueTime: detail.due_time,
      };
      await updateItem(id, draft);
      showToast("已更新日期");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "更新日期失败，请重试");
    }
  };

  // 落格分发：按 dataTransfer 来源类型区分「横条平移」与「待办拖入」（PRD 5.3 v1.8）
  const onCellDrop = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const barId = e.dataTransfer.getData(BAR_MIME);
    if (barId) {
      const it = items.find((x) => x.id === Number(barId));
      if (it) void moveItem(it.id, shiftRange(it.start_date, it.end_date, date));
      return;
    }
    const todoId = e.dataTransfer.getData(TODO_MIME);
    if (todoId) void moveItem(Number(todoId), todoDropDates(date));
  };

  const title = monthKey.slice(0, 4) + "年" + Number(monthKey.slice(5, 7)) + "月";

  // —— 年月选择面板（原型 openPickPanel/pickMonth/pickWeek 契约，PRD 5.3） ——
  const openPick = () => {
    const { y, m } = parseISO(cursor);
    setPick({ y, m });
  };
  const jumpMonth = (y: number, m: number) => {
    // 保留原日、超当月天数截断（如 08-31 → 02-28）
    const d = Math.min(Number(cursor.slice(8)), daysInMonth(y, m));
    setCursor(toISO({ y, m, d }));
    setPick(null);
  };
  const jumpWeek = (monday: string) => {
    setCursor(monday);
    setPick(null);
  };
  const shiftPickMonth = (dir: 1 | -1) => {
    if (!pick) return;
    const total = pick.y * 12 + (pick.m - 1) + dir;
    setPick({ y: Math.floor(total / 12), m: (total % 12 + 12) % 12 + 1 });
  };

  // 面板：月视图=12 宫格选月（‹› 翻年）；周视图=按月浏览周行、点整行选周
  const renderPickPanel = () => {
    if (!pick) return null;
    const y = pick.y;
    const mKey = toISO({ y: pick.y, m: pick.m, d: 1 }).slice(0, 7);
    const curWeek = weekStartMonday(cursor);
    if (view === "month") {
      return (
        <div className="pickpanel" onClick={(e) => e.stopPropagation()}>
          <div className="pk-head">
            <button type="button" className="pk-nav" onClick={() => setPick({ y: y - 1, m: pick.m })}>‹</button>
            <b>{y}年</b>
            <button type="button" className="pk-nav" onClick={() => setPick({ y: y + 1, m: pick.m })}>›</button>
          </div>
          <div className="pk-months">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <button
                type="button"
                key={m}
                className={y === parseISO(cursor).y && m === parseISO(cursor).m ? "on" : ""}
                onClick={() => jumpMonth(y, m)}
              >
                {m}月
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="pickpanel" onClick={(e) => e.stopPropagation()}>
        <div className="pk-head">
          <button type="button" className="pk-nav" onClick={() => shiftPickMonth(-1)}>‹</button>
          <b>{y}年{pick.m}月</b>
          <button type="button" className="pk-nav" onClick={() => shiftPickMonth(1)}>›</button>
        </div>
        <div className="pk-dow">
          {["一", "二", "三", "四", "五", "六", "日"].map((d) => <span key={d}>{d}</span>)}
        </div>
        {monthRows(pick.y, pick.m).map((row) => (
          <div
            key={row[0]}
            className={"pk-weekrow" + (row[0] === curWeek ? " sel" : "")}
            onClick={() => jumpWeek(row[0])}
          >
            {row.map((ds) => (
              <button
                type="button"
                key={ds}
                className={(ds.slice(0, 7) !== mKey ? "dim " : "") + (ds === todayISO() ? "today" : "")}
              >
                {Number(ds.slice(8))}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderRow = (rowDates: string[]) => {
    const rowStart = rowDates[0];
    const rowEnd = rowDates[6];
    const maxLanes = view === "week" ? 10 : 4;
    const calItems: CalItemLite[] = items.map((it) => ({
      id: it.id,
      startDate: it.start_date,
      startTime: it.start_time,
      endDate: it.end_date,
    }));
    const placed = layoutRow(rowStart, rowEnd, calItems, maxLanes);
    const bars = placed
      .filter((p) => p.lane >= 0)
      .map((p) => {
        const it = items.find((x) => x.id === p.id);
        if (!it) return null;
        const cat = catOf(it.category_id);
        return (
          <div
            key={p.id}
            className="bar"
            style={{
              left: (p.cs * 100) / 7 + "%",
              width: ((p.ce - p.cs + 1) * 100) / 7 + "%",
              top: 23 + p.lane * 22,
              background: cat?.color ?? "#9E9E9E",
            }}
            title={it.title}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(BAR_MIME, String(p.id));
              e.dataTransfer.effectAllowed = "copyMove";
            }}
            onClick={() => void openEdit(p.id)}
          >
            {it.title}
          </div>
        );
      });

    const chips = rowDates.map((d, col) => {
      const n = placed.filter((p) => p.lane < 0 && p.cs <= col && col <= p.ce).length;
      return n > 0 ? (
        <span key={"c" + d} className="morechip" style={{ right: ((6 - col) * 100) / 7 + "%" }} onClick={() => setDay(d)}>
          +{n}
        </span>
      ) : null;
    });

    const cells = rowDates.map((d) => {
      const other = view === "month" && d.slice(0, 7) !== monthKey;
      const isToday = d === todayISO();
      return (
        <div
          key={d}
          className={"daycell " + (other ? "other " : "") + (isToday ? "today" : "") + (dragOverDate === d ? " dragover" : "")}
          onDragOver={(e) => {
            // dragover 中不可读 getData，用 types 判断来源（横条或待办）
            if (e.dataTransfer.types.includes(BAR_MIME) || e.dataTransfer.types.includes(TODO_MIME)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDragOverDate(d);
            }
          }}
          onDragLeave={() => setDragOverDate((cur) => (cur === d ? null : cur))}
          onDrop={(e) => onCellDrop(e, d)}
        >
          <span className="dnum">{Number(d.slice(8))}</span>
          <span className="celladd" title="新增事项" onClick={() => openCreate(d, activeTab === OVERVIEW)}>
            +
          </span>
        </div>
      );
    });

    return (
      <div key={rowStart} className="weekrow" style={{ height: view === "week" ? 242 : 118 }}>
        <div className="barlayer">
          {bars}
          {chips}
        </div>
        {cells}
      </div>
    );
  };

  return (
    <main className="main">
      <div className="toolbar">
        <button type="button" className="nav-btn" onClick={() => nav(-1)} aria-label="上一周期">‹</button>
        <button type="button" className="btn-ghost today-btn" onClick={() => setCursor(todayISO())}>今天</button>
        <button type="button" className="nav-btn" onClick={() => nav(1)} aria-label="下一周期">›</button>
        <div className="seg">
          <button type="button" className={view === "week" ? "on" : ""} onClick={() => setView("week")}>周</button>
          <button type="button" className={view === "month" ? "on" : ""} onClick={() => setView("month")}>月</button>
        </div>
        <span style={{ position: "relative", marginLeft: 12 }}>
          <span
            className="title cal-title"
            title="点击选择年月"
            onClick={() => (pick ? setPick(null) : openPick())}
          >{title}</span>
          {pick ? <div className="popmask" onClick={() => setPick(null)} /> : null}
          {renderPickPanel()}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn-ghost undobtn" disabled={!canUndo} title="撤销 Ctrl+Z" onClick={() => void onUndo()}>↶</button>
        <button type="button" className="btn-ghost undobtn" disabled={!canRedo} title="重做 Ctrl+Y" onClick={() => void onRedo()}>↷</button>
        {scope !== null ? (
          <button type="button" className="btn-ghost" onClick={() => { const c = catOf(scope); if (c) setFmCat(c); }}>字段管理</button>
        ) : null}
        {scope !== null ? (
          <button type="button" className="btn-primary add" onClick={() => { pendingDateRef.current = ""; setModal({ open: true, item: null, defaultCatId: scope ?? 0, allowPick: false }); }}>
            + 新增事项
          </button>
        ) : null}
      </div>
      <div className="calwrap">
        <div className="calhead">
          {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="calgrid">{rows.map(renderRow)}</div>
        {loading ? <div className="loading-mask">加载中…</div> : null}
      </div>

      {modal ? (
        <ItemModal
          item={modal.item}
          categories={categories}
          defaultCategoryId={modal.defaultCatId}
          allowCategoryPick={modal.allowPick}
          presetStartDate={modal.presetDate ?? ""}
          onClose={() => setModal(null)}
          onSaved={(m) => { setModal(null); void reload(); showToast(m); }}
          onDeleted={() => { setModal(null); void reload(); showToast("已删除"); }}
        />
      ) : null}

      {day ? (
        <DayOverlay date={day} items={items} categories={categories} onPick={(id) => void openEdit(id)} onClose={() => setDay(null)} />
      ) : null}
      {fmCat ? <FieldManager category={fmCat} onClose={() => setFmCat(null)} /> : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}

function DayOverlay(props: {
  date: string;
  items: CalendarItem[];
  categories: Category[];
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const { date, items, categories, onPick, onClose } = props;
  const catOf = (id: number) => categories.find((c) => c.id === id);
  const list = items
    .filter((it) => it.start_date <= date && it.end_date >= date)
    .sort((a, b) => (a.start_time ?? "00:00").localeCompare(b.start_time ?? "00:00") || a.id - b.id);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal daylist" style={{ width: 320 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{date} 的事项（{list.length}）</span>
          <button type="button" className="modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 6 }}>
          {list.length === 0 ? <div className="iempty">当日无事项</div> : null}
          {list.map((it) => (
            <div key={it.id} className="dl-row" onClick={() => onPick(it.id)}>
              <span className="dotc" style={{ background: catOf(it.category_id)?.color ?? "#9E9E9E" }} />
              <span className="dl-title" title={it.title}>{it.title}</span>
              <span className="dl-time">{it.start_time || ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// P5 待办视图：时间轴分组（年月/长期规划）+ 折叠（会话级）+ 简易虚拟滚动。
// P10 当前时间线（PRD 5.2 v1.15）：截止≤今天最后一条之后插红色虚线。
import { useCallback, useEffect, useRef, useState } from "react";
import ItemModal from "../Items/ItemModal";
import { useAppStore } from "../../stores/appStore";
import { itemApi } from "../../services/ipc";
import { OVERVIEW } from "../../services/types";
import type { Category, Item, TodoItem } from "../../services/types";
import { groupTodos } from "../../features/todo/group";
import { nowLineIndex } from "../../features/todo/nowline";
import { TODO_MIME } from "../../features/calendar/drag";
import { textColorOn } from "../../features/color/palette";

const GROUP_H = 30;
const ITEM_H = 34;
const NOWLINE_H = 26;
const OVERSCAN = 6;

type Row =
  | { kind: "group"; key: string; label: string; count: number }
  | { kind: "item"; item: TodoItem }
  | { kind: "nowline"; label: string };

/** 本地今天（yyyy-MM-dd）。 */
const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function TodoPanel() {
  const { categories, activeTab, ready, dataVersion } = useAppStore();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<Item | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  const [toast, setToast] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const upd = () => setViewH(el.clientHeight);
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);


  const scope = activeTab === OVERVIEW ? null : activeTab;

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2200);
  };

  const reload = useCallback(async () => {
    try {
      const data = await itemApi.todo(scope);
      setTodos(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加载待办失败，请重试");
    }
  }, [scope]);

  useEffect(() => {
    if (ready) void reload();
  }, [ready, reload, dataVersion]);

  const catOf = (id: number): Category | undefined => categories.find((c) => c.id === id);

  // 行模型：组头 + （未折叠时）组内条目 + 当前时间线；组顺序由 groupTodos 保证
  const today = todayStr();
  const groups = groupTodos(todos);
  // 时间线插入点=条目流中「截止≤今天」的最后一条之后（PRD 5.2 v1.15）；0=列表最顶部
  const nowIdx = nowLineIndex(todos, today);
  const nowLabel = `今天 ${today.slice(5).replace("-", "/")}`;
  const rows: Row[] = [];
  if (nowIdx === 0) rows.push({ kind: "nowline", label: nowLabel });
  let done = 0; // 全局条目序号（含折叠组内条目，折叠时不渲染行、时间线随之隐藏）
  for (const g of groups) {
    rows.push({ kind: "group", key: g.key, label: g.label, count: g.items.length });
    for (const it of g.items) {
      done++;
      if (collapsed[g.key]) continue;
      rows.push({ kind: "item", item: it });
      if (done === nowIdx) rows.push({ kind: "nowline", label: nowLabel });
    }
  }
  const total = rows.reduce(
    (sum, r) => sum + (r.kind === "group" ? GROUP_H : r.kind === "nowline" ? NOWLINE_H : ITEM_H),
    0,
  );

  // 从滚动位置定位首行（按行高累积）
  let visibleStart = 0;
  let offset = 0;
  for (let i = 0; i < rows.length; i++) {
    const h = rows[i].kind === "group" ? GROUP_H : rows[i].kind === "nowline" ? NOWLINE_H : ITEM_H;
    if (offset + h > scrollTop) { visibleStart = i; break; }
    offset += h;
  }
  const visibleRows: { row: Row; top: number }[] = [];
  let top = offset;
  for (let i = visibleStart; i < rows.length; i++) {
    const r = rows[i];
    const h = r.kind === "group" ? GROUP_H : r.kind === "nowline" ? NOWLINE_H : ITEM_H;
    if (top - scrollTop > viewH + OVERSCAN * ITEM_H) break;
    visibleRows.push({ row: r, top });
    top += h;
  }

  const toggle = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const openEdit = async (it: TodoItem) => {
    try {
      const detail = await itemApi.getDetail(it.id);
      setEdit(detail);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "打开事项失败，请重试");
    }
  };

  const empty = todos.length === 0;

  return (
    <aside className="todo-pane">
      <div className="todo-head">
        <h3>待办</h3>
        <span className="todo-count">{todos.length}</span>
      </div>
      <div className="tlist" ref={listRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        {empty ? (
          <div className="tempty">
            {activeTab === OVERVIEW ? "暂无待办" : "当前分类暂无待办"}
          </div>
        ) : (
          <div style={{ height: total, position: "relative" }}>
            {visibleRows.map(({ row, top }) =>
              row.kind === "group" ? (
                <div key={"g" + row.key} className="tgroup" style={{ top, height: GROUP_H }} onClick={() => toggle(row.key)}>
                  <span className={"tdot " + (collapsed[row.key] ? "folded" : "")} />
                  <span className="tlabel">{row.label}</span>
                  <span className="tcount">{row.count}</span>
                </div>
              ) : row.kind === "nowline" ? (
                // 当前时间线（PRD 5.2 v1.15）：区分已到期/今天与未来
                <div key="nowline" className="nowline" style={{ top, height: NOWLINE_H }}>
                  <span className="nowtag">{row.label}</span>
                  <span className="nowrule" />
                </div>
              ) : (
                <div
                  key={"i" + row.item.id}
                  className="titem-row"
                  style={{
                    top,
                    height: ITEM_H,
                    background: catOf(row.item.category_id)?.color ?? "#9E9E9E",
                    // 字色随背景亮度自适应（PRD 5.4 v1.9）
                    color: textColorOn(catOf(row.item.category_id)?.color ?? "#9E9E9E"),
                  }}
                  draggable
                  onDragStart={(e) => {
                    // 拖入日历：开始=结束=落格日期（PRD 5.3 v1.8）；来源类型区分于横条拖拽
                    e.dataTransfer.setData(TODO_MIME, String(row.item.id));
                    e.dataTransfer.effectAllowed = "copyMove";
                  }}
                  onClick={() => void openEdit(row.item)}
                >
                  <span className="titem-title" title={row.item.title}>{row.item.title}</span>
                  {/* 右侧显示截止日期的「日」（如 2026-09-20 → 20；无截止显示 —，PRD 5.2 v1.11） */}
                  <span className="titem-day">
                    {row.item.due_date ? Number(row.item.due_date.slice(8, 10)) : "—"}
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {edit ? (
        <ItemModal
          item={edit}
          categories={categories}
          defaultCategoryId={edit.category_id}
          onClose={() => setEdit(null)}
          onSaved={(m) => { setEdit(null); showToast(m); }}
          onDeleted={() => { setEdit(null); showToast("已删除"); }}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </aside>
  );
}
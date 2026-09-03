// 事项过渡列表：按当前标签过滤，分「日历/待办」两组展示（P4/P5 将替换为日历与待办视图）。
import { useEffect, useState } from "react";
import ItemModal from "./ItemModal";
import { useAppStore } from "../../stores/appStore";
import { OVERVIEW } from "../../services/types";
import type { Category, Item } from "../../services/types";
import { isCalendarItem } from "../../services/types";

function fmtTime(d: string, t: string | null): string {
  return t ? d + " " + t : d;
}

export default function ItemsView() {
  const { categories, items, activeTab, ready, loadItems } = useAppStore();
  const [modal, setModal] = useState<{ open: boolean; item: Item | null }>({ open: false, item: null });
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (ready) {
      loadItems().catch(() => setToast("加载事项失败，请重试"));
    }
  }, [ready, activeTab, loadItems]);

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2200);
  };

  const current = activeTab === OVERVIEW ? null : categories.find((c) => c.id === activeTab) ?? null;
  const canAdd = activeTab !== OVERVIEW && !!current;
  const title = current ? current.name : "总览";
  const catOf = (id: number): Category | undefined => categories.find((c) => c.id === id);

  const cal = items.filter(isCalendarItem).sort((a, b) =>
    (a.start_date ?? "").localeCompare(b.start_date ?? "") ||
    (a.start_time ?? "00:00").localeCompare(b.start_time ?? "00:00") ||
    a.id - b.id,
  );
  const todo = items.filter((it) => !isCalendarItem(it)).sort((a, b) =>
    (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31") ||
    (a.due_time ?? "00:00").localeCompare(b.due_time ?? "00:00") ||
    a.id - b.id,
  );

  const row = (it: Item) => {
    const cat = catOf(it.category_id);
    const inCal = isCalendarItem(it);
    const summary = inCal
      ? fmtTime(it.start_date!, it.start_time) + " ~ " + fmtTime(it.end_date!, it.end_time)
      : it.due_date
        ? "截止 " + fmtTime(it.due_date, it.due_time)
        : "长期规划";
    return (
      <div key={it.id} className="irow" onClick={() => setModal({ open: true, item: it })}>
        <span className="idot" style={{ background: cat?.color ?? "#9E9E9E" }} />
        <span className="ititle" title={it.title}>{it.title}</span>
        <span className="isum" title={summary}>{summary}</span>
        <span className={"ibadge " + (inCal ? "b-cal" : "b-todo")}>{inCal ? "日历" : "待办"}</span>
      </div>
    );
  };

  const group = (label: string, list: Item[]) => (
    <div className="igroup">
      <div className="ihead">{label}（{list.length}）</div>
      {list.length === 0 ? <div className="iempty">暂无事项</div> : list.map(row)}
    </div>
  );

  return (
    <main className="main">
      <div className="toolbar">
        <span className="title">{title}</span>
        {canAdd ? (
          <button type="button" className="btn-primary add" onClick={() => setModal({ open: true, item: null })}>
            + 新增事项
          </button>
        ) : null}
      </div>
      <div className="iv-body">
        {!ready ? <div className="placeholder">正在加载…</div> :
          items.length === 0 ? (
            <div className="placeholder">{canAdd ? "暂无事项，点右上角新增" : "暂无事项"}</div>
          ) : (
            <>
              {group("日历", cal)}
              {group("待办", todo)}
            </>
          )}
      </div>
      {modal.open ? (
        <ItemModal
          item={modal.item}
          categories={categories}
          defaultCategoryId={current?.id ?? categories[0]?.id ?? 0}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={(m) => showToast(m)}
          onDeleted={() => showToast("已删除")}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}
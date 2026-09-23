// 列表视图（PRD 6.10 v1.18）：全部日历+待办事项表格。
// 表头=标准字段+全部自定义字段动态列；分类/标题两列冻结（横向滚动固定）；
// 标题列宽 20 个汉字超出换行；分组行「日历/待办」横向固定；点击行打开编辑弹窗。
import { useEffect, useState } from "react";
import ItemModal from "../Items/ItemModal";
import { fieldApi, itemApi } from "../../services/ipc";
import type { CalendarItem, Category, FieldDef, Item, TodoItem } from "../../services/types";
import type { FieldType } from "../../services/types";
import { decodeFieldValue } from "../../features/fields/value";

interface Props {
  categories: Category[];
  /** 当前标签页分类；null=总览（全部）。 */
  scope: number | null;
}

/** 字段值 JSON → 列表显示文本（多选拼接、空值显示 —）。 */
function displayOf(type: FieldType, valueJson: string | null): string {
  const decoded = decodeFieldValue(type, valueJson);
  if (decoded === null) return "";
  if (Array.isArray(decoded)) return decoded.join("、");
  return String(decoded);
}

type AnyItem = CalendarItem | TodoItem;

export default function ListView({ categories, scope }: Props) {
  const [cal, setCal] = useState<CalendarItem[] | null>(null);
  const [todo, setTodo] = useState<TodoItem[] | null>(null);
  const [fields, setFields] = useState<FieldDef[] | null>(null);
  const [valueRows, setValueRows] = useState<Array<{ itemId: number; fieldDefId: number; valueJson: string | null }>>([]);
  const [modal, setModal] = useState<Item | null>(null);
  const [toast, setToast] = useState("");

  const load = async () => {
    try {
      // 超大窗口让日历查询返回全部有起止的事项（列表不按周期过滤，PRD 6.10）
      const [c, t, fs, vs] = await Promise.all([
        itemApi.calendar("1900-01-01", "2999-12-31", scope),
        itemApi.todo(scope),
        fieldApi.listAll(),
        fieldApi.allValues(),
      ]);
      setCal(c);
      setTodo(t);
      setFields(fs);
      setValueRows(vs);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "加载列表失败，请重试");
      window.setTimeout(() => setToast(""), 2400);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2400);
  };

  const openEdit = async (id: number) => {
    try {
      setModal(await itemApi.getDetail(id));
    } catch (e) {
      setToast(e instanceof Error ? e.message : "打开事项失败，请重试");
      window.setTimeout(() => setToast(""), 2400);
    }
  };

  const catOf = (id: number): Category | undefined => categories.find((c) => c.id === id);
  const valueMap = new Map(valueRows.map((r) => [`${r.itemId}:${r.fieldDefId}`, r.valueJson]));
  const loaded = cal !== null && todo !== null && fields !== null;
  const allCount = (cal?.length ?? 0) + (todo?.length ?? 0);
  const cols = 5 + (fields?.length ?? 0);

  const groupRow = (text: string) => (
    <tr className="lgroup">
      <td>{text}</td>
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <td key={i} />
      ))}
    </tr>
  );

  const listRow = (it: AnyItem) => {
    const c = catOf(item_category(it));
    const show = (key: "start" | "end" | "due"): string => {
      const d = itemField(it, `${key}_date`);
      const t = itemField(it, `${key}_time`);
      return d ? (t ? `${d} ${t}` : d) : "";
    };
    const cell = (v: string, cls = "lcell"): JSX.Element =>
      v === "" ? (
        <td className={cls}><span className="ldim">—</span></td>
      ) : (
        <td className={cls}>{v}</td>
      );
    return (
      <tr className="lrow" onClick={() => void openEdit(item_id(it))}>
        <td>
          <span className="dotc" style={{ background: c?.color ?? "#9E9E9E" }} />
          {c?.name ?? "—"}
        </td>
        <td className="ltitle">{item_title(it)}</td>
        {cell(show("start"))}
        {cell(show("end"))}
        {cell(show("due"))}
        {(fields ?? []).map((f) => cell(displayOf(f.type, valueMap.get(`${item_id(it)}:${f.id}`) ?? null)))}
      </tr>
    );
  };

  return (
    <div className="ltable-wrap">
      {toast ? <div className="toast">{toast}</div> : null}
      {!loaded ? (
        <div className="tempty" style={{ padding: 40 }}>加载中…</div>
      ) : allCount === 0 ? (
        <div className="tempty" style={{ padding: 40 }}>
          {scope === null ? "暂无事项" : "当前分类暂无事项"}
        </div>
      ) : (
        <table className="ltable">
          <thead>
            <tr>
              <th>分类</th>
              <th>标题</th>
              <th>开始</th>
              <th>结束</th>
              <th>截止</th>
              {(fields ?? []).map((f) => (
                <th key={f.id}>{f.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupRow(`日历（${cal?.length ?? 0}）`)}
            {(cal ?? [])
              .slice()
              .sort((a, b) => {
                const ka = a.start_date + (a.start_time ?? "");
                const kb = b.start_date + (b.start_time ?? "");
                return ka < kb ? -1 : ka > kb ? 1 : a.id - b.id;
              })
              .map((it) => listRow(it))}
            {groupRow(`待办（${todo?.length ?? 0}）`)}
            {(todo ?? [])
              .slice()
              .sort((a, b) => {
                const ka = a.due_date ?? "9999-12-31";
                const kb = b.due_date ?? "9999-12-31";
                return ka < kb ? -1 : ka > kb ? 1 : a.id - b.id;
              })
              .map((it) => listRow(it))}
          </tbody>
        </table>
      )}

      {modal ? (
        <ItemModal
          item={modal}
          categories={categories}
          defaultCategoryId={modal.category_id}
          allowCategoryPick={scope === null}
          onClose={() => setModal(null)}
          onSaved={(m) => { setModal(null); void load(); showToast(m); }}
          onDeleted={() => { setModal(null); void load(); showToast("已删除"); }}
        />
      ) : null}
    </div>
  );
}

// —— CalendarItem / TodoItem 的公共取值（两类型字段同名，联合访问需收窄辅助） ——
function item_id(it: AnyItem): number {
  return it.id;
}
function item_category(it: AnyItem): number {
  return it.category_id;
}
function item_title(it: AnyItem): string {
  return it.title;
}
function itemField(it: AnyItem, key: "start_date" | "start_time" | "end_date" | "end_time" | "due_date" | "due_time"): string | null {
  // CalendarItem/TodoItem 字段子集不同，联合访问经索引收窄
  return (it as unknown as Record<string, string | null>)[key];
}

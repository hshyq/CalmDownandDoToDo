// 列表视图（PRD 6.10 v1.19；原型定稿 2026-09-19）：全部日历+待办事项表格。
// 筛选区（搜索/范围/自定义日期/筛选/重置按钮）与表格分离渲染：
// 输入只更新状态不刷新表格（IME 安全），点「筛选」应用；「重置」仅清空条件。
// 表头=分类/标题/描述/归属/开始/结束/截止+全部自定义字段动态列（描述列居标题右侧、限宽省略、悬停看全文，v1.21）；
// 分类/标题两列冻结（横向滚动固定）、标题列宽 20 个汉字超出换行；
// 排序按结束日期升序（无结束以截止参与、均无沉底），今日线插在「≤今天」最后一条之后。
import { useEffect, useRef, useState } from "react";
import ItemModal from "../Items/ItemModal";
import { fieldApi, itemApi } from "../../services/ipc";
import type { Category, FieldDef, Item } from "../../services/types";
import type { FieldType } from "../../services/types";
import { decodeFieldValue } from "../../features/fields/value";
import { addDays } from "../../features/calendar/dates";
import { useAppStore } from "../../stores/appStore";

type RangeKey = "all" | "w" | "m1" | "m2" | "custom";
type AnyItem = Item;

interface Props {
  categories: Category[];
  /** 当前标签页分类；null=总览（全部）。 */
  scope: number | null;
}
type TableFilter = { q: string; range: RangeKey; cs: string; ce: string };

/** 字段值 JSON → 列表显示文本（多选拼接、空值显示 —）。 */
function displayOf(type: FieldType, valueJson: string | null): string {
  const decoded = decodeFieldValue(type, valueJson);
  if (decoded === null) return "";
  if (Array.isArray(decoded)) return decoded.join("、");
  return String(decoded);
}

/** 今天 + N 个月 − 1 天（目标月无同日钳到月末再减一天；与导出 TXT 口径一致）。 */
function addMonthsMinusOne(today: string, months: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const y2 = Math.floor(total / 12);
  const m2 = (total % 12) + 1;
  const dim = (yy: number, mm: number) =>
    mm === 2 ? ((yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0 ? 29 : 28)
      : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm - 1];
  const clamped = Math.min(d, dim(y2, m2));
  if (clamped >= 2) return `${y2}-${String(m2).padStart(2, "0")}-${String(clamped - 1).padStart(2, "0")}`;
  const t2 = y2 * 12 + (m2 - 1) - 1;
  const y3 = Math.floor(t2 / 12);
  const m3 = (t2 % 12) + 1;
  return `${y3}-${String(m3).padStart(2, "0")}-${String(dim(y3, m3)).padStart(2, "0")}`;
}

const todayISOStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface RowData {
  item: AnyItem;
  kind: "cal" | "todo";
}

export default function ListView({ categories, scope }: Props) {
  // 撤销/重做后 dataVersion 变化驱动本视图重查（与日历/待办一致；曾因此漏刷导致撤销后列表不显示恢复数据）
  const dataVersion = useAppStore((s) => s.dataVersion);
  const [items, setItems] = useState<Item[] | null>(null);
  const [fields, setFields] = useState<FieldDef[] | null>(null);
  const [valueRows, setValueRows] = useState<Array<{ itemId: number; fieldDefId: number; valueJson: string | null }>>([]);
  const [modal, setModal] = useState<Item | null>(null);
  const [toast, setToast] = useState("");
  // 多选与批量删除（PRD 6.10 v1.23）：选中 id 集合 + 删除二态确认
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmDel, setConfirmDel] = useState(false);

  // 筛选条件（筛选区即时更新状态；点「筛选」才应用到表格——IME 安全）
  // 范围默认「一个月内」（v1.22）：列表视图为条件渲染，每次进入重新挂载即恢复默认
  const [range, setRange] = useState<RangeKey>("m1");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const queryRef = useRef<HTMLInputElement | null>(null);
  const [tableFilter, setTableFilter] = useState<TableFilter>({ q: "", range: "m1", cs: "", ce: "" });

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2400);
  };

  const load = async () => {
    try {
      // 超大窗口让日历查询返回全部有起止的事项（列表不按周期过滤，PRD 6.10）
      const [its, fs, vs] = await Promise.all([
        itemApi.list(scope),
        fieldApi.listAll(),
        fieldApi.allValues(),
      ]);
      setItems(its);
      setFields(fs);
      setValueRows(vs);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加载列表失败，请重试");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, dataVersion]);

  const openEdit = async (id: number) => {
    try {
      setModal(await itemApi.getDetail(id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "打开事项失败，请重试");
    }
  };

  const catOf = (id: number): Category | undefined => categories.find((c) => c.id === id);
  const valueMap = new Map(valueRows.map((r) => [`${r.itemId}:${r.fieldDefId}`, r.valueJson]));
  const today = todayISOStr();
  const loaded = items !== null && fields !== null;
  const fieldList = fields ?? [];
  const cols = 8 + fieldList.length;

  // —— 按 tableFilter 过滤 + 排序 + 今日线位置 ——
  const inBounds = (it: AnyItem, f: TableFilter): boolean => {
    let s = today;
    let e = "";
    if (f.range === "w") e = addDays(today, 7);
    else if (f.range === "m1") e = addMonthsMinusOne(today, 1);
    else if (f.range === "m2") e = addMonthsMinusOne(today, 2);
    else { s = f.cs; e = f.ce; }
    if (!s || !e) return true;
    const sd = item_field(it, "start_date");
    const ed = item_field(it, "end_date");
    const dd = item_field(it, "due_date");
    if (sd && ed) return sd <= e && ed >= s;
    if (dd) return dd >= s && dd <= e;
    return false; // 范围筛选下无截止待办不显示（同 TXT 导出语义）
  };

  const visible: RowData[] = [];
  let nowInsertAt = 0;
  if (loaded) {
    const q = tableFilter.q.toLowerCase();
    const match = (it: Item): boolean => {
      if (!(scope === null || it.category_id === scope)) return false;
      if (q !== "" && !it.title.toLowerCase().includes(q)) return false;
      return inBounds(it, tableFilter);
    };
    // 统一排序：结束日期升序（无结束以截止参与，均无沉底），不分归属段
    const visibleSorted = (items ?? [])
      .filter(match)
      .sort((a: Item, b: Item) => {
        const ka = sortKeyOfItem(a);
        const kb = sortKeyOfItem(b);
        return ka < kb ? -1 : ka > kb ? 1 : a.id - b.id;
      })
      .map((it: Item) => ({
        item: it,
        // 归属按事项实际字段推导：起止完整=日历，否则=待办（PRD 5.1）
        kind: (it.start_date && it.end_date ? "cal" : "todo") as "cal" | "todo",
      }));
    // 今日线位置：排序键（结束/截止）≤ 今天的最后一条之后
    visibleSorted.forEach((r, i) => {
      if (sortKeyOfItem(r.item) <= today) nowInsertAt = i + 1;
    });
    visible.push(...visibleSorted);
  }
  const merged: RowData[] = visible;

  const applyFilter = () => {
    setTableFilter({
      q: queryRef.current ? queryRef.current.value : "",
      range,
      cs: customStart,
      ce: customEnd,
    });
  };

  const resetFilter = () => {
    // 仅清空筛选条件恢复默认（一个月内），不刷新列表数据（v1.19 用户要求、v1.22 默认范围改一个月内）
    setRange("m1");
    setCustomStart("");
    setCustomEnd("");
    if (queryRef.current) queryRef.current.value = "";
  };

  // —— 多选与批量删除（v1.23）——
  const mergedIds = merged.map((r) => item_id(r.item));
  const allChecked = mergedIds.length > 0 && mergedIds.every((id) => selected.has(id));
  const someChecked = mergedIds.some((id) => selected.has(id));

  const toggleSelect = (id: number, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    setConfirmDel(false);
  };
  const toggleAll = (on: boolean) => {
    // 全选/取消仅作用于当前显示行；不在当前显示的选中项保持不变
    setSelected((prev) => {
      const next = new Set(prev);
      mergedIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
    setConfirmDel(false);
  };
  const doBatchDelete = async () => {
    const ids = [...selected];
    try {
      const n = await itemApi.removeBatch(ids);
      setSelected(new Set());
      setConfirmDel(false);
      await load();
      showToast(`已删除 ${n} 条，可 Ctrl+Z 撤销`);
    } catch (e) {
      setConfirmDel(false);
      showToast(e instanceof Error ? e.message : "删除失败，请重试");
    }
  };

  const rowElement = (r: RowData): JSX.Element => {
    const c = catOf(item_category(r.item));
    const kind = r.kind === "cal" ? "日历" : "待办";
    const cell = (v: string): JSX.Element =>
      v === "" ? (
        <td className="lcell"><span className="ldim">—</span></td>
      ) : (
        <td className="lcell">{v}</td>
      );
    /** 描述单元格：限宽单行省略、悬停 title 看全文、未填显示 —（v1.21）。 */
    const descCell = (v: string | null): JSX.Element =>
      v === null || v === "" ? (
        <td className="ldesc"><span className="ldim">—</span></td>
      ) : (
        <td className="ldesc" title={v}>{v}</td>
      );
    const show = (key: "start" | "end" | "due"): string => {
      const d = item_field(r.item, `${key}_date`);
      const t = item_field(r.item, `${key}_time`);
      return d ? (t ? `${d} ${t}` : d) : "";
    };
    return (
      <tr className="lrow" onClick={() => void openEdit(item_id(r.item))}>
        <td className="lsel">
          <input
            type="checkbox"
            className="lchk"
            checked={selected.has(item_id(r.item))}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => toggleSelect(item_id(r.item), e.target.checked)}
          />
        </td>
        <td>
          <span className="dotc" style={{ background: c?.color ?? "#9E9E9E" }} />
          {c?.name ?? "—"}
        </td>
        <td className="ltitle">{item_title(r.item)}</td>
        {descCell(r.item.description)}
        {cell(kind)}
        {cell(show("start"))}
        {cell(show("end"))}
        {cell(show("due"))}
        {fieldList.map((f) => cell(displayOf(f.type, valueMap.get(`${item_id(r.item)}:${f.id}`) ?? null)))}
      </tr>
    );
  };

  const bodyRows: JSX.Element[] = [];
  if (loaded) {
    if (nowInsertAt === 0) bodyRows.push(<NowLine key="nl-head" cols={cols} />);
    merged.forEach((r, i) => {
      bodyRows.push(rowElement(r));
      if (nowInsertAt === i + 1) {
        bodyRows.push(<NowLine key={`nl-${i}`} cols={cols} />);
      }
    });
  }

  return (
    <div className="listview">
      {toast ? <div className="toast">{toast}</div> : null}
      <div className="lsearch">
        <input ref={queryRef} type="text" placeholder="搜索标题…" title="输入后点击「筛选」应用（支持中文输入）" />
        <select value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
          <option value="all">全部</option>
          <option value="w">一周内</option>
          <option value="m1">一个月内</option>
          <option value="m2">两个月内</option>
          <option value="custom">自定义</option>
        </select>
        {range === "custom" ? (
          <span className="lcustom">
            开始 <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            结束 <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </span>
        ) : null}
        <button type="button" className="btn-primary" onClick={applyFilter}>筛选</button>
        <button type="button" className="btn-ghost" onClick={resetFilter}>重置</button>
        <span className="lsearch-count">{loaded ? `共 ${merged.length} 条` : ""}</span>
        {selected.size > 0 ? (
          <span className="lselbar">
            {confirmDel ? (
              <>
                <button type="button" className="btn-danger" onClick={() => void doBatchDelete()}>确认删除 {selected.size} 条？</button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmDel(false)}>取消</button>
              </>
            ) : (
              <button type="button" className="btn-danger" onClick={() => setConfirmDel(true)}>删除所选 ({selected.size})</button>
            )}
          </span>
        ) : null}
      </div>
      <div className="ltable-wrap">
        {!loaded ? (
          <div className="tempty" style={{ padding: 40 }}>加载中…</div>
        ) : merged.length === 0 ? (
          <div className="tempty" style={{ padding: 40 }}>
            {tableFilter.q ? `没有匹配「${tableFilter.q}」的事项` : scope === null ? "暂无事项" : "当前分类暂无事项"}
          </div>
        ) : (
          <table className="ltable">
            <thead>
              <tr>
                <th className="lsel">
                  <input
                    type="checkbox"
                    className="lchk"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked && !allChecked;
                    }}
                    onChange={(e) => toggleAll(e.target.checked)}
                    title="全选当前显示行"
                  />
                </th>
                <th>分类</th>
                <th>标题</th>
                <th>描述</th>
                <th>归属</th>
                <th>开始</th>
                <th>结束</th>
                <th>截止</th>
                {fieldList.map((f) => (
                  <th key={f.id}>{f.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>{bodyRows}</tbody>
          </table>
        )}
      </div>

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

// —— 联合类型取值辅助 ——
function item_id(it: AnyItem): number {
  return it.id;
}
function item_category(it: AnyItem): number {
  return it.category_id;
}
function item_title(it: AnyItem): string {
  return it.title;
}
function item_field(it: AnyItem, key: "start_date" | "start_time" | "end_date" | "end_time" | "due_date" | "due_time"): string | null {
  // CalendarItem/TodoItem 字段子集不同，联合访问经索引收窄
  return (it as unknown as Record<string, string | null>)[key];
}
function sortKeyOfItem(it: AnyItem): string {
  return item_field(it, "end_date") || item_field(it, "due_date") || "9999-12-31";
}

/** 今日线行（红色虚线，无文字标签；v1.19 用户确认）。 */
function NowLine({ cols }: { cols: number }): JSX.Element {
  return (
    <tr className="lnowline">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} />
      ))}
    </tr>
  );
}

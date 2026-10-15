// 打卡视图（PRD 6.11 v1.25；v1.30 移除「＋ 添加打卡」按钮与弹窗，记录创建走「今天打卡」/事项弹窗勾打卡）：
// 工具栏「打卡」第四态。全部=每个打卡项一条紧凑热力带+统计；点单项=聚焦大热力图（列=周、行=周一~周日）+记录列表。
// 悬停方块即时显示「yyyy-MM-dd，n 次」（自定义 tooltip，原生 title 有 ~1s 延迟）。
import { useEffect, useMemo, useState } from "react";
import ItemModal from "../Items/ItemModal";
import { useAppStore } from "../../stores/appStore";
import { habitApi, itemApi, inTauri } from "../../services/ipc";
import { mockHabitApi, mockItemApi } from "../../services/mock";
import type { Category, Habit, Item } from "../../services/types";
import { addDays, todayISO } from "../../features/calendar/dates";
import {
  RANGE_DAYS,
  RANGE_LABEL,
  attributionDate,
  bucketize,
  dateSeq,
  levelOf,
  monthMarks,
  statsOf,
  weekColumns,
  type CkRange,
} from "../../features/checkin/heatmap";
import { decodeHabitTemplate } from "../../features/checkin/template";

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

interface Props {
  categories: Category[];
}

export default function CheckinView({ categories }: Props) {
  // 撤销/重做与写操作后 dataVersion 变化驱动重查（与其他视图一致）
  const dataVersion = useAppStore((s) => s.dataVersion);
  const createItem = useAppStore((s) => s.createItem);
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [range, setRange] = useState<CkRange>("1m");
  const [focus, setFocus] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [toast, setToast] = useState("");
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const today = todayISO();
  const habitSrc = inTauri() ? habitApi : mockHabitApi;
  const itemSrc = inTauri() ? itemApi : mockItemApi;
  const days = RANGE_DAYS[range];
  const start = addDays(today, -(days - 1));

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2400);
  };

  const load = async () => {
    try {
      const [hs, cks] = await Promise.all([habitSrc.list(), itemSrc.checkins(start, today)]);
      setHabits(hs);
      setItems(cks);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加载打卡数据失败，请重试");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, dataVersion]);

  const bucket = useMemo(() => bucketize(items ?? []), [items]);
  const seq = useMemo(() => dateSeq(start, today), [start, today]);
  const habitOf = (id: number | null): Habit | undefined => habits?.find((h) => h.id === id);
  const uncatId = categories.find((c) => c.kind === "uncategorized")?.id ?? categories[0]?.id ?? 1;

  /** 方块：色=打卡项颜色（档位 color-mix 深浅，见 .cksq 样式）；悬停即时提示。 */
  const Square = ({ habitId, date }: { habitId: number; date: string }) => {
    const n = bucket.get(habitId)?.get(date) ?? 0;
    const color = habitOf(habitId)?.color ?? "#4F8EF7";
    return (
      <span
        className={`cksq lv${levelOf(n)}`}
        style={{ ["--ck" as string]: color }}
        onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text: `${date}，${n} 次` })}
        onMouseLeave={() => setTip(null)}
      />
    );
  };

  const quickCheckin = async (h: Habit) => {
    // 带出打卡项模板（v1.25 ③）：分类/标题/字段值
    const tpl = decodeHabitTemplate(h.template_json);
    const fieldValues = tpl
      ? Object.entries(tpl.values)
          .filter(([, v]) => v !== null)
          .map(([k, v]) => ({ fieldDefId: Number(k), value: v }))
      : undefined;
    try {
      await createItem({
        categoryId: tpl?.categoryId ?? uncatId,
        title: tpl?.title || h.name,
        description: null,
        startDate: today,
        startTime: null,
        endDate: today,
        endTime: null,
        dueDate: null,
        dueTime: null,
        isCheckin: true,
        habitId: h.id,
        fieldValues,
      });
      showToast(`已打卡「${h.name}」（今天）`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "打卡失败，请重试");
    }
  };

  const openEdit = async (id: number) => {
    try {
      setEditItem(await itemSrc.getDetail(id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "打开事项失败，请重试");
    }
  };

  // —— 渲染 ——
  const chips = (
    <div className="ckchips">
      <button type="button" className={`ckchip${focus === null ? " on" : ""}`} onClick={() => setFocus(null)}>全部</button>
      {(habits ?? []).map((h) => (
        <button type="button" key={h.id} className={`ckchip${focus === h.id ? " on" : ""}`} onClick={() => setFocus(h.id)}>
          <span className="dotc" style={{ background: h.color }} />
          {h.name}
        </button>
      ))}
    </div>
  );

  const body = (() => {
    if (habits === null) return <div className="tempty" style={{ padding: 40 }}>加载中…</div>;
    if (habits.length === 0) {
      return <div className="tempty" style={{ padding: 40 }}>还没有打卡项——可在「设置→打卡项」创建，或编辑事项时勾选「打卡」输入新名称</div>;
    }
    if (focus === null) {
      // 全部总览：每项一条紧凑热力带 + 统计 + 今天打卡（靠右）。
      // 热力带按页面宽度自适应换行（v1.27）：flex-wrap 等宽方块自动折行，每行格数一致（末行除外），无需左右滑动。
      return habits.map((h) => {
        const st = statsOf(bucket.get(h.id) ?? new Map(), today);
        return (
          <div key={h.id} className="ckband-row" onClick={() => setFocus(h.id)} title="点击查看大图">
            <div className="ckband-head">
              <span className="dotc" style={{ background: h.color }} />
              <b>{h.name}</b>
              <span className="ckstats">
                今日{st.today > 0 ? `√${st.today}` : "—"} · 连续 {st.streak} 天 · 本月 {st.month} 次
              </span>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="btn-primary ck-quick-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  void quickCheckin(h);
                }}
              >
                今天打卡
              </button>
            </div>
            <div className="ckband">
              {seq.map((d) => (
                <Square key={d} habitId={h.id} date={d} />
              ))}
            </div>
          </div>
        );
      });
    }
    // 聚焦：大热力图（列=周、行=周一~周日）+ 统计 + 记录列表
    const h = habitOf(focus);
    if (!h) return null;
    const st = statsOf(bucket.get(h.id) ?? new Map(), today);
    const cols = weekColumns(start, today);
    const marks = monthMarks(cols);
    const recs = (items ?? []).filter((it) => it.habit_id === h.id).slice(0, 12);
    return (
      <div>
        <div className="ckhead">
          <span className="dotc" style={{ background: h.color }} />
          <b>{h.name}</b>
          <span className="ckstats">
            今日{st.today > 0 ? `√${st.today} 次` : "—"} · 连续 {st.streak} 天 · 本月 {st.month} 次
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn-primary" onClick={() => void quickCheckin(h)}>今天打卡</button>
        </div>
        <div className="ckbig-wrap" onMouseLeave={() => setTip(null)}>
          <div className="ckgrid">
            <div className="ckcorner" />
            <div className="ckmonths">
              {cols.map((w, i) => (
                <span key={w} className="ckm">{marks.get(i) ?? ""}</span>
              ))}
            </div>
            <div className="ckweeks">{WEEK_LABELS.map((x) => <span key={x}>{x}</span>)}</div>
            <div className="ckcols">
              {cols.map((w) => (
                <div key={w} className="ckcol">
                  {WEEK_LABELS.map((_, i) => {
                    const d = addDays(w, i);
                    return d < start || d > today ? (
                      <span key={d} className="cksq void" />
                    ) : (
                      <Square key={d} habitId={h.id} date={d} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="cksub">记录（近 {recs.length} 条，点击编辑）</div>
        <div className="cklist">
          {recs.length === 0 ? (
            <div className="ldim">暂无记录</div>
          ) : (
            recs.map((it) => (
              <div key={it.id} className="ckitem" onClick={() => void openEdit(it.id)}>
                <span className="ldim">{attributionDate(it)}</span>
                {it.description || it.title}
              </div>
            ))
          )}
        </div>
      </div>
    );
  })();

  return (
    <div className="ckview">
      {toast ? <div className="toast">{toast}</div> : null}
      {tip ? (
        <div className="cktip" style={{ left: tip.x, top: tip.y - 34 }}>
          {tip.text}
        </div>
      ) : null}
      <div className="ckbar">
        {chips}
        <div className="ckranges">
          {(Object.keys(RANGE_DAYS) as CkRange[]).map((r) => (
            <button type="button" key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      <div className="ckbody">{body}</div>

      {editItem ? (
        <ItemModal
          item={editItem}
          categories={categories}
          defaultCategoryId={editItem.category_id}
          onClose={() => setEditItem(null)}
          onSaved={(m) => {
            setEditItem(null);
            void load();
            showToast(m);
          }}
          onDeleted={() => {
            setEditItem(null);
            void load();
            showToast("已删除");
          }}
        />
      ) : null}
    </div>
  );
}


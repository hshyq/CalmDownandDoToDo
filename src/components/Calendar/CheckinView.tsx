// 打卡视图（PRD 6.11 v1.25）：工具栏「打卡」第四态。
// 全部=每个打卡项一条紧凑热力带+统计；点单项=聚焦大热力图（列=周、行=周一~周日）+记录列表。
// 悬停方块即时显示「yyyy-MM-dd，n 次」（自定义 tooltip，原生 title 有 ~1s 延迟）。
import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../Modal/Modal";
import CatSelect from "../Items/CatSelect";
import ItemModal from "../Items/ItemModal";
import FieldEditor from "../fields/FieldEditor";
import { useAppStore } from "../../stores/appStore";
import { fieldApi, habitApi, itemApi, inTauri } from "../../services/ipc";
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
import { buildFieldPayloads, decodeFieldValue } from "../../features/fields/value";
import type { FieldEditValue } from "../../features/fields/value";
import type { FieldDef } from "../../services/types";

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
  const [range, setRange] = useState<CkRange>("3m");
  const [focus, setFocus] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
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
      return <div className="tempty" style={{ padding: 40 }}>还没有打卡项——点击右上「＋ 添加打卡」创建第一个</div>;
    }
    if (focus === null) {
      // 全部总览：每项一条紧凑热力带 + 统计 + 今天打卡（靠右）
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
        <span style={{ flex: 1 }} />
        <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>＋ 添加打卡</button>
      </div>
      <div className="ckbody">{body}</div>

      {addOpen ? (
        <AddCheckinModal
          habits={habits ?? []}
          categories={categories}
          onCreateHabit={async (name) => {
            const h = await habitSrc.create(name, "#4F8EF7");
            setHabits((prev) => [...(prev ?? []), h]);
            return h.id;
          }}
          today={today}
          uncatId={uncatId}
          onClose={() => setAddOpen(false)}
          onSaved={async (msg) => {
            setAddOpen(false);
            showToast(msg);
            await load();
          }}
        />
      ) : null}

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

/** 添加打卡弹窗（PRD 6.11 v1.25）：打卡项（可选已有/输新名即建）+ 日期（默认今天，可补卡）+ 备注；
 *  选打卡项带出模板（分类/标题/字段值，v1.25 ③），带出后可编辑。 */
function AddCheckinModal({
  habits,
  categories,
  onCreateHabit,
  today,
  uncatId,
  onClose,
  onSaved,
}: {
  habits: Habit[];
  categories: Category[];
  onCreateHabit: (name: string) => Promise<number>;
  today: string;
  uncatId: number;
  onClose: () => void;
  onSaved: (msg: string) => void | Promise<void>;
}) {
  const createItem = useAppStore((s) => s.createItem);
  const [habitId, setHabitId] = useState<number>(habits[0]?.id ?? 0);
  const [catId, setCatId] = useState<number>(uncatId);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [desc, setDesc] = useState("");
  const [defs, setDefs] = useState<FieldDef[] | null>(null);
  const [fv, setFv] = useState<Record<number, FieldEditValue>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  /** 选打卡项 → 带出模板；新项无模板时回落（未分类 + 项名作标题）。 */
  const applyHabit = (hid: number) => {
    setHabitId(hid);
    const h = habits.find((x) => x.id === hid);
    const tpl = decodeHabitTemplate(h?.template_json ?? null);
    setCatId(tpl?.categoryId ?? uncatId);
    setTitle(tpl?.title || h?.name || "");
    setFv({});
    if (tpl) {
      // 模板值并进 valsJson 供 defs 加载后预填
      valsJsonRef.current = tpl.values;
    } else {
      valsJsonRef.current = {};
    }
  };

  // 模板值缓冲（避免闭包时序）：defs 按 catId 加载完成时读取
  const valsJsonRef = useRef<Record<string, string | null>>({});

  // 初始（首个打卡项）带出
  useEffect(() => {
    if (habits.length > 0) applyHabit(habits[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 分类变化 → 按新分类加载字段定义；预填模板值（仅首次带出，手动切分类清空）
  useEffect(() => {
    let alive = true;
    setDefs(null);
    fieldApi.list(catId)
      .then((ds) => {
        if (!alive) return;
        setDefs(ds);
        const next: Record<number, FieldEditValue> = {};
        for (const d of ds) {
          const raw = valsJsonRef.current[String(d.id)];
          if (raw !== undefined && raw !== null) {
            const decoded = decodeFieldValue(d.type, raw);
            if (decoded !== null) next[d.id] = decoded;
          }
        }
        setFv(next);
      })
      .catch(() => {
        if (alive) setDefs([]);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catId]);

  const save = async () => {
    if (habits.length === 0) {
      setErr("请先输入新打卡项名称创建打卡项");
      return;
    }
    if (!date) {
      setErr("请选择打卡日期");
      return;
    }
    const h = habits.find((x) => x.id === habitId);
    if (!h) {
      setErr("请选择打卡项");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await createItem({
        categoryId: catId,
        title: title.trim() || h.name,
        description: desc.trim() || null,
        startDate: date,
        startTime: null,
        endDate: date,
        endTime: null,
        dueDate: null,
        dueTime: null,
        isCheckin: true,
        habitId: h.id,
        fieldValues: (defs ?? []).length > 0 ? buildFieldPayloads(defs ?? [], fv) : undefined,
      });
      await onSaved(`已添加打卡「${h.name}」 ${date}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="添加打卡"
      onClose={onClose}
      width={420}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>取消</button>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}>保存</button>
        </>
      }
    >
      <div className="iform">
        <div className="frow">
          <label>打卡项</label>
          {habits.length > 0 ? (
            <CatSelect items={habits} value={habitId} onChange={applyHabit} onCreate={onCreateHabit} />
          ) : (
            <NewHabitInput onCreate={onCreateHabit} onCreated={applyHabit} placeholder="输入名称创建第一个打卡项" />
          )}
        </div>
        <div className="frow">
          <label>所属分类</label>
          <CatSelect
            items={categories}
            value={catId}
            onChange={(id) => {
              setCatId(id);
              valsJsonRef.current = {}; // 手动切分类清空带出值（值不跨分类迁移）
            }}
          />
        </div>
        <div className="frow">
          <label>标题</label>
          <input type="text" maxLength={100} value={title} placeholder="默认用打卡项名称" onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="frow">
          <label>日期</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="frow">
          <label>备注</label>
          <textarea rows={3} value={desc} placeholder="存入描述字段，可空" onChange={(e) => setDesc(e.target.value)} />
        </div>
        {defs === null ? null : defs.length === 0 ? null : (
          <div className="fsec">
            <div className="sec-t">自定义字段（随所属分类的模板变化）</div>
            {defs.map((d) => (
              <div key={d.id} className="frow fv-row">
                <label>{d.name}</label>
                <FieldEditor
                  field={d}
                  value={fv[d.id] ?? (d.type === "multi_choice" ? [] : "")}
                  onChange={(v) => setFv((prev) => ({ ...prev, [d.id]: v }))}
                />
              </div>
            ))}
          </div>
        )}
        {err !== "" ? <div className="ferr show">{err}</div> : null}
      </div>
    </Modal>
  );
}

/** 打卡项为空时的内联新建输入（创建后选中）。 */
function NewHabitInput({
  onCreate,
  onCreated,
  placeholder,
}: {
  onCreate: (name: string) => Promise<number>;
  onCreated: (id: number) => void;
  placeholder: string;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const create = async () => {
    if (busy || name.trim() === "") return;
    setBusy(true);
    setErr("");
    try {
      onCreated(await onCreate(name.trim()));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "创建失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span style={{ display: "flex", gap: 6, flex: 1, alignItems: "center" }}>
      <input
        type="text"
        value={name}
        maxLength={30}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void create();
        }}
      />
      <button type="button" className="btn-ghost" disabled={busy || name.trim() === ""} onClick={() => void create()}>
        创建
      </button>
      {err !== "" ? <span className="ldim">{err}</span> : null}
    </span>
  );
}

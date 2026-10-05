// 事项 新增/编辑 弹窗：标准字段 + P6 自定义字段区（PRD 4.3/6.3/6.4）。
// 字段区按当前所属分类模板渲染；切分类旧值保留在库中不再显示，切回恢复（PRD 4.3）。
// 打卡区（PRD 6.11 v1.25）：勾选后额外计入打卡视图；取消勾选保留打卡项关联（再勾自动带出）。
import CatSelect from "./CatSelect";
import { useEffect, useRef, useState } from "react";
import Modal from "../Modal/Modal";
import FieldEditor from "../fields/FieldEditor";
import { SegDateInput, SegTimeInput } from "../fields/SegInputs";
import { useAppStore } from "../../stores/appStore";
import { fieldApi, habitApi, inTauri } from "../../services/ipc";
import { mockHabitApi } from "../../services/mock";
import { buildFieldPayloads, decodeFieldValue } from "../../features/fields/value";
import type { FieldEditValue } from "../../features/fields/value";
import { decodeHabitTemplate } from "../../features/checkin/template";
import type { Category, FieldDef, Habit, Item } from "../../services/types";

interface Props {
  item: Item | null; // null=新增
  categories: Category[];
  defaultCategoryId: number; // 新增默认=当前分类；总览格「+」时传第一个分类
  allowCategoryPick?: boolean; // 总览页新增无默认分类 → 弹窗显示所属分类下拉（PRD 6.3 v1.6）
  presetStartDate?: string; // 日历格「+」预填开始日期（PRD 6.3）
  onClose: () => void;
  onSaved: (msg: string) => void;
  onDeleted: () => void;
}

interface FormState {
  title: string;
  description: string;
  sd: string; st: string; ed: string; et: string; dd: string; dt: string;
}

function empty(item: Item | null, presetStartDate = ""): FormState {
  return {
    title: item?.title ?? "",
    description: item?.description ?? "",
    sd: item?.start_date ?? presetStartDate, st: item?.start_time ?? "",
    // 新增时结束日期与开始日期同预填该格日期（时刻为空，PRD 6.3 v1.8）；编辑用原值
    ed: item?.end_date ?? (presetStartDate || ""), et: item?.end_time ?? "",
    dd: item?.due_date ?? "", dt: item?.due_time ?? "",
  };
}

/** 打卡项模板字段值「仅补空」合并（PRD 6.11 v1.26）：模板有值且当前字段无值（undefined/null）才写入，已有值不覆盖。 */
function mergeTplValues(
  prev: Map<number, string | null>,
  values: Record<string, string | null>,
): Map<number, string | null> {
  const next = new Map(prev);
  for (const [k, v] of Object.entries(values)) {
    const id = Number(k);
    if (v !== null && (next.get(id) === undefined || next.get(id) === null)) next.set(id, v);
  }
  return next;
}

export default function ItemModal({ item, categories, defaultCategoryId, allowCategoryPick = false, presetStartDate = "", onClose, onSaved, onDeleted }: Props) {
  const { createItem, updateItem, deleteItem } = useAppStore();
  const isEdit = item !== null;
  const [catId, setCatId] = useState<number>(isEdit ? item!.category_id : defaultCategoryId);
  const [f, setF] = useState<FormState>(empty(item, presetStartDate));
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  // —— 打卡区状态（PRD 6.11 v1.25）——
  const [isCheckin, setIsCheckin] = useState(isEdit ? item!.is_checkin : false);
  const [habitId, setHabitId] = useState<number | null>(isEdit ? item!.habit_id : null);
  const [habits, setHabits] = useState<Habit[]>([]);

  // 弹窗打开即加载打卡项（勾选时下拉可选；支持下拉内输新名即建）
  useEffect(() => {
    let alive = true;
    (inTauri() ? habitApi : mockHabitApi)
      .list()
      .then((hs) => { if (alive) setHabits(hs); })
      .catch(() => { /* 打卡项加载失败不阻塞普通事项编辑；勾选时校验兜底 */ });
    return () => { alive = false; };
  }, []);

  const createHabitHere = async (name: string): Promise<number> => {
    const h = await (inTauri() ? habitApi : mockHabitApi).create(name, "#4F8EF7");
    setHabits((prev) => [...(prev ?? []), h]);
    return h.id;
  };

  /** 选打卡项 → 带出模板（v1.25 ③；v1.26 改仅补空）：标题/字段只在当前为空时带入，已有值不覆盖；
   *  分类仅新增场景（总览新增弹窗）切换，编辑已有事项不改变其分类与标题。
   *  字段值并入 valsMap（仅补空），经 [defs, valsMap] 重建流程按分类模板预填（与编辑回显同一路径）。 */
  const applyHabitTemplate = (hid: number) => {
    const h = habits.find((x) => x.id === hid);
    const tpl = decodeHabitTemplate(h?.template_json ?? null);
    if (!h) return;
    if (tpl) {
      if (
        !isEdit && allowCategoryPick && tpl.categoryId !== null && tpl.categoryId !== catId
      ) {
        setCatId(tpl.categoryId);
      }
      // 编辑场景字段值可能尚未加载完（毫秒级窗口）：暂存待加载完成后合并，避免竞态覆盖或丢失
      if (isEdit && !valsReady) {
        pendingTplValuesRef.current = tpl.values;
      } else {
        setValsMap((prev) => mergeTplValues(prev, tpl.values));
      }
      setValsReady(true);
    }
    setF((prev) => (prev.title.trim() === "" ? { ...prev, title: tpl?.title || h.name } : prev));
  };

  // —— P6 自定义字段状态 ——
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [defLoading, setDefLoading] = useState(false);
  const [valsMap, setValsMap] = useState<Map<number, string | null>>(new Map());
  const [valsReady, setValsReady] = useState(!isEdit);
  const [fv, setFv] = useState<Record<number, FieldEditValue>>({});
  // 值未加载完时勾打卡选模板的暂存（v1.26 仅补空带出的竞态兜底）
  const pendingTplValuesRef = useRef<Record<string, string | null> | null>(null);

  // 编辑时加载该事项全部字段值（跨分类保留；展示层按当前模板过滤，PRD 4.3）
  useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    fieldApi.listItemValues(item!.id)
      .then((rows) => {
        if (!alive) return;
        const m = new Map(rows.map((r) => [r.field_def_id, r.value_json]));
        const pending = pendingTplValuesRef.current;
        if (pending) {
          pendingTplValuesRef.current = null;
          setValsMap(mergeTplValues(m, pending)); // 现有值先落，模板仅补空
        } else {
          setValsMap(m);
        }
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : "加载字段值失败，请重试");
      })
      .finally(() => {
        if (alive) setValsReady(true);
      });
    return () => { alive = false; };
  }, [isEdit, item]);

  // 分类变化 → 按新分类模板加载字段定义（新增：无历史值）
  useEffect(() => {
    let alive = true;
    setDefLoading(true);
    fieldApi.list(catId)
      .then((ds) => {
        if (alive) setDefs(ds);
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : "加载字段模板失败，请重试");
        if (alive) setDefs([]);
      })
      .finally(() => {
        if (alive) setDefLoading(false);
      });
    return () => { alive = false; };
  }, [catId]);

  // 模板与值就绪后，按当前模板重建编辑值（未填=空，空字符串/空数组在编码时置 null）
  useEffect(() => {
    if (!valsReady) return;
    const next: Record<number, FieldEditValue> = {};
    for (const d of defs) {
      const raw = valsMap.get(d.id);
      if (raw !== undefined && raw !== null) {
        const decoded = decodeFieldValue(d.type, raw);
        if (decoded !== null) next[d.id] = decoded;
      }
    }
    setFv(next);
  }, [defs, valsReady, valsMap, catId]);

  const set = (k: keyof FormState, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  const validate = (): string | null => {
    if (!f.title.trim()) return "标题不能为空";
    if (f.st && !f.sd) return "开始时间未填日期时不能只填时刻";
    if (f.et && !f.ed) return "结束时间未填日期时不能只填时刻";
    if (f.dt && !f.dd) return "截止时间未填日期时不能只填时刻";
    if (f.sd && f.ed && f.ed < f.sd) return "结束时间的日期不能早于开始时间";
    // 打卡校验（PRD 6.11 v1.25）：勾选需打卡项与归属日期（开始优先/截止兜底）
    if (isCheckin) {
      if (habits.length === 0) return "暂无打卡项，请先在「设置→打卡项」或打卡视图创建";
      if (habitId === null) return "请选择打卡项";
      if (!f.sd && !f.dd) return "勾选打卡需要开始或截止日期（打卡归属日期）";
    }
    return null;
  };

  const save = async () => {
    const msg = validate();
    if (msg) { setErr(msg); return; }
    setBusy(true);
    setErr("");
    const draft = {
      categoryId: catId,
      title: f.title.trim(),
      description: f.description || null,
      startDate: f.sd || null,
      startTime: f.st || null,
      endDate: f.ed || null,
      endTime: f.et || null,
      dueDate: f.dd || null,
      dueTime: f.dt || null,
      // 打卡身份（v1.25）：取消勾选时 habitId 传原值保留关联（再勾选自动带出）
      isCheckin,
      habitId: isCheckin ? habitId : isEdit ? item!.habit_id : null,
      // P6：仅覆盖当前分类模板字段；切分类不传旧分类字段 → 库中旧值保留（PRD 4.3）
      fieldValues: defs.length > 0 ? buildFieldPayloads(defs, fv) : undefined,
    };
    try {
      if (isEdit) {
        await updateItem(item!.id, draft);
        onSaved("已保存");
      } else {
        await createItem(draft);
        const inCal = !!(draft.startDate && draft.endDate);
        onSaved(inCal ? "已保存：进入日历" : "已保存：进入待办");
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true);
    try {
      await deleteItem(item!.id);
      onDeleted();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "删除失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  // 日期/时刻分段输入（PRD 6.3 v1.17）：年最多 4 位满位自动跳段；图标弹原生选择器
  const field = (label: string, dateKey: keyof FormState, timeKey: keyof FormState) => (
    <div className="frow">
      <label>{label}</label>
      <SegDateInput value={f[dateKey]} onChange={(v) => set(dateKey, v)} />
      <SegTimeInput value={f[timeKey]} onChange={(v) => set(timeKey, v)} />
    </div>
  );

  return (
    <Modal
      title={isEdit ? "编辑事项" : "新增事项"}
      onClose={onClose}
      width={520}
      closeOnOverlayClick={!busy}
      footer={
        <>
          {isEdit ? (
            <button type="button" className="btn-danger left" disabled={busy} onClick={() => setConfirmDel(true)}>
              删除
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn-ghost" onClick={onClose}>取消</button>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}>保存</button>
        </>
      }
    >
      <div className="iform">
        {isEdit || allowCategoryPick ? (
          <div className="frow">
            <label>所属分类</label>
            <CatSelect
              items={[...categories.filter((c) => c.kind !== "uncategorized"), ...categories.filter((c) => c.kind === "uncategorized")]}
              value={catId}
              onChange={(id) => setCatId(id)}
            />
          </div>
        ) : null}
        <div className="frow">
          <label>打卡</label>
          <label className="ckbox">
            <input
              type="checkbox"
              checked={isCheckin}
              onChange={(e) => {
                setIsCheckin(e.target.checked);
                // 首次勾选且未有关联时默认选第一个打卡项
                if (e.target.checked && habitId === null && habits.length > 0) setHabitId(habits[0].id);
              }}
            />
            勾选则计入打卡视图
          </label>
        </div>
        {isCheckin ? (
          <div className="frow">
            <label>打卡项</label>
            <CatSelect
              items={habits}
              value={habitId ?? (habits[0]?.id ?? 0)}
              onChange={(id) => {
                setHabitId(id);
                applyHabitTemplate(id);
              }}
              emptyText="暂无打卡项——可在下方输入框新建，或到「设置→打卡项」/打卡视图创建"
              onCreate={createHabitHere}
            />
          </div>
        ) : null}
        <div className="frow">
          <label>标题 *</label>
          <input type="text" maxLength={100} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="事项标题" />
        </div>
        <div className="frow">
          <label>描述</label>
          <textarea rows={5} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        {field("开始时间", "sd", "st")}
        {field("结束时间", "ed", "et")}
        {field("截止时间", "dd", "dt")}

        <div className="fsec">
          <div className="sec-t">自定义字段（随所属分类的模板变化）</div>
          {defLoading ? (
            <div className="iempty">字段加载中…</div>
          ) : defs.length === 0 ? (
            <div className="iempty">该分类暂无自定义字段（可在工具栏「字段管理」中添加）</div>
          ) : (
            defs.map((d) => (
              <div key={d.id} className="frow fv-row">
                <label>{d.name}</label>
                <FieldEditor
                  field={d}
                  value={fv[d.id] ?? (d.type === "multi_choice" ? [] : "")}
                  onChange={(v) => setFv((prev) => ({ ...prev, [d.id]: v }))}
                />
              </div>
            ))
          )}
        </div>

        {err ? <div className="ferr">{err}</div> : null}
      </div>
      {confirmDel ? (
        <Modal title="删除事项" onClose={() => setConfirmDel(false)} width={360} closeOnOverlayClick={!busy}
          footer={
            <>
              <button type="button" className="btn-ghost" onClick={() => setConfirmDel(false)}>取消</button>
              <button type="button" className="btn-danger" disabled={busy} onClick={() => void del()}>确认删除</button>
            </>
          }>
          <p>确定删除事项【{item?.title}】？删除后不可恢复。</p>
        </Modal>
      ) : null}
    </Modal>
  );
}

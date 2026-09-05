// 事项 新增/编辑 弹窗：标准字段 + P6 自定义字段区（PRD 4.3/6.3/6.4）。
// 字段区按当前所属分类模板渲染；切分类旧值保留在库中不再显示，切回恢复（PRD 4.3）。
import { useEffect, useState } from "react";
import Modal from "../Modal/Modal";
import FieldEditor from "../fields/FieldEditor";
import { useAppStore } from "../../stores/appStore";
import { fieldApi } from "../../services/ipc";
import { buildFieldPayloads, decodeFieldValue } from "../../features/fields/value";
import type { FieldEditValue } from "../../features/fields/value";
import type { Category, FieldDef, Item } from "../../services/types";

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

export default function ItemModal({ item, categories, defaultCategoryId, allowCategoryPick = false, presetStartDate = "", onClose, onSaved, onDeleted }: Props) {
  const { createItem, updateItem, deleteItem } = useAppStore();
  const isEdit = item !== null;
  const [catId, setCatId] = useState<number>(isEdit ? item!.category_id : defaultCategoryId);
  const [f, setF] = useState<FormState>(empty(item, presetStartDate));
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  // —— P6 自定义字段状态 ——
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [defLoading, setDefLoading] = useState(false);
  const [valsMap, setValsMap] = useState<Map<number, string | null>>(new Map());
  const [valsReady, setValsReady] = useState(!isEdit);
  const [fv, setFv] = useState<Record<number, FieldEditValue>>({});

  // 编辑时加载该事项全部字段值（跨分类保留；展示层按当前模板过滤，PRD 4.3）
  useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    fieldApi.listItemValues(item!.id)
      .then((rows) => {
        if (!alive) return;
        setValsMap(new Map(rows.map((r) => [r.field_def_id, r.value_json])));
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

  const field = (label: string, dateKey: keyof FormState, timeKey: keyof FormState) => (
    <div className="frow">
      <label>{label}</label>
      <input type="date" value={f[dateKey]} onChange={(e) => set(dateKey, e.target.value)} />
      <input type="time" value={f[timeKey]} onChange={(e) => set(timeKey, e.target.value)} />
    </div>
  );

  return (
    <Modal
      title={isEdit ? "编辑事项" : "新增事项"}
      onClose={onClose}
      width={520}
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
            <select value={catId} onChange={(e) => setCatId(Number(e.target.value))}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="frow">
          <label>标题 *</label>
          <input maxLength={100} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="事项标题" />
        </div>
        <div className="frow">
          <label>描述</label>
          <textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
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
        <Modal title="删除事项" onClose={() => setConfirmDel(false)} width={360}
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

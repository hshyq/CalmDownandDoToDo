// 事项 新增/编辑 弹窗（标准字段；自定义字段区在 P6 引入，编辑可换分类 PRD 6.4）。
import { useState } from "react";
import Modal from "../Modal/Modal";
import { useAppStore } from "../../stores/appStore";
import type { Category, Item } from "../../services/types";

interface Props {
  item: Item | null; // null=新增
  categories: Category[];
  defaultCategoryId: number; // 新增默认=当前分类（总览无新增入口，故必有值）
  onClose: () => void;
  onSaved: (msg: string) => void;
  onDeleted: () => void;
}

interface FormState {
  title: string;
  description: string;
  sd: string; st: string; ed: string; et: string; dd: string; dt: string;
}

function empty(item: Item | null): FormState {
  return {
    title: item?.title ?? "",
    description: item?.description ?? "",
    sd: item?.start_date ?? "", st: item?.start_time ?? "",
    ed: item?.end_date ?? "", et: item?.end_time ?? "",
    dd: item?.due_date ?? "", dt: item?.due_time ?? "",
  };
}

export default function ItemModal({ item, categories, defaultCategoryId, onClose, onSaved, onDeleted }: Props) {
  const { createItem, updateItem, deleteItem } = useAppStore();
  const isEdit = item !== null;
  const [catId, setCatId] = useState<number>(isEdit ? item!.category_id : defaultCategoryId);
  const [f, setF] = useState<FormState>(empty(item));
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

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
        {isEdit ? (
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

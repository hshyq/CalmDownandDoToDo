// 字段管理弹窗（PRD 6.5/6.6；原型「字段管理 · 分类名」界面）。
// 入口：分类页/未分类页工具栏「字段管理」按钮（总览无模板，PRD 6.5）。
import { useCallback, useEffect, useState } from "react";
import Modal from "../Modal/Modal";
import { fieldApi } from "../../services/ipc";
import {
  FIELD_TYPE_LABELS,
} from "../../services/types";
import type { Category, FieldDef, FieldType } from "../../services/types";
import {
  isChoiceType,
  joinOptionsText,
  parseOptions,
  splitOptionsText,
} from "../../features/fields/value";

interface Props {
  category: Category;
  onClose: () => void;
}

type Editing = { mode: "new" } | { mode: "edit"; field: FieldDef };
type Confirm = { kind: "del"; field: FieldDef } | { kind: "type" } | null;

const TYPE_KEYS = Object.keys(FIELD_TYPE_LABELS) as FieldType[];

export default function FieldManager({ category, onClose }: Props) {
  const [fields, setFields] = useState<FieldDef[] | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2400);
  };

  const reload = useCallback(async () => {
    try {
      setFields(await fieldApi.list(category.id));
    } catch (e) {
      setFields([]);
      showToast(e instanceof Error ? e.message : "加载字段失败，请重试");
    }
  }, [category.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** 非选项类 → 选项类：保存时由历史值自动生成选项（零丢失，PRD 6.6 v1.2 / TC-FLD-008/009/015/016/017）。 */
  const zeroLoss =
    editing !== null && editing.mode === "edit" &&
    isChoiceType(type) && !isChoiceType(editing.field.type);

  const isNew = editing !== null && editing.mode === "new";

  const beginEdit = (f: FieldDef) => {
    setEditing({ mode: "edit", field: f });
    setName(f.name);
    setType(f.type);
    setOptionsText(joinOptionsText(parseOptions(f.options_json)));
    setErr("");
  };

  const beginNew = () => {
    setEditing({ mode: "new" });
    setName("新字段");
    setType("text");
    setOptionsText("");
    setErr("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setErr("");
  };

  const closeAll = () => {
    setConfirm(null);
    setErr("");
  };

  const doSave = async () => {
    if (!editing) return;
    const cleanName = name.trim();
    if (!cleanName) { setErr("字段名称不能为空"); return; }
    if (cleanName.length > 30) { setErr("字段名称不能超过 30 个字符"); return; }
    const options = splitOptionsText(optionsText);
    // 非选项→选项：选项由历史值自动生成，不要求用户输入（zeroLoss）
    if (isChoiceType(type) && !zeroLoss && options.length === 0) {
      setErr("单选/多选至少需要一个选项");
      return;
    }
    if (editing.mode === "edit" && editing.field.type !== type && confirm?.kind !== "type") {
      setConfirm({ kind: "type" });
      return;
    }
    setBusy(true);
    setErr("");
    try {
      if (editing.mode === "new") {
        await fieldApi.create(category.id, cleanName, type, isChoiceType(type) ? options : null);
        showToast("字段已新增");
      } else {
        const old = editing.field;
        // 一次保存 = 一步撤销（PRD 6.7）：改名/改类型/选项合并为 save_field
        const newType = old.type !== type ? type : null;
        // 非选项→选项由后端按历史值自动生成选项；其余选项类传用户维护的选项
        const opts = isChoiceType(type) && !zeroLoss ? options : null;
        await fieldApi.saveField(old.id, cleanName, newType, opts);
        showToast("已保存");
      }
      setEditing(null);
      await reload();
    } catch (e) {
      void reload(); // 部分 IPC 可能已生效，失败时同步列表避免界面与库不一致
      setErr(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const doMove = async (f: FieldDef, dir: "up" | "down") => {
    try {
      await fieldApi.move(f.id, dir);
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "移动失败，请重试");
    }
  };

  const doDelete = async () => {
    if (!confirm || confirm.kind !== "del") return;
    setBusy(true);
    try {
      await fieldApi.remove(confirm.field.id);
      showToast("字段已删除");
      setConfirm(null);
      if (editing?.mode === "edit" && editing.field.id === confirm.field.id) setEditing(null);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "删除失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const typeRuleText = (): string => {
    if (!editing || editing.mode !== "edit") return "";
    const oldType = editing.field.type;
    if (isChoiceType(type) && !isChoiceType(oldType)) {
      return "该字段此前没有选项列表：将把全部历史值字符串化去重生成选项，所有原值保留（零丢失）。";
    }
    if (isChoiceType(oldType) && isChoiceType(type)) {
      return "按原选项列表校验：值命中选项则保留（多选→单选保留第一个选中项），未命中的清空。";
    }
    return "能转换的历史数据转换后保留，不能转换的清空（详见 PRD 6.6 转换矩阵）。";
  };

  const list = fields ?? [];
  const editingField = editing?.mode === "edit" ? editing.field : null;

  return (
    <Modal title={`字段管理 · ${category.name}`} onClose={onClose} width={520}>
      {fields === null ? (
        <div className="iempty">加载中…</div>
      ) : list.length === 0 && !editing ? (
        <div className="iempty">该分类暂无自定义字段，点击下方按钮新增。</div>
      ) : (
        <div className="fm-list">
          {list.map((f, i) => (
            <div key={f.id} className="fm-row">
              <span className="fname" title={f.name}>{f.name}</span>
              <span className="ftype">{FIELD_TYPE_LABELS[f.type]}</span>
              <span className="fopt">
                {isChoiceType(f.type) ? `${parseOptions(f.options_json).length} 选项` : "—"}
              </span>
              <button type="button" className="op" disabled={i === 0} title="上移" onClick={() => void doMove(f, "up")}>↑</button>
              <button type="button" className="op" disabled={i === list.length - 1} title="下移" onClick={() => void doMove(f, "down")}>↓</button>
              <button type="button" className="op" title="编辑" onClick={() => beginEdit(f)}>✎</button>
              <button type="button" className="op danger" title="删除" onClick={() => setConfirm({ kind: "del", field: f })}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <div className="fm-form">
          <div className="frow">
            <label>字段名称</label>
            <input type="text" maxLength={30} value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void doSave(); }} />
          </div>
          <div className="frow">
            <label>类型</label>
            <select value={type} onChange={(e) => { setType(e.target.value as FieldType); setErr(""); }}>
              {TYPE_KEYS.map((t) => (
                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          {isChoiceType(type) ? (
            <div className="frow frow-opt">
              <label>选项</label>
              {zeroLoss ? (
                <span className="opt-hint">保存后由历史值自动生成选项（零丢失），可再点 ✎ 编辑</span>
              ) : (
                <input type="text" value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder="用逗号分隔，如：高，中，低" />
              )}
            </div>
          ) : null}
          {err ? <div className="ferr">{err}</div> : null}
          <div className="fm-actions">
            <button type="button" className="btn-ghost" disabled={busy} onClick={cancelEdit}>取消</button>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void doSave()}>
              {isNew ? "创建" : "保存"}
            </button>
          </div>
        </div>
      ) : (
        <div className="fm-footer">
          <button type="button" className="btn-primary" onClick={beginNew}>＋ 新增字段</button>
        </div>
      )}

      {confirm?.kind === "del" ? (
        <Modal title="删除字段" onClose={closeAll} width={380}
          footer={
            <>
              <button type="button" className="btn-ghost" disabled={busy} onClick={closeAll}>取消</button>
              <button type="button" className="btn-danger" disabled={busy} onClick={() => void doDelete()}>删除</button>
            </>
          }>
          <p>确定删除字段【{confirm.field.name}】？</p>
          <p className="del-note">将丢失该字段下所有已填写数据。</p>
        </Modal>
      ) : null}

      {confirm?.kind === "type" && editingField ? (
        <Modal title="确认修改类型" onClose={closeAll} width={420}
          footer={
            <>
              <button type="button" className="btn-ghost" disabled={busy} onClick={closeAll}>取消</button>
              <button type="button" className={zeroLoss ? "btn-primary" : "btn-danger"} disabled={busy}
                onClick={() => { void doSave(); }}>
                确认修改
              </button>
            </>
          }>
          <p>将字段【{editingField.name}】修改为【{FIELD_TYPE_LABELS[type]}】。</p>
          <p className="del-note">{typeRuleText()}</p>
        </Modal>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </Modal>
  );
}

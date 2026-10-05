// 设置弹窗「打卡项」页签（PRD 6.11 v1.25）：增删改名/色盘选色（同分类 ColorPicker）/模板编辑，全部经 IPC 可撤销。
// 自包含数据（参照 DayTypePanel 模式）；删除仅解除打卡身份，事项保留。
import { useEffect, useState } from "react";
import Modal from "../Modal/Modal";
import ColorPicker from "../TabBar/ColorPicker";
import CatSelect from "../Items/CatSelect";
import FieldEditor from "../fields/FieldEditor";
import { fieldApi, habitApi, inTauri } from "../../services/ipc";
import { mockHabitApi } from "../../services/mock";
import { decodeFieldValue, encodeFieldValue } from "../../features/fields/value";
import type { FieldEditValue } from "../../features/fields/value";
import { decodeHabitTemplate, encodeHabitTemplate } from "../../features/checkin/template";
import { useAppStore } from "../../stores/appStore";
import type { Category, FieldDef, Habit } from "../../services/types";

export default function HabitPanel() {
  const src = inTauri() ? habitApi : mockHabitApi;
  const categories = useAppStore((s) => s.categories);
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState("");
  const [delConfirm, setDelConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [colorDlg, setColorDlg] = useState<Habit | null>(null);
  const [tplDlg, setTplDlg] = useState<Habit | null>(null);
  // 新增行关联分类（v1.26）：默认颜色=所选分类颜色，创建后可点色块修改
  const [newCatId, setNewCatId] = useState<number>(categories[0]?.id ?? 0);

  const load = async () => {
    try {
      setHabits(await src.list());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载打卡项失败，请重试");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "操作失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const name = newName.trim();
    if (name === "") {
      setErr("请输入打卡项名称");
      return;
    }
    void act(async () => {
      // 默认颜色=所选关联分类的颜色（v1.26；分类缺失兜底主蓝）
      const cat = categories.find((c) => c.id === newCatId);
      await src.create(name, cat?.color ?? "#4F8EF7");
      setNewName("");
    });
  };

  const rename = (h: Habit, name: string) => {
    const n = name.trim();
    if (n === "" || n === h.name) return;
    void act(() => src.rename(h.id, n));
  };

  const del = (h: Habit) => {
    void act(async () => {
      const n = await src.remove(h.id);
      setErr(`已删除打卡项「${h.name}」${n > 0 ? `，${n} 条记录解除打卡身份（事项保留）` : ""}`);
    });
    setDelConfirm(null);
  };

  return (
    <div className="set-body">
      <div className="hb-list">
        {habits === null ? (
          <div className="ldim">加载中…</div>
        ) : habits.length === 0 ? (
          <div className="note">暂无打卡项</div>
        ) : (
          habits.map((h) => (
            <div key={h.id} className="hb-row">
              <button type="button" className="hb-color" style={{ background: h.color }} title="点击选色（同分类色盘）" disabled={busy} onClick={() => setColorDlg(h)} />
              <input
                className="hb-name"
                defaultValue={h.name}
                maxLength={30}
                disabled={busy}
                onBlur={(e) => rename(h, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
              {h.template_json ? <span className="hb-meta" title="已配置模板">模</span> : null}
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setTplDlg(h)}>模板</button>
              {delConfirm === h.id ? (
                <>
                  <button type="button" className="btn-danger" disabled={busy} onClick={() => del(h)}>确认删除</button>
                  <button type="button" className="btn-ghost" onClick={() => setDelConfirm(null)}>取消</button>
                </>
              ) : (
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => setDelConfirm(h.id)}>删除</button>
              )}
            </div>
          ))
        )}
      </div>
      {/* 套 .iform 使 .frow 的 flex 布局与输入框样式生效（设置页签容器不含 .iform，裸 .frow 无布局） */}
      <div className="iform" style={{ marginTop: 10 }}>
        <div className="frow">
          <input
            type="text"
            value={newName}
            maxLength={30}
            placeholder="新打卡项名称"
            disabled={busy}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <div style={{ width: 150, flex: "none" }} title="默认颜色跟随所选分类">
            <CatSelect items={categories} value={newCatId} onChange={setNewCatId} />
          </div>
          <button type="button" className="btn-primary" disabled={busy} onClick={add}>新增</button>
        </div>
      </div>
      {err !== "" ? <div className="note" style={{ color: "var(--danger)" }}>{err}</div> : null}
      <div className="note">
        · 打卡项是打卡记录的归类（改名全局生效，历史不断档）。<br />
        · 「模板」预设默认分类/标题/字段值，新增打卡或勾选打卡时自动带出（仅填空值，已有值不覆盖）。<br />
        · 新增打卡项的默认颜色=所选事项分类的颜色，创建后可点色块修改。<br />
        · 删除打卡项仅解除其打卡记录的打卡身份（事项本身保留，回到日历/待办正常展示）。
      </div>
      {colorDlg ? (
        <Modal title={`设置颜色 · ${colorDlg.name}`} onClose={() => setColorDlg(null)}>
          <ColorPicker
            current={colorDlg.color}
            onPick={(color) => {
              const target = colorDlg;
              setColorDlg(null);
              if (color.toLowerCase() !== target.color.toLowerCase()) {
                void act(() => src.setColor(target.id, color));
              }
            }}
          />
        </Modal>
      ) : null}
      {tplDlg ? (
        <HabitTemplateModal
          habit={tplDlg}
          categories={categories}
          onClose={() => setTplDlg(null)}
          onSaved={() => {
            setTplDlg(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

/** 打卡项模板编辑弹窗（v1.25 ③）：默认分类/标题/字段值；字段区按所选分类模板渲染（值不跨分类迁移）。 */
function HabitTemplateModal({
  habit,
  categories,
  onClose,
  onSaved,
}: {
  habit: Habit;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const src = inTauri() ? habitApi : mockHabitApi;
  const tpl = decodeHabitTemplate(habit.template_json);
  const [catId, setCatId] = useState<number>(tpl?.categoryId ?? categories[0]?.id ?? 1);
  const [title, setTitle] = useState(tpl?.title ?? "");
  const [defs, setDefs] = useState<FieldDef[] | null>(null);
  // 模板初值：按字段值 JSON 解码（defs 就绪后写入 fv）
  const [valsJson, setValsJson] = useState<Record<string, string | null>>(tpl?.values ?? {});
  const [fv, setFv] = useState<Record<number, FieldEditValue>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // 分类变化 → 按新分类加载字段定义并清值（值不跨分类迁移，同 PRD 4.3 语义）
  useEffect(() => {
    let alive = true;
    setDefs(null);
    fieldApi.list(catId)
      .then((ds) => {
        if (!alive) return;
        setDefs(ds);
        const next: Record<number, FieldEditValue> = {};
        for (const d of ds) {
          const raw = valsJson[String(d.id)];
          if (raw !== undefined && raw !== null) {
            const decoded = decodeFieldValue(d.type, raw);
            if (decoded !== null) next[d.id] = decoded;
          }
        }
        setFv(next);
      })
      .catch((e) => {
        if (alive) {
          setDefs([]);
          setErr(e instanceof Error ? e.message : "加载字段模板失败，请重试");
        }
      });
    setValsJson({});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catId]);

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      // values：仅收集当前分类模板内字段（与事项保存语义一致）
      const values: Record<string, string | null> = {};
      for (const d of defs ?? []) {
        const v = fv[d.id];
        values[String(d.id)] = v === undefined ? null : encodeFieldValue(d.type, v);
      }
      await src.setTemplate(
        habit.id,
        encodeHabitTemplate({ categoryId: catId, title: title.trim(), values }),
      );
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`模板 · ${habit.name}`}
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
        <div className="note" style={{ marginBottom: 6 }}>新增打卡 / 勾选该打卡项时自动带出以下值，带出后可修改。</div>
        <div className="frow">
          <label>所属分类</label>
          <CatSelect items={categories} value={catId} onChange={setCatId} />
        </div>
        <div className="frow">
          <label>标题</label>
          <input type="text" maxLength={100} value={title} placeholder="默认用打卡项名称" onChange={(e) => setTitle(e.target.value)} />
        </div>
        {defs === null ? (
          <div className="iempty">字段加载中…</div>
        ) : defs.length === 0 ? (
          <div className="iempty">该分类暂无自定义字段</div>
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
        {err !== "" ? <div className="ferr show">{err}</div> : null}
      </div>
    </Modal>
  );
}

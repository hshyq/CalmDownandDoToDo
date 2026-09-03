import { useState } from "react";
import Modal from "../Modal/Modal";
import ColorPicker from "./ColorPicker";
import { useAppStore } from "../../stores/appStore";
import { categoryApi } from "../../services/ipc";
import { inTauri } from "../../services/ipc";
import { leastUsedColor } from "../../features/color/palette";
import { OVERVIEW } from "../../services/types";
import type { Category, TabId } from "../../services/types";

type Dialog =
  | { kind: "newcat" }
  | { kind: "rename"; cat: Category }
  | { kind: "color"; cat: Category }
  | { kind: "confirm-del"; cat: Category }
  | { kind: "del-choice"; cat: Category; count: number }
  | { kind: "confirm-del-cascade"; cat: Category; count: number };

const UNCAT_KIND = "uncategorized";

export default function TabBar() {
  const { categories, activeTab, switchTab, create, rename, setColor, remove } =
    useAppStore();
  const [menu, setMenu] = useState<{ cat: Category; x: number; y: number } | null>(null);
  const [dlg, setDlg] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [nameInput, setNameInput] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2400);
  };

  const normals = categories.filter((c) => c.kind !== UNCAT_KIND);
  const uncat = categories.find((c) => c.kind === UNCAT_KIND);

  const switchTo = (tab: TabId) => switchTab(tab);

  const openMenu = (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ cat, x: rect.right + 4, y: rect.top });
  };

  const closeAll = () => {
    setMenu(null);
    setDlg(null);
  };

  const submitRename = async () => {
    if (!dlg || dlg.kind !== "rename") return;
    const name = nameInput.trim();
    if (!name) return showToast("分类名称不能为空");
    if (name.length > 20) return showToast("分类名称不能超过 20 个字符");
    setBusy(true);
    try {
      await rename(dlg.cat.id, name);
      showToast("已重命名");
      closeAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const submitNew = async () => {
    const name = nameInput.trim();
    if (!name) return showToast("分类名称不能为空");
    if (name.length > 20) return showToast("分类名称不能超过 20 个字符");
    setBusy(true);
    try {
      const color = leastUsedColor(categories.map((c) => c.color));
      await create(name, color);
      showToast("已新建分类");
      closeAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "新建失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const onDeleteRequest = async (cat: Category) => {
    closeAll();
    const api = inTauri() ? categoryApi : null;
    let count = 0;
    if (api) {
      try {
        count = await api.countItems(cat.id);
      } catch {
        count = 0;
      }
    }
    if (count === 0) setDlg({ kind: "confirm-del", cat });
    else setDlg({ kind: "del-choice", cat, count });
  };

  const doRemove = async (cat: Category, mode: "cascade" | "move_to_uncategorized") => {
    setBusy(true);
    try {
      await remove(cat.id, mode);
      showToast(mode === "cascade" ? "分类已删除" : "事项已移入未分类，分类已删除");
      closeAll();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "删除失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const tabRow = (cat: Category | undefined, fixed: "top" | "bottom") => {
    if (!cat) return null;
    const active = activeTab === cat.id;
    return (
      <div
        className={`tab ${active ? "active" : ""} ${fixed === "top" ? "tab-fixed-top" : "tab-fixed-bottom"}`}
        onClick={() => switchTo(cat.id)}
      >
        <span className="dotc" style={{ background: cat.color }} />
        <span className="tname" title={cat.name}>{cat.name}</span>
        <span
          className="more"
          onClick={(e) => openMenu(cat, e)}
          role="button"
          aria-label={`${cat.name} 菜单`}
        >
          ⋮
        </span>
      </div>
    );
  };

  return (
    <aside className="tabbar">
      <div
        className={`tab ${activeTab === OVERVIEW ? "active" : ""} tab-fixed-top`}
        onClick={() => switchTo(OVERVIEW)}
      >
        <span className="tname ov">总览</span>
      </div>
      <div className="tab-divider" />
      <div className="tab-mid">
        {normals.map((c) => (
          <div key={c.id}>
            <div className={`tab ${activeTab === c.id ? "active" : ""}`} onClick={() => switchTo(c.id)}>
              <span className="dotc" style={{ background: c.color }} />
              <span className="tname" title={c.name}>{c.name}</span>
              <span
                className="more"
                onClick={(e) => openMenu(c, e)}
                role="button"
                aria-label={`${c.name} 菜单`}
              >
                ⋮
              </span>
            </div>
          </div>
        ))}
        <button type="button" className="btn-newcat" onClick={() => { setNameInput(""); setDlg({ kind: "newcat" }); }}>
          + 新建分类
        </button>
      </div>
      <div className="tab-divider" />
      <div className="tab-bottom">
        {tabRow(uncat, "bottom")}
        <button type="button" className="btn-settings" onClick={() => showToast("设置页将在后续批次开放")}>
          ⚙ 设置
        </button>
      </div>

      {menu ? (
        <>
          <div className="overlay-light" onClick={closeAll} />
          <div className="popmenu" style={{ left: menu.x, top: menu.y }}>
            <button type="button" onClick={() => { const c = menu.cat; setMenu(null); setDlg({ kind: "color", cat: c }); }}>
              设置颜色
            </button>
            {menu.cat.kind !== UNCAT_KIND ? (
              <>
                <button type="button" onClick={() => { setNameInput(menu.cat.name); setMenu(null); setDlg({ kind: "rename", cat: menu.cat }); }}>
                  重命名
                </button>
                <button type="button" className="danger" onClick={() => void onDeleteRequest(menu.cat)}>
                  删除
                </button>
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {dlg ? renderDialog() : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </aside>
  );

  function renderDialog() {
    if (!dlg) return null;
    switch (dlg.kind) {
      case "newcat":
        return (
          <Modal title="新建分类" onClose={closeAll}
            footer={
              <>
                <button type="button" className="btn-ghost" onClick={closeAll}>取消</button>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void submitNew()}>创建</button>
              </>
            }>
            <label className="field-label">名称（≤20 字符）</label>
            <input autoFocus className="text-input" value={nameInput} maxLength={20}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submitNew(); }} />
          </Modal>
        );
      case "rename":
        return (
          <Modal title="重命名分类" onClose={closeAll}
            footer={
              <>
                <button type="button" className="btn-ghost" onClick={closeAll}>取消</button>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void submitRename()}>保存</button>
              </>
            }>
            <label className="field-label">名称（≤20 字符）</label>
            <input autoFocus className="text-input" value={nameInput} maxLength={20}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submitRename(); }} />
          </Modal>
        );
      case "color":
        return (
          <Modal title={`设置颜色 · ${dlg.cat.name}`} onClose={closeAll}>
            <ColorPicker
              current={dlg.cat.color}
              onPick={(color) => {
                if (color.toLowerCase() !== dlg.cat.color.toLowerCase()) {
                  setColor(dlg.cat.id, color)
                    .then(() => showToast("颜色已更新"))
                    .catch((e) => showToast(e instanceof Error ? e.message : "设置颜色失败，请重试"))
                    .finally(() => setDlg(null));
                } else {
                  setDlg(null);
                }
              }}
            />
          </Modal>
        );
      case "confirm-del":
        return (
          <Modal title="删除分类" onClose={closeAll}
            footer={
              <>
                <button type="button" className="btn-ghost" onClick={closeAll}>取消</button>
                <button type="button" className="btn-danger" disabled={busy} onClick={() => void doRemove(dlg.cat, "cascade")}>删除</button>
              </>
            }>
            <p>确定删除分类【{dlg.cat.name}】？</p>
          </Modal>
        );
      case "del-choice":
        return (
          <Modal title="删除分类" onClose={closeAll}>
            <p>
              分类【{dlg.cat.name}】下有 {dlg.count} 条事项，请选择处理方式：
            </p>
            <div className="choice-actions">
              <button type="button" className="btn-danger" disabled={busy}
                onClick={() => setDlg({ kind: "confirm-del-cascade", cat: dlg.cat, count: dlg.count })}>
                连同 {dlg.count} 条事项一起删除
              </button>
              <button type="button" className="btn-primary" disabled={busy}
                onClick={() => void doRemove(dlg.cat, "move_to_uncategorized")}>
                事项移入未分类
              </button>
            </div>
            <button type="button" className="btn-ghost" onClick={closeAll}>取消</button>
          </Modal>
        );
      case "confirm-del-cascade":
        return (
          <Modal title="删除分类" onClose={closeAll}
            footer={
              <>
                <button type="button" className="btn-ghost" onClick={closeAll}>取消</button>
                <button type="button" className="btn-danger" disabled={busy}
                  onClick={() => void doRemove(dlg.cat, "cascade")}>
                  确认删除
                </button>
              </>
            }>
            <p>将永久删除分类【{dlg.cat.name}】及其 {dlg.count} 条事项（含自定义字段值），此操作不可恢复。</p>
          </Modal>
        );
    }
  }
}
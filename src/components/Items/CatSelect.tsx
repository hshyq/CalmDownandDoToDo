// 通用色点下拉（PRD 6.4 v1.24 起）：所属分类（Category）/打卡项（Habit）共用。
// 原生 select 的 option 无法渲染色点，故用按钮 + 浮层菜单模拟。
// 可选 onCreate：菜单底部出现「＋ 新建…」，输入名称创建后自动选中（PRD 6.11 打卡项入口）。
import { useEffect, useRef, useState } from "react";

export interface CatSelectItem {
  id: number;
  name: string;
  color: string;
}

interface Props {
  items: CatSelectItem[];
  value: number;
  onChange: (id: number) => void;
  /** 无可选项时的提示文案（替代下拉） */
  emptyText?: string;
  /** 新建回调：成功返回新 id 并自动选中；失败抛错由调用方提示 */
  onCreate?: (name: string) => Promise<number>;
}

export default function CatSelect({ items, value, onChange, emptyText, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 展开时监听页面按下：点击组件外收起
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  // 展开时滚动到当前选中项（分类较多超出可视高时保证当前值可见）
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector(".catsel-item.on")?.scrollIntoView({ block: "nearest" });
  }, [open]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const cur = items.find((c) => c.id === value);

  if (items.length === 0) {
    return <span className="ldim" style={{ alignSelf: "center" }}>{emptyText ?? "暂无可选项"}</span>;
  }

  const submitCreate = async () => {
    if (!onCreate || busy) return;
    const name = newName.trim();
    if (name === "") return;
    setBusy(true);
    setCreateErr("");
    try {
      const id = await onCreate(name);
      setOpen(false);
      setCreating(false);
      setNewName("");
      onChange(id);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "创建失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="catsel" ref={rootRef}>
      <button type="button" className="catsel-btn" onClick={() => setOpen((v) => !v)}>
        <span className="dotc" style={{ background: cur?.color ?? "#9E9E9E" }} />
        <span className="catsel-name">{cur?.name ?? "—"}</span>
        <span className="catsel-caret">▾</span>
      </button>
      {open ? (
        <div className="catsel-menu" ref={menuRef}>
          {items.map((c) => (
            <div
              key={c.id}
              className={`catsel-item${c.id === value ? " on" : ""}`}
              onClick={() => {
                setOpen(false);
                onChange(c.id);
              }}
            >
              <span className="dotc" style={{ background: c.color }} />
              <span className="catsel-name">{c.name}</span>
            </div>
          ))}
          {onCreate ? (
            creating ? (
              <div className="catsel-create">
                <input
                  ref={inputRef}
                  value={newName}
                  maxLength={30}
                  placeholder="新名称"
                  disabled={busy}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitCreate();
                    if (e.key === "Escape") setCreating(false);
                  }}
                />
                <button type="button" className="btn-primary" disabled={busy || newName.trim() === ""} onClick={() => void submitCreate()}>
                  建
                </button>
              </div>
            ) : (
              <div className="catsel-item catsel-new" onClick={() => setCreating(true)}>＋ 新建…</div>
            )
          ) : null}
          {createErr !== "" ? <div className="catsel-err">{createErr}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

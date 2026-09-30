// 所属分类下拉（PRD 6.4 v1.24）：带色点样式，与左侧分类列表一致。
// 原生 select 的 option 无法渲染色点，故用按钮 + 浮层菜单模拟；
// 列表顺序由调用方传入（普通分类按序、未分类沉底，v1.17 规则不变）。
import { useEffect, useRef, useState } from "react";
import type { Category } from "../../services/types";

interface Props {
  categories: Category[];
  value: number;
  onChange: (id: number) => void;
}

export default function CatSelect({ categories, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 展开时监听页面按下：点击组件外收起（选人与收口路径同原型契约）
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const cur = categories.find((c) => c.id === value);

  return (
    <div className="catsel" ref={rootRef}>
      <button type="button" className="catsel-btn" onClick={() => setOpen((v) => !v)}>
        <span className="dotc" style={{ background: cur?.color ?? "#9E9E9E" }} />
        <span className="catsel-name">{cur?.name ?? "—"}</span>
        <span className="catsel-caret">▾</span>
      </button>
      {open ? (
        <div className="catsel-menu">
          {categories.map((c) => (
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
        </div>
      ) : null}
    </div>
  );
}

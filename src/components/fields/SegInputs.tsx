// 分段日期/时刻输入组件（PRD 6.3/6.9 v1.17；原型确认）。
// 年(4位)/月(2位)/日(2位) 或 时/分(2位) 独立输入框：满位自动跳段、点击/聚焦全选覆盖；
// 右侧 📅/🕐 图标经隐藏原生控件的 showPicker 弹出选择器，两种输入方式并存。
// 自定义组件使年份最多 4 位（原生 date input 年段可键入 6 位，无法配置），
// 且在 WebView2/Chrome 中行为完全一致。
import { useEffect, useRef, useState } from "react";

const onlyDigits = (s: string, max: number): string =>
  s.replace(/\D/g, "").slice(0, max);

interface SegProps {
  /** 完整值：yyyy-MM-dd / HH:mm；段不全时为 "" */
  value: string | null;
  onChange: (v: string) => void;
}

/** 通用分段输入 hook：段管理 + 满位跳段 + 全选覆盖 + 图标弹选择器。 */
function useSegments(
  count: number,
  maxLens: number[],
  value: string | null,
  onChange: (v: string) => void,
  assemble: (segs: string[]) => string,
  split: (v: string) => string[],
) {
  const [segs, setSegs] = useState<string[]>(() => split(value ?? ""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const nativeRef = useRef<HTMLInputElement | null>(null);
  // 最近一次组件回传给父级的值：父级 value 与之相同时说明是自身回流的更新，
  // 不做分段重置（否则段不全时回传 "" 会经父级回流把已键入的数字清掉）
  const lastEmitted = useRef<string | null>(null);
  // 外部赋值（如快捷范围、编辑回填）同步到分段
  useEffect(() => {
    if ((value ?? "") === (lastEmitted.current ?? "")) return;
    setSegs(split(value ?? ""));
    lastEmitted.current = value ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const setSeg = (i: number, v: string, reselect = false) => {
    setSegs((prev) => {
      const next = [...prev];
      next[i] = v;
      // 三段都非空才回调整值（不完整状态界面保留但不提交）
      const full = next.every((s) => s) ? assemble(next) : "";
      lastEmitted.current = full;
      onChange(full);
      return next;
    });
    if (!reselect && v.length >= maxLens[i] && i < count - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const segProps = (i: number) => ({
    ref: (el: HTMLInputElement | null) => { refs.current[i] = el; },
    inputMode: "numeric" as const,
    onFocus: () => refs.current[i]?.select(),
    onClick: () => refs.current[i]?.select(),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = onlyDigits(e.target.value, maxLens[i]);
      setSeg(i, v, v.length < maxLens[i] && v.length > 0);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !segs[i] && i > 0) {
        e.preventDefault();
        refs.current[i - 1]?.focus();
      }
    },
  });

  const openPicker = () => {
    const el = nativeRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus(); // 无用户手势等场景降级
    }
  };

  const lastEmittedRef = lastEmitted;
  return { segs, segProps, refs, nativeRef, openPicker, lastEmittedRef };
}

function segDateSplit(v: string): string[] {
  if (!v || v.length !== 10) return ["", "", ""];
  return [v.slice(0, 4), v.slice(5, 7), v.slice(8, 10)];
}
function segTimeSplit(v: string): string[] {
  if (!v || v.length !== 5) return ["", ""];
  return [v.slice(0, 2), v.slice(3, 5)];
}
const segDateAssemble = (s: string[]): string =>
  `${s[0]}-${s[1].padStart(2, "0")}-${s[2].padStart(2, "0")}`;
const segTimeAssemble = (s: string[]): string =>
  `${s[0].padStart(2, "0")}:${s[1].padStart(2, "0")}`;

/** 分段日期输入：年(4) 月(2) 日(2)。 */
export function SegDateInput({ value, onChange }: SegProps) {
  const { segs, segProps, nativeRef, openPicker, lastEmittedRef } = useSegments(
    3, [4, 2, 2], value, onChange, segDateAssemble, segDateSplit,
  );
  const [y, m, d] = segs;
  return (
    <span className="segwrap">
      <input {...segProps(0)} className="seg seg-y" placeholder="年" value={y} />
      <span className="segsep">-</span>
      <input {...segProps(1)} className="seg seg-m" placeholder="月" value={m} />
      <span className="segsep">-</span>
      <input {...segProps(2)} className="seg seg-d" placeholder="日" value={d} />
      <span className="segicon" title="点击弹出日历" onClick={openPicker}>📅</span>
      <input
        ref={nativeRef}
        type="date"
        className="seg-native"
        aria-hidden
        tabIndex={-1}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v) {
            lastEmittedRef.current = v;
            onChange(v);
          }
        }}
      />
    </span>
  );
}

/** 分段时刻输入：时(2) 分(2)。 */
export function SegTimeInput({ value, onChange }: SegProps) {
  const { segs, segProps, nativeRef, openPicker, lastEmittedRef } = useSegments(
    2, [2, 2], value, onChange, segTimeAssemble, segTimeSplit,
  );
  const [h, mi] = segs;
  return (
    <span className="segwrap">
      <input {...segProps(0)} className="seg seg-h" placeholder="时" value={h} />
      <span className="segsep">:</span>
      <input {...segProps(1)} className="seg seg-mi" placeholder="分" value={mi} />
      <span className="segicon" title="点击弹出时刻列表" onClick={openPicker}>🕐</span>
      <input
        ref={nativeRef}
        type="time"
        className="seg-native"
        aria-hidden
        tabIndex={-1}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v) {
            lastEmittedRef.current = v;
            onChange(v);
          }
        }}
      />
    </span>
  );
}

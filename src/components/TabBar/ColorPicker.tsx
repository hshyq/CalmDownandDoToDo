// 分类颜色选择器（PRD 6.2，2026-09-08 用户确认改为墨刀风格）：
// 预设色板（灰阶 + 4 行柔和彩色）+「更多颜色」展开 SV 渐变面板/色相条/HEX 输入。
import { useRef, useState } from "react";
import { hexToHsv, hsvToHex, PALETTE_ROWS } from "../../features/color/palette";
import type { Hsv } from "../../features/color/palette";

interface Props {
  current: string;
  onPick: (color: string) => void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export default function ColorPicker({ current, onPick }: Props) {
  const [sel, setSel] = useState(current);
  const [customOpen, setCustomOpen] = useState(false);
  // 自定义面板：统一以 HSV 状态驱动（色相条改变时保留 s/v）
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current));
  const [hex, setHex] = useState(current);
  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);

  const applyHsv = (next: Hsv) => {
    setHsv(next);
    setSel(hsvToHex(next.h, next.s, next.v));
  };
  const applyHex = (c: string) => {
    setSel(c);
    setHsv(hexToHsv(c));
    setHex(c);
  };

  // 拖拽共用：按指针位置换算 s/v 或色相（pointer capture 支持拖出边界）
  const trackSv = (e: React.PointerEvent) => {
    const el = svRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const s = clamp01((e.clientX - rect.left) / rect.width) * 100;
    const v = (1 - clamp01((e.clientY - rect.top) / rect.height)) * 100;
    applyHsv({ ...hsv, s, v });
  };
  const trackHue = (e: React.PointerEvent) => {
    const el = hueRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const h = clamp01((e.clientX - rect.left) / rect.width) * 360;
    applyHsv({ ...hsv, h });
  };

  const commitHexInput = (v: string) => {
    setHex(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) applyHex(v);
  };

  return (
    <div>
      <div className="pal-grid mockitt">
        {PALETTE_ROWS.map((row, ri) => (
          <div key={ri} className="pal-row">
            {row.map((c) => (
              <button
                key={c}
                type="button"
                className={`sw ${sel.toLowerCase() === c.toLowerCase() ? "sel" : ""}`}
                style={{ background: c }}
                title={c}
                onClick={() => applyHex(c)}
                aria-label={`颜色 ${c}`}
              />
            ))}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="more-colors"
        onClick={() => setCustomOpen((v) => !v)}
      >
        {customOpen ? "收起自定义" : "更多颜色…"}
      </button>
      {customOpen ? (
        <div className="custom-color mockitt-cp">
          <div
            ref={svRef}
            className="sv-area"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(hsv.h, 100, 100)})`,
            }}
            onPointerDown={trackSv}
            onPointerMove={(e) => e.buttons === 1 && trackSv(e)}
          >
            <span
              className="sv-dot"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                background: hsvToHex(hsv.h, hsv.s, hsv.v),
              }}
            />
          </div>
          <div ref={hueRef} className="hue-bar" onPointerDown={trackHue}
            onPointerMove={(e) => e.buttons === 1 && trackHue(e)}>
            <span className="hue-dot" style={{ left: `${(hsv.h / 360) * 100}%`, background: hsvToHex(hsv.h, 100, 100) }} />
          </div>
          <div className="cp-hex-row">
            <span className="cp-hex-label">HEX</span>
            <input
              type="text"
              value={hex}
              maxLength={7}
              placeholder="#RRGGBB"
              onChange={(e) => commitHexInput(e.target.value)}
              aria-label="HEX 值"
            />
            <span className="cp-prev" style={{ background: sel }} />
          </div>
        </div>
      ) : null}
      <div className="modal-foot-inner">
        <button type="button" className="btn-primary" onClick={() => onPick(sel)}>
          确定
        </button>
      </div>
    </div>
  );
}

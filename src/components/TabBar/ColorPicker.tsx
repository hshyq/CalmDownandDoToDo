import { useState } from "react";
import { PALETTE_ROWS } from "../../features/color/palette";

interface Props {
  current: string;
  onPick: (color: string) => void;
}

/** 分类色盘（11×6 + 更多颜色自定义），一次确认计一步（PRD 6.2）。 */
export default function ColorPicker({ current, onPick }: Props) {
  const [sel, setSel] = useState(current);
  const [customOpen, setCustomOpen] = useState(false);
  const [hex, setHex] = useState(current);

  const apply = (c: string) => {
    setSel(c);
    setHex(c);
  };

  return (
    <div>
      <div className="pal-grid">
        {PALETTE_ROWS.map((row, ri) => (
          <div key={ri} className="pal-row">
            {row.map((c) => (
              <button
                key={c}
                type="button"
                className={`sw ${sel.toLowerCase() === c.toLowerCase() ? "sel" : ""}`}
                style={{ background: c }}
                title={c}
                onClick={() => apply(c)}
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
        <div className="custom-color">
          <input
            type="color"
            value={hex}
            onChange={(e) => apply(e.target.value)}
            aria-label="取色器"
          />
          <input
            type="text"
            value={hex}
            maxLength={7}
            onChange={(e) => {
              const v = e.target.value;
              setHex(v);
              if (/^#[0-9a-fA-F]{6}$/.test(v)) setSel(v);
            }}
            aria-label="HEX 值"
          />
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
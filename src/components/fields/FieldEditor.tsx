// 自定义字段录入控件（六种类型，PRD 4.3/6.5；展示组件保持无状态）。
import type { FieldDef } from "../../services/types";
import { parseOptions } from "../../features/fields/value";
import type { FieldEditValue } from "../../features/fields/value";

interface Props {
  field: FieldDef;
  value: FieldEditValue;
  onChange: (v: FieldEditValue) => void;
}

/** 按字段类型渲染对应输入控件；单选/多选选项来自 options_json（PRD 4.3）。 */
export default function FieldEditor({ field, value, onChange }: Props) {
  const options = parseOptions(field.options_json);

  if (field.type === "multiline") {
    return (
      <textarea
        rows={2}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="多行文本"
      />
    );
  }
  if (field.type === "number") {
    return (
      <input
        type="number"
        step="any"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="数字"
      />
    );
  }
  if (field.type === "date") {
    return (
      <input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "single_choice") {
    const cur = typeof value === "string" ? value : "";
    return (
      <select value={cur} onChange={(e) => onChange(e.target.value)}>
        <option value="">（未选）</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (field.type === "multi_choice") {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (o: string, checked: boolean) =>
      onChange(checked ? [...arr, o] : arr.filter((x) => x !== o));
    return (
      <div className="fv-multi">
        {options.length === 0 ? (
          <span className="fv-empty">暂无选项（可在「字段管理」中维护）</span>
        ) : (
          options.map((o) => (
            <label key={o} className="fv-check">
              <input
                type="checkbox"
                value={o}
                checked={arr.includes(o)}
                onChange={(e) => toggle(o, e.target.checked)}
              />
              <span>{o}</span>
            </label>
          ))
        )}
      </div>
    );
  }
  // text（单行文本）
  return (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="单行文本"
    />
  );
}

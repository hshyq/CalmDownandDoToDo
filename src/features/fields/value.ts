// 自定义字段值编解码与选项解析（纯函数，语义对齐后端 store::fieldconvert，PRD 4.3/6.6）。
import type { FieldDef, FieldType } from "../../services/types";

/** 单选/多选是否为「选项类」字段（PRD 6.6）。 */
export const isChoiceType = (t: FieldType): boolean =>
  t === "single_choice" || t === "multi_choice";

/** 解析 options_json（JSON 数组文本）为选项数组；非法/空返回 []。 */
export function parseOptions(optionsJson: string | null): string[] {
  if (!optionsJson) return [];
  try {
    const v: unknown = JSON.parse(optionsJson);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** 弹窗内字段控件的编辑值：单值型为字符串，多选为字符串数组（空=未填）。 */
export type FieldEditValue = string | string[];

/**
 * 把库中 value_json（JSON 文本）解码为编辑值：
 * 多选 → 字符串数组（空数组/无值 → null）；其余 → 字符串（空串/无值 → null）。
 * 与后端 decode_value 的「空→None」语义一致。
 */
export function decodeFieldValue(type: FieldType, valueJson: string | null): FieldEditValue | null {
  if (valueJson === null) return null;
  try {
    const v: unknown = JSON.parse(valueJson);
    if (isChoiceType(type) && type === "multi_choice") {
      if (!Array.isArray(v)) return null;
      const arr = v.filter((x): x is string => typeof x === "string");
      return arr.length > 0 ? arr : null;
    }
    if (typeof v !== "string" || v.length === 0) return null;
    return v;
  } catch {
    return null;
  }
}

/**
 * 把编辑值编码回 value_json（JSON 文本）：
 * 多选 → JSON 数组文本（空数组 → null）；其余 → JSON 字符串文本（空串 → null）。
 * 与后端 encode_value 一致；null=清空该字段值。
 */
export function encodeFieldValue(
  type: FieldType,
  v: FieldEditValue | null | undefined,
): string | null {
  if (type === "multi_choice") {
    const arr = Array.isArray(v) ? v : [];
    return arr.length > 0 ? JSON.stringify(arr) : null;
  }
  const s = typeof v === "string" ? v : "";
  return s.length > 0 ? JSON.stringify(s) : null;
}

/** 选项文本（中英文逗号/顿号分隔）拆分为干净选项数组，供新建/编辑选项列表。 */
export function splitOptionsText(text: string): string[] {
  return text
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 把某字段的选项数组显示为可编辑文本（逗号连接）。 */
export function joinOptionsText(options: string[]): string {
  return options.join("，");
}

/**
 * 由分类模板与编辑值表生成保存载荷（PRD 4.3：仅覆盖当前模板字段，其它分类旧值保留）。
 * edits 以 field.id 为键；缺省视为未填（null=清空）。
 */
export function buildFieldPayloads(
  defs: FieldDef[],
  edits: Record<number, FieldEditValue | null | undefined>,
): { fieldDefId: number; value: string | null }[] {
  return defs.map((f) => ({
    fieldDefId: f.id,
    value: encodeFieldValue(f.type, edits[f.id]),
  }));
}

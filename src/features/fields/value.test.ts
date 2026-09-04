// features/fields/value.ts 纯函数单测：与后端 fieldconvert 编解码语义对齐（PRD 4.3/6.6）。
import { describe, expect, it } from "vitest";
import {
  buildFieldPayloads,
  decodeFieldValue,
  encodeFieldValue,
  isChoiceType,
  joinOptionsText,
  parseOptions,
  splitOptionsText,
} from "./value";
import type { FieldDef, FieldType } from "../../services/types";

const def = (id: number, type: FieldType, optionsJson: string | null = null): FieldDef => ({
  id,
  category_id: 1,
  name: "F" + id,
  type,
  options_json: optionsJson,
  sort_order: id,
});

describe("选项解析", () => {
  it("解析 options_json 数组文本", () => {
    expect(parseOptions('["高","中","低"]')).toEqual(["高", "中", "低"]);
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions("not-json")).toEqual([]);
  });
  it("判断选项类字段", () => {
    expect(isChoiceType("single_choice")).toBe(true);
    expect(isChoiceType("multi_choice")).toBe(true);
    expect(isChoiceType("text")).toBe(false);
  });
  it("拆分与合并选项文本", () => {
    expect(splitOptionsText(" 高 ，中,低、 急 ")).toEqual(["高", "中", "低", "急"]);
    expect(splitOptionsText("  ,， 、 ")).toEqual([]);
    expect(joinOptionsText(["高", "中"])).toBe("高，中");
  });
});

describe("编解码（与后端 encode_value/decode_value 对齐）", () => {
  it("文本：JSON 字符串往返；空串/无值=null", () => {
    expect(encodeFieldValue("text", "学习")).toBe('"学习"');
    expect(encodeFieldValue("text", "")).toBeNull();
    expect(encodeFieldValue("text", null)).toBeNull();
    expect(decodeFieldValue("text", '"学习"')).toBe("学习");
    expect(decodeFieldValue("text", '""')).toBeNull();
    expect(decodeFieldValue("text", null)).toBeNull();
  });
  it("数字/日期/单选：标量 JSON 字符串（对齐后端 number 存字符串化值）", () => {
    expect(encodeFieldValue("number", "3.14")).toBe('"3.14"');
    expect(encodeFieldValue("date", "2026-09-01")).toBe('"2026-09-01"');
    expect(encodeFieldValue("single_choice", "高")).toBe('"高"');
    expect(decodeFieldValue("number", '"3.14"')).toBe("3.14");
    expect(decodeFieldValue("single_choice", '"高"')).toBe("高");
  });
  it("多选：JSON 数组文本往返；空数组=null", () => {
    expect(encodeFieldValue("multi_choice", ["高", "低"])).toBe('["高","低"]');
    expect(encodeFieldValue("multi_choice", [])).toBeNull();
    expect(decodeFieldValue("multi_choice", '["高","低"]')).toEqual(["高", "低"]);
    expect(decodeFieldValue("multi_choice", "[]")).toBeNull();
    expect(decodeFieldValue("multi_choice", null)).toBeNull();
  });
  it("非法 JSON / 类型不匹配 → null（容错）", () => {
    expect(decodeFieldValue("text", "{bad")).toBeNull();
    expect(decodeFieldValue("multi_choice", '"不是数组"')).toBeNull();
  });
});

describe("buildFieldPayloads（PRD 4.3：仅覆盖当前模板字段）", () => {
  it("按模板逐字段生成 payload；缺省/空值=null", () => {
    const defs = [def(1, "text"), def(2, "multi_choice"), def(3, "number")];
    const payloads = buildFieldPayloads(defs, { 1: "学习", 3: "3.14" });
    expect(payloads).toEqual([
      { fieldDefId: 1, value: '"学习"' },
      { fieldDefId: 2, value: null },
      { fieldDefId: 3, value: '"3.14"' },
    ]);
  });
});

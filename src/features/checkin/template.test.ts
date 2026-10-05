// 打卡项模板编解码单测（PRD 6.11 v1.25 ③）。
import { describe, expect, it } from "vitest";
import { decodeHabitTemplate, encodeHabitTemplate } from "./template";

describe("decodeHabitTemplate（坏数据防御）", () => {
  it("null/空串/非法 JSON/非对象 → null", () => {
    expect(decodeHabitTemplate(null)).toBeNull();
    expect(decodeHabitTemplate("")).toBeNull();
    expect(decodeHabitTemplate("  ")).toBeNull();
    expect(decodeHabitTemplate("{bad")).toBeNull();
    expect(decodeHabitTemplate("[1,2]")).toBeNull();
  });

  it("合法模板解码：分类/标题/字段值", () => {
    const json = '{"categoryId":1,"title":"健身房训练","values":{"13":"\\"卧推\\""}}';
    expect(decodeHabitTemplate(json)).toEqual({
      categoryId: 1,
      title: "健身房训练",
      values: { "13": '"卧推"' },
    });
  });

  it("缺省字段容错：分类/标题/值类型异常时落默认", () => {
    const json = '{"title":123,"values":{"a":5,"b":"x"}}';
    expect(decodeHabitTemplate(json)).toEqual({
      categoryId: null,
      title: "",
      values: { a: null, b: "x" },
    });
  });
});

describe("encodeHabitTemplate", () => {
  it("编码后可无损往返", () => {
    const tpl = { categoryId: 3, title: "读书", values: { "41": '"书籍"', "12": null } };
    expect(decodeHabitTemplate(encodeHabitTemplate(tpl))).toEqual(tpl);
  });
});

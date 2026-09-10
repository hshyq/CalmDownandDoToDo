// 日期类型纯函数单测（TC-DT-001，PRD 5.5 v1.12）。
import { describe, expect, it } from "vitest";
import { defaultDayType, DAY_TYPE_LABELS } from "../../services/types";

describe("defaultDayType 默认推算", () => {
  it("周一~周五为工作日", () => {
    expect(defaultDayType("2026-09-07")).toBe("work"); // 周一
    expect(defaultDayType("2026-09-11")).toBe("work"); // 周五
  });

  it("周六周日为休息日", () => {
    expect(defaultDayType("2026-09-12")).toBe("rest"); // 周六
    expect(defaultDayType("2026-09-13")).toBe("rest"); // 周日
  });

  it("角标中文名齐全", () => {
    expect(DAY_TYPE_LABELS).toEqual({ work: "班", rest: "休", holiday: "假" });
  });
});

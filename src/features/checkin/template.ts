// 打卡项模板编解码纯函数（PRD 6.11 v1.25 ③）。
// 库中存 JSON 原文（habits.template_json）；前端消费前解码，保存前编码。
// 坏数据防御：解码失败返回 null（视为未配置），不阻塞打卡项列表渲染。
import type { HabitTemplate } from "../../services/types";

export const decodeHabitTemplate = (json: string | null): HabitTemplate | null => {
  if (json === null || json.trim() === "") return null;
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
    const categoryId =
      typeof v.categoryId === "number" ? v.categoryId : null;
    const title = typeof v.title === "string" ? v.title : "";
    const values: Record<string, string | null> = {};
    if (typeof v.values === "object" && v.values !== null && !Array.isArray(v.values)) {
      for (const [k, val] of Object.entries(v.values as Record<string, unknown>)) {
        values[String(k)] = typeof val === "string" ? val : null;
      }
    }
    return { categoryId, title, values };
  } catch {
    return null;
  }
};

export const encodeHabitTemplate = (tpl: HabitTemplate): string =>
  JSON.stringify({ categoryId: tpl.categoryId, title: tpl.title, values: tpl.values });

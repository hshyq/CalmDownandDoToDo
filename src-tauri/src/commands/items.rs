//! 事项 IPC（PRD 4.2/5.1/6.3/6.4；验收 TC-IT）。
//! 写操作经 undo 包装：一次弹窗保存/删除 = 一步撤销（PRD 6.7）。

use serde::Deserialize;
use tauri::{AppHandle, State};

use crate::store::items::{Item, NewItem};
use crate::store::Db;
use crate::undo::{UndoCmd, UndoStack};

use super::undo::emit_depth;

/// 事项表单载荷（JS 侧 camelCase，对应 Rust 参数经 serde rename_all）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemDraft {
    pub category_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub start_date: Option<String>,
    pub start_time: Option<String>,
    pub end_date: Option<String>,
    pub end_time: Option<String>,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    /// 打卡身份（PRD 6.11 v1.25）：勾选后额外计入打卡视图。
    /// **缺省=保留原值**（2026-11-21 缺陷修复）：拖拽改期/转待办等非弹窗路径不传，
    /// 弹窗保存显式传当前勾选态；仅新建时缺省按 false。
    #[serde(default)]
    pub is_checkin: Option<bool>,
    /// 所属打卡项（取消打卡时前端传原值保留关联，再勾选自动带出）。
    /// 缺省=保留原值（同上）；无路径需要显式清空（PRD 6.11：habit_id 保留在库中）。
    #[serde(default)]
    pub habit_id: Option<i64>,
    /// 当前分类模板字段值（可选；切分类时旧值行保留，PRD 4.3）
    #[serde(default)]
    pub field_values: Option<Vec<FieldValuePayload>>,
}

/// 事项-字段值载荷（JS camelCase：后端 serde rename_all）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldValuePayload {
    pub field_def_id: i64,
    pub value: Option<String>,
}

/// 新建用：缺省打卡字段按「无打卡」展开（is_checkin=false、habit_id=NULL）。
impl<'a> From<&'a ItemDraft> for NewItem<'a> {
    fn from(d: &'a ItemDraft) -> Self {
        NewItem {
            category_id: d.category_id,
            title: &d.title,
            description: d.description.as_deref(),
            start_date: d.start_date.as_deref(),
            start_time: d.start_time.as_deref(),
            end_date: d.end_date.as_deref(),
            end_time: d.end_time.as_deref(),
            due_date: d.due_date.as_deref(),
            due_time: d.due_time.as_deref(),
            is_checkin: d.is_checkin.unwrap_or(false),
            habit_id: d.habit_id,
        }
    }
}

impl ItemDraft {
    /// 编辑用：打卡字段缺省时保留旧值（2026-11-21 缺陷修复，TC-CK-023）——
    /// 拖拽改期/转待办等只改日期的路径不传 is_checkin/habit_id，打卡身份与关联原样保留；
    /// 弹窗保存显式传值时以传入为准。
    fn resolve_update<'a>(&'a self, old: &Item) -> NewItem<'a> {
        NewItem {
            category_id: self.category_id,
            title: &self.title,
            description: self.description.as_deref(),
            start_date: self.start_date.as_deref(),
            start_time: self.start_time.as_deref(),
            end_date: self.end_date.as_deref(),
            end_time: self.end_time.as_deref(),
            due_date: self.due_date.as_deref(),
            due_time: self.due_time.as_deref(),
            is_checkin: self.is_checkin.unwrap_or(old.is_checkin),
            habit_id: self.habit_id.or(old.habit_id),
        }
    }
}

/// 写入事项字段值（仅覆盖当前模板字段，不删其它分类值）。
fn save_values(db: &Db, item_id: i64, values: Option<&[FieldValuePayload]>) -> Result<(), String> {
    let Some(vals) = values else { return Ok(()) };
    let mapped: Vec<(i64, Option<String>)> = vals
        .iter()
        .map(|v| (v.field_def_id, v.value.clone()))
        .collect();
    db.set_item_field_values(item_id, mapped)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_item(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    draft: ItemDraft,
) -> Result<Item, String> {
    let new = NewItem::from(&draft);
    let item = db.create_item(&new).map_err(|e| e.to_string())?;
    save_values(&db, item.id, draft.field_values.as_deref())?;
    // 快照 = 创建后完整行 + 字段值（撤销=删除，重做=重建）
    let snap = db
        .snapshot_item(item.id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "事项不存在".to_string())?;
    stack.push(Box::new(UndoCmd::ItemCreate {
        snap: Box::new(snap),
    }));
    emit_depth(&app, &stack);
    Ok(item)
}

#[tauri::command]
pub fn update_item(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    draft: ItemDraft,
) -> Result<Item, String> {
    let before = db
        .snapshot_item(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "事项不存在".to_string())?;
    // 打卡字段缺省=保留旧值（TC-CK-023：拖拽改期不清打卡身份）
    let upd = draft.resolve_update(&before.item);
    let item = db.update_item(id, &upd).map_err(|e| e.to_string())?;
    save_values(&db, item.id, draft.field_values.as_deref())?;
    let after = db
        .snapshot_item(item.id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "事项不存在".to_string())?;
    stack.push(Box::new(UndoCmd::ItemUpdate {
        before: Box::new(before),
        after: Box::new(after),
    }));
    emit_depth(&app, &stack);
    Ok(item)
}

#[tauri::command]
pub fn delete_item(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
) -> Result<(), String> {
    let snap = db
        .snapshot_item(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "事项不存在".to_string())?;
    db.delete_item(id).map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::ItemDelete {
        snap: Box::new(snap),
    }));
    emit_depth(&app, &stack);
    Ok(())
}

/// 列表视图批量删除（PRD 6.10 v1.23）：先全部快照（任一不存在则整体报错不删），
/// 再逐条删除，一步撤销恢复全部。
#[tauri::command]
pub fn delete_items_batch(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    ids: Vec<i64>,
) -> Result<usize, String> {
    if ids.is_empty() {
        return Err("未选择事项".to_string());
    }
    let mut snaps = Vec::with_capacity(ids.len());
    for id in &ids {
        snaps.push(Box::new(
            db.snapshot_item(*id)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "事项不存在".to_string())?,
        ));
    }
    for snap in &snaps {
        db.delete_item(snap.item.id).map_err(|e| e.to_string())?;
    }
    let n = snaps.len();
    stack.push(Box::new(UndoCmd::ItemDeleteBatch { snaps }));
    emit_depth(&app, &stack);
    Ok(n)
}

#[tauri::command]
pub fn get_item_detail(db: State<'_, Db>, id: i64) -> Result<Item, String> {
    db.get_item(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_calendar_items(
    db: State<'_, Db>,
    view_start: String,
    view_end: String,
    category_id: Option<i64>,
) -> Result<Vec<crate::store::CalendarItem>, String> {
    db.list_calendar_items(&view_start, &view_end, category_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_todo_items(
    db: State<'_, Db>,
    category_id: Option<i64>,
) -> Result<Vec<crate::store::TodoItem>, String> {
    db.list_todo_items(category_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_items(db: State<'_, Db>, category_id: Option<i64>) -> Result<Vec<Item>, String> {
    db.list_items(category_id).map_err(|e| e.to_string())
}

/// 打卡视图数据（PRD 6.11 v1.25）：归属日期（开始优先/截止兜底）在 [start,end] 的打卡事项。
#[tauri::command]
pub fn list_checkins(db: State<'_, Db>, start: String, end: String) -> Result<Vec<Item>, String> {
    db.list_checkins(&start, &end).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn draft(is_checkin: Option<bool>, habit_id: Option<i64>) -> ItemDraft {
        ItemDraft {
            category_id: 1,
            title: "拖拽改期".into(),
            description: None,
            start_date: Some("2026-11-22".into()),
            start_time: None,
            end_date: Some("2026-11-22".into()),
            end_time: None,
            due_date: None,
            due_time: None,
            is_checkin,
            habit_id,
            field_values: None,
        }
    }

    fn old_item() -> Item {
        Item {
            id: 1,
            category_id: 1,
            title: "打卡记录".into(),
            description: None,
            start_date: Some("2026-11-21".into()),
            start_time: None,
            end_date: Some("2026-11-21".into()),
            end_time: None,
            due_date: None,
            due_time: None,
            created_at: "2026-11-21 00:00:00".into(),
            is_checkin: true,
            habit_id: Some(7),
        }
    }

    #[test]
    fn update_missing_checkin_fields_keeps_old() {
        // 拖拽改期路径（TC-CK-023）：不传打卡字段 → 保留旧打卡身份与关联
        let d = draft(None, None);
        let upd = d.resolve_update(&old_item());
        assert!(upd.is_checkin);
        assert_eq!(upd.habit_id, Some(7));
        // 日期按传入更新
        assert_eq!(upd.start_date, Some("2026-11-22"));
        assert_eq!(upd.end_date, Some("2026-11-22"));
    }

    #[test]
    fn update_explicit_checkin_overrides() {
        // 弹窗保存路径：显式传值（取消勾选时 habitId 传原值保留关联）
        let d1 = draft(Some(false), Some(7));
        let upd = d1.resolve_update(&old_item());
        assert!(!upd.is_checkin);
        assert_eq!(upd.habit_id, Some(7));
        let d2 = draft(Some(true), Some(9));
        let upd2 = d2.resolve_update(&old_item());
        assert!(upd2.is_checkin);
        assert_eq!(upd2.habit_id, Some(9));
    }

    #[test]
    fn create_missing_checkin_defaults_false() {
        // 新建路径：缺省=无打卡身份、无关联
        let d1 = draft(None, None);
        let new = NewItem::from(&d1);
        assert!(!new.is_checkin);
        assert_eq!(new.habit_id, None);
        let d2 = draft(Some(true), Some(3));
        let new2 = NewItem::from(&d2);
        assert!(new2.is_checkin);
        assert_eq!(new2.habit_id, Some(3));
    }
}

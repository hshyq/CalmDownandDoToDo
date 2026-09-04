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
    let upd = NewItem::from(&draft);
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

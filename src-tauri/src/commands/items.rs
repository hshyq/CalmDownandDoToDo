//! 事项 IPC（PRD 4.2/5.1/6.3/6.4；验收 TC-IT）。
//! 新增/编辑弹窗表单 → draft（标准字段）；自定义字段在 P6 引入。

use serde::Deserialize;
use tauri::State;

use crate::store::items::{Item, NewItem};
use crate::store::Db;

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

#[tauri::command]
pub fn create_item(db: State<'_, Db>, draft: ItemDraft) -> Result<Item, String> {
    let new = NewItem::from(&draft);
    db.create_item(&new).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_item(db: State<'_, Db>, id: i64, draft: ItemDraft) -> Result<Item, String> {
    let upd = NewItem::from(&draft);
    db.update_item(id, &upd).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_item(db: State<'_, Db>, id: i64) -> Result<(), String> {
    db.delete_item(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_item_detail(db: State<'_, Db>, id: i64) -> Result<Item, String> {
    db.get_item(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_items(db: State<'_, Db>, category_id: Option<i64>) -> Result<Vec<Item>, String> {
    db.list_items(category_id).map_err(|e| e.to_string())
}

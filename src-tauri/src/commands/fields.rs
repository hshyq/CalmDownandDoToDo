//! 字段 IPC（PRD 4.3/6.5/6.6；验收 TC-FLD-001~017）。

use serde::Serialize;
use tauri::State;

use crate::store::fields::FieldDef;
use crate::store::Db;

#[tauri::command]
pub fn list_fields(db: State<'_, Db>, category_id: i64) -> Result<Vec<FieldDef>, String> {
    db.list_fields(category_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_field(
    db: State<'_, Db>,
    category_id: i64,
    name: String,
    field_type: String,
    options: Option<Vec<String>>,
) -> Result<FieldDef, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("字段名称不能为空".to_string());
    }
    if name.chars().count() > 30 {
        return Err("字段名称不能超过 30 个字符".to_string());
    }
    db.create_field(category_id, name, &field_type, options)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_field(db: State<'_, Db>, id: i64, name: String) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("字段名称不能为空".to_string());
    }
    db.rename_field(id, name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_field(db: State<'_, Db>, id: i64) -> Result<(), String> {
    db.delete_field(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_field_options(db: State<'_, Db>, id: i64, options: Vec<String>) -> Result<(), String> {
    let clean: Vec<String> = options
        .into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if clean.is_empty() {
        return Err("选项列表不能为空".to_string());
    }
    db.set_field_options(id, clean).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn change_field_type(db: State<'_, Db>, id: i64, field_type: String) -> Result<(), String> {
    db.change_field_type(id, &field_type)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn move_field(db: State<'_, Db>, id: i64, direction: String) -> Result<(), String> {
    db.move_field(id, &direction).map_err(|e| e.to_string())
}

/// 事项某字段的值（前端按当前分类模板合并展示；value_json 为 JSON 文本）。
#[derive(Debug, Serialize)]
pub struct FieldValueRow {
    pub field_def_id: i64,
    pub value_json: Option<String>,
}

#[tauri::command]
pub fn list_item_field_values(
    db: State<'_, Db>,
    item_id: i64,
) -> Result<Vec<FieldValueRow>, String> {
    db.list_item_field_values(item_id)
        .map(|v| {
            v.into_iter()
                .map(|(field_def_id, value_json)| FieldValueRow {
                    field_def_id,
                    value_json,
                })
                .collect()
        })
        .map_err(|e| e.to_string())
}

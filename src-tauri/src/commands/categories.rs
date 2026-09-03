//! 分类 IPC（PRD 6.1/6.2；验收 TC-CL-001~009）。

use tauri::State;

use crate::store::categories::{Category, DeleteMode};
use crate::store::validation;
use crate::store::Db;

#[tauri::command]
pub fn list_categories(db: State<'_, Db>) -> Result<Vec<Category>, String> {
    db.list_categories().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_category(db: State<'_, Db>, name: String, color: String) -> Result<Category, String> {
    validation::validate_category_name(&name)?;
    validation::validate_color(&color)?;
    db.create_category(name.trim(), &color)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_category(db: State<'_, Db>, id: i64, name: String) -> Result<(), String> {
    validation::validate_category_name(&name)?;
    db.rename_category(id, name.trim())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_category_color(db: State<'_, Db>, id: i64, color: String) -> Result<(), String> {
    validation::validate_color(&color)?;
    db.set_category_color(id, &color).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn count_items_in_category(db: State<'_, Db>, category_id: i64) -> Result<i64, String> {
    db.count_items_in_category(category_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_category(db: State<'_, Db>, id: i64, mode: String) -> Result<(), String> {
    let mode = DeleteMode::parse(&mode).ok_or_else(|| "删除模式无效".to_string())?;
    db.delete_category(id, mode).map_err(|e| e.to_string())
}

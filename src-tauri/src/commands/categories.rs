//! 分类 IPC（PRD 6.1/6.2；验收 TC-CL-001~009）。
//! 写操作经 undo 包装：执行前取受影响行/级联快照，执行后 push 一步（P7，PRD 6.7）。

use tauri::{AppHandle, State};

use crate::store::categories::{Category, DeleteMode};
use crate::store::validation;
use crate::store::Db;
use crate::undo::{UndoCmd, UndoStack};

use super::undo::emit_depth;

#[tauri::command]
pub fn list_categories(db: State<'_, Db>) -> Result<Vec<Category>, String> {
    db.list_categories().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_category(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    name: String,
    color: String,
) -> Result<Category, String> {
    validation::validate_category_name(&name)?;
    validation::validate_color(&color)?;
    let cat = db
        .create_category(name.trim(), &color)
        .map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::CategoryCreate { cat: cat.clone() }));
    emit_depth(&app, &stack);
    Ok(cat)
}

#[tauri::command]
pub fn rename_category(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    name: String,
) -> Result<(), String> {
    validation::validate_category_name(&name)?;
    let before = db.get_category(id).map_err(|e| e.to_string())?;
    db.rename_category(id, name.trim())
        .map_err(|e| e.to_string())?;
    let after = db.get_category(id).map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::CategoryUpdate { before, after }));
    emit_depth(&app, &stack);
    Ok(())
}

#[tauri::command]
pub fn set_category_color(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    color: String,
) -> Result<(), String> {
    validation::validate_color(&color)?;
    let before = db.get_category(id).map_err(|e| e.to_string())?;
    db.set_category_color(id, &color)
        .map_err(|e| e.to_string())?;
    let after = db.get_category(id).map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::CategoryUpdate { before, after }));
    emit_depth(&app, &stack);
    Ok(())
}

#[tauri::command]
pub fn count_items_in_category(db: State<'_, Db>, category_id: i64) -> Result<i64, String> {
    db.count_items_in_category(category_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_category(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    mode: String,
) -> Result<(), String> {
    let mode = DeleteMode::parse(&mode).ok_or_else(|| "删除模式无效".to_string())?;
    // 删除前取整分类级联快照（分类 + 字段模板 + 事项 + 字段值），撤销时完整恢复（TC-UNDO-002）
    let snap = db
        .snapshot_category(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "分类不存在".to_string())?;
    db.delete_category(id, mode).map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::CategoryDelete {
        snap: Box::new(snap),
        mode,
    }));
    emit_depth(&app, &stack);
    Ok(())
}

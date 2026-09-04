//! 字段 IPC（PRD 4.3/6.5/6.6；验收 TC-FLD-001~017）。
//! 写操作经 undo 包装：字段改名/改类型/选项变更合并为 save_field 一步（PRD 6.7 粒度）。

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::store::fields::FieldDef;
use crate::store::Db;
use crate::undo::{UndoCmd, UndoStack};

use super::undo::emit_depth;

fn validate_field_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("字段名称不能为空".to_string());
    }
    if trimmed.chars().count() > 30 {
        return Err("字段名称不能超过 30 个字符".to_string());
    }
    Ok(trimmed)
}

#[tauri::command]
pub fn list_fields(db: State<'_, Db>, category_id: i64) -> Result<Vec<FieldDef>, String> {
    db.list_fields(category_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_field(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    category_id: i64,
    name: String,
    field_type: String,
    options: Option<Vec<String>>,
) -> Result<FieldDef, String> {
    let name = validate_field_name(&name)?;
    let def = db
        .create_field(category_id, &name, &field_type, options)
        .map_err(|e| e.to_string())?;
    let snap = db
        .snapshot_field(def.id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "字段不存在".to_string())?;
    stack.push(Box::new(UndoCmd::FieldCreate {
        snap: Box::new(snap),
    }));
    emit_depth(&app, &stack);
    Ok(def)
}

/// 一次字段编辑保存（改名 + 可选改类型 + 可选选项）= 一步撤销（PRD 6.7）。
/// 前端字段管理弹窗「保存」仅调用本命令，替代旧的多次独立 IPC。
#[tauri::command]
pub fn save_field(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    name: String,
    new_type: Option<String>,
    options: Option<Vec<String>>,
) -> Result<(), String> {
    let name = validate_field_name(&name)?;
    let before = db
        .snapshot_field(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "字段不存在".to_string())?;
    let clean_opts = options.map(|opts| {
        opts.into_iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
    });
    db.save_field_edit(id, &name, new_type.as_deref(), clean_opts.as_deref())
        .map_err(|e| e.to_string())?;
    let after = db
        .snapshot_field(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "字段不存在".to_string())?;
    stack.push(Box::new(UndoCmd::FieldUpdate {
        before: Box::new(before),
        after: Box::new(after),
    }));
    emit_depth(&app, &stack);
    Ok(())
}

#[tauri::command]
pub fn rename_field(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    name: String,
) -> Result<(), String> {
    let name = validate_field_name(&name)?;
    let before = db
        .snapshot_field(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "字段不存在".to_string())?;
    db.rename_field(id, &name).map_err(|e| e.to_string())?;
    let after = db
        .snapshot_field(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "字段不存在".to_string())?;
    stack.push(Box::new(UndoCmd::FieldUpdate {
        before: Box::new(before),
        after: Box::new(after),
    }));
    emit_depth(&app, &stack);
    Ok(())
}

#[tauri::command]
pub fn delete_field(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
) -> Result<(), String> {
    // 删除前取「字段模板 + 该字段全部值」快照（撤销时完整恢复，TC-FLD-003）
    let snap = db
        .snapshot_field(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "字段不存在".to_string())?;
    db.delete_field(id).map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::FieldDelete {
        snap: Box::new(snap),
    }));
    emit_depth(&app, &stack);
    Ok(())
}

#[tauri::command]
pub fn set_field_options(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    options: Vec<String>,
) -> Result<(), String> {
    let before = db
        .snapshot_field(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "字段不存在".to_string())?;
    db.set_field_options(id, options)
        .map_err(|e| e.to_string())?;
    let after = db
        .snapshot_field(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "字段不存在".to_string())?;
    stack.push(Box::new(UndoCmd::FieldUpdate {
        before: Box::new(before),
        after: Box::new(after),
    }));
    emit_depth(&app, &stack);
    Ok(())
}

#[tauri::command]
pub fn change_field_type(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    field_type: String,
) -> Result<(), String> {
    let before = db
        .snapshot_field(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "字段不存在".to_string())?;
    db.change_field_type(id, &field_type)
        .map_err(|e| e.to_string())?;
    let after = db
        .snapshot_field(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "字段不存在".to_string())?;
    stack.push(Box::new(UndoCmd::FieldUpdate {
        before: Box::new(before),
        after: Box::new(after),
    }));
    emit_depth(&app, &stack);
    Ok(())
}

#[tauri::command]
pub fn move_field(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    id: i64,
    direction: String,
) -> Result<(), String> {
    // 记录该分类全部字段排序前后状态，撤销/重做时按快照恢复（P7）。
    let cat = db
        .snapshot_field(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "字段不存在".to_string())?
        .def
        .category_id;
    let sorts = |defs: &[FieldDef]| {
        defs.iter()
            .map(|f| (f.id, f.sort_order))
            .collect::<Vec<_>>()
    };
    let before = sorts(&db.list_fields(cat).map_err(|e| e.to_string())?);
    db.move_field(id, &direction).map_err(|e| e.to_string())?;
    let after = sorts(&db.list_fields(cat).map_err(|e| e.to_string())?);
    stack.push(Box::new(UndoCmd::FieldSort { before, after }));
    emit_depth(&app, &stack);
    Ok(())
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

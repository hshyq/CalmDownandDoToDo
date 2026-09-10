//! 日期类型 IPC（PRD 5.5 v1.12；写操作经 undo 包装）。

use tauri::{AppHandle, State};

use crate::store::daytypes::DayTypeRow;
use crate::store::Db;
use crate::undo::{UndoCmd, UndoStack};

use super::undo::emit_depth;

/// 视图窗口内已指定的日期类型（前端按星期推算未指定的日期）。
#[tauri::command]
pub fn list_day_types(
    db: State<'_, Db>,
    view_start: String,
    view_end: String,
) -> Result<Vec<DayTypeRow>, String> {
    db.list_day_types(&view_start, &view_end)
        .map_err(|e| e.to_string())
}

/// 设置（day_type=Some）或清除（None）某日类型；一步撤销。
#[tauri::command]
pub fn set_day_type(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    date: String,
    day_type: Option<String>,
) -> Result<(), String> {
    let before = db.get_day_type(&date).map_err(|e| e.to_string())?;
    db.set_day_type(&date, day_type.as_deref())
        .map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::DayTypeSet {
        date,
        before,
        after: day_type,
    }));
    emit_depth(&app, &stack);
    Ok(())
}

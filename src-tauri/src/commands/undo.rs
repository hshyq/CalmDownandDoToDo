//! 撤销/重做 IPC（PRD 6.7；验收 TC-UNDO-001~009）。
//! 写命令在 store 执行前后取快照并 push 到 UndoStack，本模块提供 undo/redo/depth 与深度事件推送。

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::store::Db;
use crate::undo::UndoStack;

/// 深度事件载荷（Rust → 前端刷新撤销/重做按钮态）。
#[derive(Debug, Clone, Serialize)]
pub struct UndoDepthPayload {
    pub undo: usize,
    pub redo: usize,
}

/// 事件名（前端 undoStore 监听）。
pub const UNDO_DEPTH_EVENT: &str = "undo-depth";

/// 推送当前深度（写命令 push 后、undo/redo 后调用）。
pub fn emit_depth(app: &AppHandle, stack: &UndoStack) {
    let (undo, redo) = stack.depth();
    let _ = app.emit(UNDO_DEPTH_EVENT, UndoDepthPayload { undo, redo });
}

#[tauri::command]
pub fn undo(db: State<'_, Db>, stack: State<'_, UndoStack>, app: AppHandle) -> Result<(), String> {
    stack.undo(&db).map_err(|e| e.to_string())?;
    emit_depth(&app, &stack);
    Ok(())
}

#[tauri::command]
pub fn redo(db: State<'_, Db>, stack: State<'_, UndoStack>, app: AppHandle) -> Result<(), String> {
    stack.redo(&db).map_err(|e| e.to_string())?;
    emit_depth(&app, &stack);
    Ok(())
}

/// 当前深度（前端初始化按钮态 / 兜底刷新）。
#[tauri::command]
pub fn undo_depth(stack: State<'_, UndoStack>) -> Result<UndoDepthPayload, String> {
    let (undo, redo) = stack.depth();
    Ok(UndoDepthPayload { undo, redo })
}

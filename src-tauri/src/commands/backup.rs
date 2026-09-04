//! 备份 IPC（PRD 6.8 / 技术方案 5.4；验收 TC-BAK-001~006）。
//! 路径由前端经 tauri-plugin-dialog 获取：导出=另存为对话框（默认 data\backups\日期名），
//! 导入=打开文件对话框；导入整库替换并计入撤销栈（导入前快照落 data\undo_tmp，D10）。

use tauri::{AppHandle, State};

use crate::store::Db;
use crate::undo::{UndoCmd, UndoStack};

use super::undo::emit_depth;

/// 默认导出路径（data\backups\日历待办备份_<时间>.json），供「另存为」对话框作默认文件名。
#[tauri::command]
pub fn default_backup_path(db: State<'_, Db>) -> Result<String, String> {
    db.next_backup_path()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

/// 导出备份到用户指定路径（文件名含导出日期，TC-BAK-001）。
#[tauri::command]
pub fn export_backup(db: State<'_, Db>, path: String) -> Result<(), String> {
    let json = db.dump_json().map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("导出失败：{e}"))
}

/// 导入备份（路径来自系统打开对话框）：整库替换并计入撤销栈（TC-BAK-003）。
#[tauri::command]
pub fn import_backup(
    db: State<'_, Db>,
    stack: State<'_, UndoStack>,
    app: AppHandle,
    path: String,
) -> Result<(), String> {
    let text = std::fs::read_to_string(&path).map_err(|e| format!("读取备份文件失败：{e}"))?;
    // 导入前整库快照落盘 undo_tmp（D10；一期无 mail_config，不含授权码）
    let before = db.dump_json().map_err(|e| e.to_string())?;
    let tmp = stack
        .write_tmp("before_import", &before)
        .map_err(|e| format!("写入撤销快照失败：{e}"))?;
    db.import_json(&text).map_err(|e| e.to_string())?;
    stack.push(Box::new(UndoCmd::Import {
        before: tmp,
        import: text,
    }));
    emit_depth(&app, &stack);
    Ok(())
}

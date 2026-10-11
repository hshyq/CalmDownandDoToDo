//! 备份 IPC（PRD 6.8 / 技术方案 5.4；验收 TC-BAK-001~010）。
//! 路径由前端经 tauri-plugin-dialog 获取：导出=另存为对话框（**默认目录=桌面**，v1.29；
//! 拿不到桌面时回退 data\backups），导入=打开文件对话框；导入整库替换并计入撤销栈
//! （导入前快照落 data\undo_tmp，D10）。
//! 导出支持可选时间范围（v1.29）：start/end 同时传=范围导出（事项按 6.8 语义过滤，
//! 分类/字段定义/设置全量），同时缺省=全量导出。

use tauri::{AppHandle, Manager, State};

use crate::store::Db;
use crate::undo::{UndoCmd, UndoStack};

use super::undo::emit_depth;

/// 默认导出路径（桌面\日历待办备份_<时间>.json，v1.29），供「另存为」对话框作默认位置。
#[tauri::command]
pub fn default_backup_path(app: AppHandle, db: State<'_, Db>) -> Result<String, String> {
    let filename = db.backup_export_filename().map_err(|e| e.to_string())?;
    match app.path().desktop_dir() {
        Ok(desktop) => Ok(desktop.join(filename).to_string_lossy().into_owned()),
        // 罕见环境拿不到桌面（如服务会话）：回退 data\backups
        Err(_) => db
            .next_backup_path()
            .map(|p| p.to_string_lossy().into_owned())
            .map_err(|e| e.to_string()),
    }
}

/// 导出备份到用户指定路径（文件名含导出日期，TC-BAK-001）。
/// start/end 可选范围（v1.29）：须成对出现且为 yyyy-MM-dd；None=全量导出。
#[tauri::command]
pub fn export_backup(
    db: State<'_, Db>,
    path: String,
    start: Option<String>,
    end: Option<String>,
) -> Result<(), String> {
    let json = match (start, end) {
        (None, None) => db.dump_json().map_err(|e| e.to_string())?,
        (Some(start), Some(end)) => {
            let valid =
                |s: &str| s.len() == 10 && s.as_bytes()[4] == b'-' && s.as_bytes()[7] == b'-';
            if !valid(&start) || !valid(&end) {
                return Err("导出范围格式无效（应为 yyyy-MM-dd）".to_string());
            }
            if end < start {
                return Err("结束日期不能早于开始日期".to_string());
            }
            db.dump_json_range(&start, &end)
                .map_err(|e| e.to_string())?
        }
        // 只传其一：拒绝（前端总成对传，防误用）
        _ => return Err("导出范围参数不完整".to_string()),
    };
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

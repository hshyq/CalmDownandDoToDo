//! TXT 导出 IPC（PRD 6.9 / TC-EXP-001~006）。
//! 路径由前端经 tauri-plugin-dialog 另存为获取；查询/格式化/写文件收口 store::export。
//! 导出为只读操作，不进撤销栈。

use tauri::State;

use crate::store::Db;

/// TXT 导出默认路径（data\日历待办导出_<开始>_<结束>.txt），供「另存为」对话框作默认文件名。
#[tauri::command]
pub fn default_txt_path(db: State<'_, Db>, start: String, end: String) -> Result<String, String> {
    db.next_txt_path(&start, &end)
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

/// 导出 TXT 到用户指定路径（TC-EXP-003~005），返回 (日历条数, 待办条数) 供界面提示。
#[tauri::command]
pub fn export_items_txt(
    db: State<'_, Db>,
    path: String,
    start: String,
    end: String,
) -> Result<(usize, usize), String> {
    db.export_items_txt(std::path::Path::new(&path), &start, &end)
        .map_err(|e| e.to_string())
}

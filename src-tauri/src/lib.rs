//! 日历待办工具 · Rust 核心入口
//!
//! P0：最小骨架 + IPC（ping）。
//! P1：数据层 store（schema 迁移 / 归属与排序查询 / 校验）。
//! P2：分类模块（store::categories + commands::categories）。
//! 后续批次按 `doc/开发批次计划.md` 添加 items / undo 等。

pub mod commands;
pub mod store;
pub mod undo;

use crate::undo::UndoStack;
use tauri::Manager;

/// P0 IPC 冒烟：前后端打通验证。
#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

/// D11：检测 exe 同目录 `webview2\\` 固定版运行时并设置环境变量（运行期解析，禁止硬编码）。
fn prepare_webview2_fixed_runtime() {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()));
    let Some(dir) = exe_dir else { return };
    let fixed = dir.join("webview2");
    if fixed.join("msedgewebview2.exe").exists() {
        // 仅影响本进程后续创建的 WebView2 环境（Tauri 在此之后才初始化 WebView）
        std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", fixed);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // D11 运行部分：若 exe 同目录存在 webview2\（Fixed Version Runtime），
    // 在任何 WebView 创建前指向固定版，否则使用系统 Evergreen。
    prepare_webview2_fixed_runtime();
    // D9 单实例（决策 D9 / TC-ENV-001）：第二实例启动时聚焦已有主窗口
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 数据目录 = exe 同目录 data\（红线 6；运行期解析，禁止硬编码）
            let data_dir = std::env::current_exe()
                .map_err(|e| std::io::Error::other(format!("无法定位可执行文件：{e}")))?
                .parent()
                .ok_or_else(|| std::io::Error::other("无法定位可执行文件目录"))?
                .join("data");
            // 数据目录不可写 → 弹提示引导移至可写目录（TC-BAK-005），随后退出
            let db = match crate::store::Db::open(&data_dir) {
                Ok(db) => db,
                Err(e) => {
                    use tauri_plugin_dialog::DialogExt;
                    let _ = app
                        .dialog()
                        .message("数据目录不可写，无法保存数据。\n请把程序移动到可写目录（如桌面或文档）后重新打开。")
                        .title("无法启动")
                        .blocking_show();
                    return Err(std::io::Error::other(format!("初始化数据目录失败：{e}")).into());
                }
            };
            app.manage(db);
            app.manage(UndoStack::new(&data_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            commands::backup::default_backup_path,
            commands::backup::export_backup,
            commands::backup::import_backup,
            commands::categories::list_categories,
            commands::categories::create_category,
            commands::categories::rename_category,
            commands::categories::set_category_color,
            commands::categories::count_items_in_category,
            commands::categories::delete_category,
            commands::items::create_item,
            commands::items::update_item,
            commands::items::delete_item,
            commands::items::get_item_detail,
            commands::items::list_calendar_items,
            commands::items::list_todo_items,
            commands::fields::list_fields,
            commands::fields::create_field,
            commands::fields::save_field,
            commands::fields::rename_field,
            commands::fields::delete_field,
            commands::fields::set_field_options,
            commands::fields::change_field_type,
            commands::fields::move_field,
            commands::fields::list_item_field_values,
            commands::undo::undo,
            commands::undo::redo,
            commands::undo::undo_depth,
            commands::items::list_items
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}

#[cfg(test)]
mod tests {
    #[test]
    fn ping_ok() {
        assert_eq!(super::ping(), "pong");
    }
}

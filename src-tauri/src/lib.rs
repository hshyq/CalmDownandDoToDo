//! 日历待办工具 · Rust 核心入口
//!
//! P0：最小骨架 + IPC（ping）。
//! P1：数据层 store（schema 迁移 / 归属与排序查询 / 校验）。
//! P2：分类模块（store::categories + commands::categories）。
//! 后续批次按 `doc/开发批次计划.md` 添加 items / undo 等。

pub mod commands;
pub mod store;

use tauri::Manager;

/// P0 IPC 冒烟：前后端打通验证。
#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // 数据目录 = exe 同目录 data\（红线 6；运行期解析，禁止硬编码）
            let data_dir = std::env::current_exe()
                .map_err(|e| std::io::Error::other(format!("无法定位可执行文件：{e}")))?
                .parent()
                .ok_or_else(|| std::io::Error::other("无法定位可执行文件目录"))?
                .join("data");
            let db = crate::store::Db::open(&data_dir)
                .map_err(|e| std::io::Error::other(format!("初始化数据目录失败：{e}")))?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
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

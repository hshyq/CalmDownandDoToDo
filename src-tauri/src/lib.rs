//! 日历待办工具 · Rust 核心入口
//!
//! P0：最小骨架 + IPC 打通（ping）。
//! P1：数据层 store（schema 迁移 / 归属与排序查询 / 校验）。
//! 后续批次按 `doc/开发批次计划.md` 添加 commands / undo 等模块。

pub mod store;

/// P0 IPC 冒烟：前后端打通验证。
#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ping])
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

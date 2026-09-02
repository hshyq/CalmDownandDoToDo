// 禁止编译器在发布版弹出控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    calendar_todo_lib::run()
}

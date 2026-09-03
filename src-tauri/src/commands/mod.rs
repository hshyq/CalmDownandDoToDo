//! commands：IPC 入口层。职责 = 参数校验 → 调用 store（写操作经 undo 包装在 P7 接入）。
//! 错误统一转中文友好提示（AGENTS 第 5 节），前端直接展示。

pub mod categories;

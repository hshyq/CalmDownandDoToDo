# PROJECT_MAP.md — 代码地图

> **当前状态**：开发阶段 · **P9 一期收尾**（P0~P8 均已完成并逐批验收提交）。下方目录树为**当前实际结构**；改动必须同步本图（只写现状，禁止写变更过程）。
>
>
> **P1 已落地**（2026-09-03）：`src-tauri/src/store/`（mod.rs / schema.rs / validation.rs）——schema_migrations 幂等迁移（v1 建 6 表 + 3 索引 + `items.created_at`）；`Db::open`；`list_calendar_items`（窗口交集）/ `list_todo_items`（COALESCE 哨兵沉底）查询；应用层校验函数；12 项单测通过。schema 数据字典同步见技术方案 v1.3。
> **P2 已落地**（2026-09-03，代码完成待手测 TC-CL）：后端 `store/categories.rs`（Category/DeleteMode/种子 ensure_seeded/list/create/rename/set_color/delete 二选一 + 6 项单测）与 `commands/categories.rs`（list/create/rename/set_category_color/count_items_in_category/delete_category，`Db` 经 setup manage）；前端 `components/TabBar/`（TabBar/ColorPicker 11×6 色盘）、`components/Modal/`、`stores/appStore.ts`（zustand）、`services/ipc.ts|types.ts|mock.ts`、`features/color/palette.ts`（纯函数+vitest）、`styles/tokens.css`。后端 cargo test 18 passed、前端 vitest 5 passed、clippy 零警告、vite build 通过、tauri dev 起窗正常（vite watch 已忽略 `src-tauri/target` 修 EBUSY）。
>
> **P4 已落地**（2026-09-03，代码完成待手测 TC-CAL）：注册 `list_calendar_items` IPC；前端 `features/calendar/`（dates.ts/layout.ts 纯函数 + 10 vitest）、`components/Calendar/CalendarView.tsx`（周/月、补齐、今日高亮、横条泳道/跨格、+N 浮层、格内「+」预填日期、总览选分类）；ItemModal presetStartDate；ItemsView 过渡列表退役。vitest 15 passed、build/tauri dev 正常。
>
> **P5 已落地**（2026-09-03，代码完成待手测 TC-DUE）：注册 `list_todo_items` IPC；前端 `features/todo/group.ts`（分组纯函数+2 vitest）、`components/Todo/TodoPanel.tsx`（时间轴分组/折叠/虚拟滚动/条目色块点击编辑）；appStore dataVersion/bump 跨面板刷新。vitest 17 passed、build/tauri dev 正常。
> **P6 已落地**（2026-09-04，代码完成待手测 TC-FLD）：后端 `store/fieldconvert/`（FieldType/JSON 编解码/`(from,to)` 矩阵 + 7 穷举测试）、`store/fields.rs`（CRUD/set_options 过滤/change_type 迁移/move_field）、`store/values.rs`（set/list）、`commands/fields.rs` 8 IPC（commit 1d0cbe7）；前端 `services/types.ts|ipc.ts`（FieldDef/FieldType/FieldValueRow/FieldValuePayload + fieldApi）、`features/fields/value.ts`（字段值 JSON 编解码/选项解析纯函数 + 8 vitest）、`components/fields/FieldEditor.tsx`（六类型控件）、`components/fields/FieldManager.tsx`（增删改名/改类型确认/选项维护/↑↓排序）、`ItemModal` 字段区（按当前分类模板加载、值加载/保存合并、切分类实时刷新，PRD 4.3）、`CalendarView` 工具栏「字段管理」入口、`global.css` 字段区/管理样式。vitest 25 passed、build 通过、tauri dev 起窗正常。
> **P7 已落地**（2026-09-04，撤销部分用户验收通过；TC-ENV-001 待手测）：`store/snapshot.rs`（事项/字段/整分类级联快照与恢复原语 + 5 测试）、`undo/`（UndoStack 双栈上限 10、UndoCmd 命令枚举覆盖增删改/级联删除/排序 + 4 测试）；commands 全部写操作经快照入栈、字段复合 `save_field`（一次保存=一步撤销）、undo/redo/undo_depth IPC + `undo-depth` 事件；前端 `stores/undoStore.ts`（按钮态/事件监听/撤销后跨面板刷新）、工具栏 ↶↷ 按钮、Ctrl+Z/Y 快捷键（输入框内不触发）；D9 单实例 `tauri-plugin-single-instance` v2.4.4（第二实例聚焦已有窗口，经用户确认引入）；D11 WebView2 固定版目录检测设 `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER`。cargo 43 tests、clippy/fmt 0、vitest 25、build/tauri dev 正常。
> **P8 已落地**（2026-09-04，代码完成待手测 TC-BAK）：`store/backup.rs`（整库 dump/导入 + 语义校验 TC-BAK-006 + 事务整库替换 + 默认导出路径 `data\backups\`）；undo 增 Import 命令（导入前整库快照落 `data\undo_tmp`，D10，重启清理、随命令丢弃删除）；commands `default_backup_path()`/`export_backup(path)`/`import_backup(path)`（经官方 tauri-plugin-dialog 自选目录/文件）；前端 `components/Settings/SettingsDialog.tsx`（⚙ 设置 → 数据备份：另存为导出/打开导入 + 二次确认 + 导入后跨面板刷新并计入撤销栈）、`services/ipc.ts` backupApi。cargo 47 tests、vitest 25、clippy/fmt 0、build/tauri dev 正常。
> **P9 已落地**（2026-09-04，待用户回归最小集）：TC-BAK-005（启动时数据目录不可写经 dialog 弹提示引导）；`README.md` 重写为正式版使用说明（绿色目录启动/WebView2 固定版 D11 打包步骤/数据与备份）；便携发布目录 `src-tauri\target\release\日历待办工具 v0.1.0\`（`日历待办工具.exe` ≈7.4MB + README + 使用说明.txt）；release exe 双击启动验证通过（自动生成 data\）。cargo 47 tests、vitest 25、clippy/fmt 0。
>
> **P3 已落地**（2026-09-03，代码完成待手测 TC-IT）：后端 `store/items.rs`（Item/NewItem、全字段校验 create/update/delete/get/list + 3 单测）与 `commands/items.rs`（ItemDraft camelCase、6 个 IPC）；前端 `components/Items/`（ItemModal 新增/编辑/删除、ItemsView 过渡列表分组「日历/待办」）、types/ipc/mock 扩展、appStore 事项操作。后端 cargo test 21 passed、前端 vitest 5 passed、clippy 零警告、vite build/tauri dev 正常。

## 一句话架构

前端（React + TS，WebView 渲染）通过 IPC command 调用 Rust 核心；Rust 的 `store` 是唯一写库方（SQLite，exe 同目录 `data\calendar.db`）；所有用户数据写操作经 `undo` 命令包装；一期零网络代码。

## 目录树

```
20260831 日历工具/
├─ AGENTS.md                  AI 行为准则（新对话必读）
├─ PROJECT_MAP.md             本文件
├─ TODO.md                    当前进度与下一步
├─ README.md                  人类使用说明（安装/使用/备份）
├─ CHANGELOG.md               版本日志
│
├─ doc/                       项目文档
│  ├─ PRD.md                  需求唯一权威（核心规则在第 5 章）
│  ├─ 技术方案.md             实现唯一权威（数据字典/决策记录）
│  ├─ 测试用例.md             防回归契约（回归最小集在文末）
│  └─ 原型.html               UI 契约（浏览器打开对照，不灌入对话）
│
├─ src/                       前端（React 18 + TypeScript）
│  ├─ main.tsx                入口：挂载 App、注册全局快捷键（Ctrl+Z/Y）
│  ├─ App.tsx                 根组件：三栏布局骨架（标签栏│日历│待办）
│  ├─ components/             组件（按模块目录组织）
│  │  ├─ TabBar/              左侧标签栏：总览/分类/未分类/⋮菜单；ColorPicker 色盘
│  │  ├─ Modal/               弹窗基座（遮罩/头部/底部）
│  │  ├─ Calendar/            日历视图 CalendarView（周/月、横条泳道/+N、格内「+」快捷新建）
│  │  ├─ Items/               事项弹窗 ItemModal（标准字段 + P6 自定义字段区）
│  │  ├─ Todo/                待办面板 TodoPanel（时间轴分组/折叠/虚拟滚动）
│  │  ├─ Settings/           设置弹窗 SettingsDialog（数据备份：导出/导入）
│  │  └─ fields/              自定义字段：FieldEditor 六类型控件 / FieldManager 字段管理弹窗
│  ├─ features/               纯函数 + vitest 单测
│  │  ├─ calendar/            dates.ts / layout.ts（周月网格、横条布局纯函数）
│  │  ├─ todo/                group.ts（待办分组纯函数）
│  │  ├─ color/               palette.ts（色盘选取纯函数）
│  │  └─ fields/              value.ts（字段值 JSON 编解码/选项解析纯函数）
│  ├─ stores/
│  │  ├─ appStore.ts      分类/事项/标签页状态 + dataVersion（跨面板刷新）
│  │  └─ undoStore.ts     撤销/重做按钮态（镜像 Rust 深度，undo-depth 事件同步）
│  ├─ services/
│  │  ├─ ipc.ts               invoke 封装：categoryApi/itemApi/fieldApi/undoApi/backupApi（错误转中文提示）
│  │  ├─ types.ts             与 Rust 对齐的 TS 类型（Category/Item/FieldDef/FieldValue 等）
│  │  └─ mock.ts              浏览器预览分类/事项模拟（验收走 tauri dev 真实 IPC）
│  └─ styles/
│     ├─ tokens.css           设计 token（分类色盘/间距/圆角/字号）
│     └─ global.css           全局样式（三栏骨架/弹窗/日历/待办/字段区与字段管理）
├─ src-tauri/                 Rust 核心
│  ├─ tauri.conf.json         窗口配置；bundle.targets=["none"]（单便携 exe）
│  ├─ Cargo.toml              一期不引入任何网络依赖 crate
│  └─ src/
│     ├─ main.rs              进程入口（单实例互斥量；WebView2 检测/固定版环境变量）
│     ├─ lib.rs               Tauri Builder：注册全部 command、事件、托盘
│     ├─ commands/            IPC 入口层：参数校验 → 写操作经 undo 包装 → store
│     │  ├─ categories.rs     分类 list/create/rename/set_color/delete(mode)
│     │  ├─ items.rs          事项 CRUD、query_calendar(窗口查询)、query_todo
│     │  ├─ fields.rs         字段 CRUD、change_type(转换矩阵表驱动)、set_options
│     │  ├─ backup.rs         export/import JSON（导入前整库快照入撤销栈）
│     │  ├─ undo.rs           undo / redo / undo_depth
│     │  └─ mail.rs           （二期）邮箱配置/发送测试/失败手动重试 retry_send/同步 send_queue
│     ├─ store/               SQLite 唯一写库方（P1 已落地）
│     │  ├─ mod.rs            Db(Mutex 单连接)/open/迁移调用；日历窗口交集、待办 COALESCE 排序查询
│     │  ├─ backup.rs        P8 整库 dump/导入 + 语义校验（TC-BAK-006）+ 默认导出路径
│     │  ├─ schema.rs         schema_migrations 管理 + 迁移 v1（只增不改历史）
│     │  └─ validation.rs     应用层校验（分类名/颜色/标题/日期时刻成对/结束不早于开始）
│     │  └─ snapshot.rs   P7 撤销快照/恢复原语（行级/字段/整分类级联）
│     ├─ undo/                UndoStack 双栈（上限 10、重启清空）+ UndoCmd 命令枚举
│     ├─ mailer.rs            （二期）lettre SMTP + TLS，失败重试 3 次
│     ├─ scheduler.rs         （二期）tokio interval 30s 扫描提醒：到点弹窗+计划内发信
│     ├─ crypto.rs            （二期）DPAPI 加解密（授权码）
│     └─ tray.rs              （二期）托盘常驻
│
└─ data\                      运行期生成：calendar.db（gitignore，随 exe 目录走）
```

## 数据流转

```
用户操作 → React 组件 → services/ipc.ts invoke → src-tauri commands/
  ├─ 写操作 → undo 模块登记（快照）→ store/ 写 SQLite → 返回结果
  └─ 读操作 → store/ 查询（按可见窗口/标签页过滤）→ 返回元数据
前端刷新 ← invoke 返回值；异步通知 ← Rust event（reminder-due / expired-reminders / mail-sent-result）
```

## 「改哪里」速查

| 要改什么 | 去哪 | 配套动作 |
| :--- | :--- | :--- |
| 日历横条排布 / 跨格 / +N | `src/features/calendar/layout.ts`（纯函数） | 补 vitest 用例；对照 TC-CAL-004~007 |
| 周一起始 / 月补齐 / 今日高亮 | `MonthGrid.tsx` / `WeekGrid.tsx` | 对照 TC-CAL-001/002/008 |
| 待办排序、99991231 沉底 | `src-tauri/src/store/mod.rs`（COALESCE 查询） | 对照 TC-DUE-001~004 |
| 日历/待办归属规则 | 不在代码某处——由查询条件表达（`start_date`/`end_date` 判空） | 对照 TC-IT-001~007 |
| 字段类型转换矩阵 | `src-tauri/src/commands/fields.rs`（(from,to) 表驱动） | 对照 TC-FLD-004~017；先看 PRD 6.6 |
| 字段管理弹窗 / 事项字段区 | `src/components/fields/FieldManager.tsx`、`FieldEditor.tsx`、`ItemModal.tsx` | 对照 TC-FLD-001~017、PRD 4.3/6.5/6.6；切分类按模板过滤 |
| 字段值 JSON 编解码 / 选项解析 | `src/features/fields/value.ts`（纯函数） | 与后端 fieldconvert 对齐；改编码先补 vitest |
| 撤销/重做 | `src-tauri/src/undo/`（栈与快照）、`store/snapshot.rs`、前端 `stores/undoStore.ts` + 工具栏 ↶↷ / Ctrl+Z·Y | 对照 TC-UNDO-001~009；快照恢复只 UPSERT |
| 分类色盘 / 颜色 token | `src/styles/tokens.css` | 与原型一致 |
| 分类删除二选一 | `commands/categories.rs` delete(mode) | 对照 TC-CL-003~006 |
| 备份导入导出 | `store/backup.rs` + `commands/backup.rs` + `components/Settings/SettingsDialog.tsx` | 对照 TC-BAK-001~006；导入前整库快照落 undo_tmp（D10） |
| 二期邮件/调度 | `mailer.rs` / `scheduler.rs` / `mail.rs` | 对照 TC-MAIL-001~011；确认符合 AGENTS 红线 1 |
| 界面文案 / 友好报错 | 组件内 + `services/ipc.ts` 错误转换 | 中文；AGENTS 第 5 节 |


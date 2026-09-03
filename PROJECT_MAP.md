# PROJECT_MAP.md — 代码地图

> **当前状态**：开发阶段 · **P0 工程初始化已完成**（2026-09-02）。下方目录树为**目标蓝图**；★ 标记 P0 已落地的文件，其余随 `doc/开发批次计划.md`（P1~P9）落地后**必须**同步更新本图（只写现状，禁止写变更过程）。
>
> **P0 已落地清单**（2026-09-02）：根 `package.json` / `index.html` / `tsconfig.json` / `vite.config.ts` / `.gitignore`；`src/main.tsx`、`src/App.tsx`（P0 冒烟页）、`src/styles/global.css`、`src/test/smoke.test.ts`；`src-tauri/Cargo.toml`、`build.rs`、`tauri.conf.json`、`capabilities/default.json`、`icons/`（含 icon.ico 与源图 app-icon.png）、`src-tauri/src/main.rs`、`src-tauri/src/lib.rs`（P0 提供 `ping` IPC）。
> **P0 验收**：`npm run build`（tsc+vite）✓、`vitest run` ✓、`cargo test` ✓、`cargo clippy --all-targets` 零警告 ✓、`cargo fmt` ✓、`npm run tauri dev` 窗口已起 ✓、IPC pong 已人工确认 ✓。
>
> **P1 已落地**（2026-09-03）：`src-tauri/src/store/`（mod.rs / schema.rs / validation.rs）——schema_migrations 幂等迁移（v1 建 6 表 + 3 索引 + `items.created_at`）；`Db::open`；`list_calendar_items`（窗口交集）/ `list_todo_items`（COALESCE 哨兵沉底）查询；应用层校验函数；12 项单测通过。schema 数据字典同步见技术方案 v1.3。
> **P2 已落地**（2026-09-03，代码完成待手测 TC-CL）：后端 `store/categories.rs`（Category/DeleteMode/种子 ensure_seeded/list/create/rename/set_color/delete 二选一 + 6 项单测）与 `commands/categories.rs`（list/create/rename/set_category_color/count_items_in_category/delete_category，`Db` 经 setup manage）；前端 `components/TabBar/`（TabBar/ColorPicker 11×6 色盘）、`components/Modal/`、`stores/appStore.ts`（zustand）、`services/ipc.ts|types.ts|mock.ts`、`features/color/palette.ts`（纯函数+vitest）、`styles/tokens.css`。后端 cargo test 18 passed、前端 vitest 5 passed、clippy 零警告、vite build 通过、tauri dev 起窗正常（vite watch 已忽略 `src-tauri/target` 修 EBUSY）。
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
│  ├─ components/             通用展示组件
│  │  ├─ TabBar/              左侧标签栏：总览/分类/未分类/⋮设置菜单/⚙设置入口
│  │  ├─ Modal/               弹窗基座 + 确认对话框（删除二次确认等）
│  │  └─ VirtualList/         待办列表虚拟滚动
│  ├─ features/
│  │  ├─ calendar/            日历区
│  │  │  ├─ MonthGrid.tsx     月视图网格（周一起始、前后月补齐、今日高亮）
│  │  │  ├─ WeekGrid.tsx      周视图（1 行 × 7 列）
│  │  │  ├─ EventBar.tsx      横条渲染（标题、分类色圆角、截断+悬停）
│  │  │  ├─ layout.ts         横条布局纯函数：截断/分段/泳道/+N（vitest 单测）
│  │  │  └─ DayOverlay.tsx    「+N」当日事项浮层
│  │  ├─ todo/
│  │  │  ├─ TodoPanel.tsx     待办区容器（按当前标签页过滤）
│  │  │  └─ Timeline.tsx      纵向时间轴：空心圆点、年月分组、折叠展开
│  │  └─ fields/
│     │  └─ FieldEditor.tsx   自定义字段渲染与录入（六种类型控件）
│  ├─ stores/
│  │  ├─ appStore.ts          当前标签页、周/月视图、待办折叠状态（会话级）
│  │  └─ undoStore.ts         撤销/重做按钮态（镜像 Rust undo_depth）
│  ├─ services/
│  │  ├─ ipc.ts               invoke 封装与错误转换（技术错误→友好中文提示）
│  │  └─ types.ts             与 Rust 结构体对齐的 TS 类型（禁止 any）
│  └─ styles/
│     └─ tokens.css           设计 token：分类色盘（11×6+自定义）/间距/圆角/字号
│
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
│     │  ├─ schema.rs         schema_migrations 管理 + 迁移 v1（只增不改历史）
│     │  └─ validation.rs     应用层校验（分类名/颜色/标题/日期时刻成对/结束不早于开始）
│     ├─ undo/                命令栈：apply/revert、上限 10 步、重启清空
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
| 撤销/重做 | `src-tauri/src/undo/`（栈与快照） | 对照 TC-UNDO-001~009 |
| 分类色盘 / 颜色 token | `src/styles/tokens.css` | 与原型一致 |
| 分类删除二选一 | `commands/categories.rs` delete(mode) | 对照 TC-CL-003~006 |
| 备份导入导出 | `commands/backup.rs` | 对照 TC-BAK-001~004；勿含授权码 |
| 二期邮件/调度 | `mailer.rs` / `scheduler.rs` / `mail.rs` | 对照 TC-MAIL-001~011；确认符合 AGENTS 红线 1 |
| 界面文案 / 友好报错 | 组件内 + `services/ipc.ts` 错误转换 | 中文；AGENTS 第 5 节 |

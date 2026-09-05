# 更新日志

本文件记录项目里程碑与文档/UI 变更历史。现状类文档（PROJECT_MAP.md、README.md）只描述当前状态，变更过程一律记在这里。

## 2026-08-31（文档阶段）

### 新增
- 产品与技术方案定稿：`doc/PRD.md` v1.2（一期全量需求 + 二期范围，含字段类型转换矩阵）
- `doc/技术方案.md` v1.1：技术选型、系统架构、SQLite 数据字典、关键决策记录 D1~D8
- `doc/测试用例.md`：8 模块 78 条用例 + 16 条回归最小集
- 项目治理文档：`AGENTS.md`、`PROJECT_MAP.md`、`TODO.md`、`README.md`、`CHANGELOG.md`
- 目录骨架：`src/`、`src-tauri/`、`doc/`
- 《Vibe Coding 项目文档标准化指南》（外部文件）更新：场景清单纳入「测试用例」「UI 原型」两份文档及其维护纪律
- `doc/原型.html`：UI 交互原型（单文件零依赖，可点击演示：标签页、周/月切换、事项增删改与日历⇄待办动态迁移、待办折叠、+N 浮层、分类管理、字段管理界面）；泳道布局/跨周截断/+N 计算已冒烟验证

### 决策记录
- 二期提醒改为「SMTP 到点直发」：原"草稿+邮箱定时发送"因草稿无法携带定时属性而不可行；过期未发提醒启动时弹窗告知、不补发（PRD v1.1）
- 「文本/数字/日期 → 单选/多选」转换按历史值去重生成选项，零数据丢失（PRD v1.2）
- 备份文件不含邮箱授权码（DPAPI 密文与机器绑定）
- 无截止时间事项的分组名由「未设截止」改为「长期规划」（PRD v1.3，随原型走查反馈）
- 分类颜色采用 11×6 飞书式色盘（第 1 行=第 4 行，每列同色系由浅到深）+「更多颜色」自定义 HEX/RGB（PRD v1.3）
- 原型按首轮走查反馈修订：弹出层支持二次点击关闭、删除分类即时刷新、日历随标签页过滤、工具栏顺序调整、横条圆角与间距、年月标题弹出周/月选择面板；事项弹窗时间控件隐藏系统图标、点击输入框任意位置即打开选择器

### 待办
- 用户确认 `doc/原型.html`（UI 契约）——确认前不动业务代码

## 2026-09-02（文档阶段·设计评审修订）

### 新增
- `doc/PRD.md` v1.4：日历事项截止时间仅在详情弹窗展示；日历格内横条按开始时间升序（相同按创建顺序）；提醒弹窗去掉「标记完成」（关闭即已处理）；发送失败不自动重试、改为发送记录手动重试；过期记录不可重试
- `doc/技术方案.md` v1.2：决策记录扩展至 D12（D9 单实例、D10 撤销导入快照剔除授权码+大快照落临时文件、D11 WebView2 Fixed Version 捆绑免预装、D12 zustand 确认）；导入备份语义校验；reminders 去除 done、send_queue 状态机与手动重试；并发模型 spawn_blocking；窗口交集索引策略；打包形态改为「exe + webview2\」绿色目录
- `doc/测试用例.md`：83 条用例 + 回归最小集 17 条；新增 TC-CAL-011、TC-BAK-006、TC-MAIL-010/011、TC-ENV-001，修订 TC-MAIL-008
- `TODO.md`：基线刷新为 PRD v1.4 / 技术方案 v1.2 / 测试用例 83 条；git 初始化暂缓

### 决策记录（本轮评审）
- 日历事项的截止时间仅详情展示；日历格内排序按开始时间（A1/A2）
- 备份导入增加语义校验，违规整次拒绝（A3）
- 提醒弹窗关闭即已处理；发送失败手动重试、不自动重试（A4/B6）
- 单实例（A5/D9）；撤销快照落盘且剔除授权码（B1/D10）；WebView2 Fixed Version 捆绑免预装（B3/D11）；DPAPI 解不开时友好降级（B4）；async command 走 spawn_blocking（B5）；二期置顶弹窗/托盘真机验收（B7）
- 原型修复：layoutWeek 泳道排序键补上开始时刻 (cs, start_time, ce, id)（无时刻视为 00:00），与 PRD 5.3（v1.4）A2 规则对齐——同一格内多条横条按开始时间升序、相同按创建顺序；修复前按创建顺序导致晚创建但开始时刻更早的事项被压在下方
- 原型一致性：+N 当日浮层列表排序与格内规则对齐（无时刻视为 00:00 排前、开始时刻升序、相同时按创建顺序），修正原 '99' 兜底把无时刻事项排到最后的问题
- 原型新增：日历格 hover「+」快捷新建入口——悬浮当月日期格（周/月视图）右上角出现「+」，点击打开新增弹窗且开始日期默认=该格日期；总览页与补齐格不显示（PRD 6.3 升级 v1.5，新增 TC-IT-012）
- 原型修订：快捷入口扩展至总览页——总览页周/月视图同样出现格内「+」，点击后新增弹窗显示「所属分类」下拉（默认第一个分类，切分类联动字段模板）；分类/未分类页仍不显示该字段；补齐格仍不显示（PRD 6.3 升级 v1.6，修订 TC-CL-007 / TC-IT-012）
- PRD 5.3 落档：「+N」浮层列表顺序与格内一致（按开始时间、无时刻视为 00:00、相同按创建先后）；测试用例增至 85 条（新增 TC-CAL-012）


## 2026-09-02（开发阶段 · P0 工程初始化）

### 新增
- 工程骨架：Tauri 2（2.11.5）+ React 18 + TypeScript + Vite + vitest + zustand（D12）；目录按 PROJECT_MAP 蓝图，`.gitignore` 就位（data\、node_modules\、dist\、src-tauri\target\）
- git 仓库初始化（git init -b main）与首次提交 2588e7b（经用户批准；.gitignore 含 .zcode/）
- 后端最小 IPC：`ping` command 打通前后端；`tauri.conf.json`（identifier com.calendartodo.app、bundle.active=false）、capabilities、Windows 图标全套（占位图标，源图 `src-tauri/icons/app-icon.png`）
- 开发机环境：配置 cargo 国内镜像（`~/.cargo/config.toml`，rsproxy 稀疏索引）以解决 crates.io 下载过慢问题

### 验收
- `npm run build` / `vitest run` / `cargo test` / `cargo clippy --all-targets` / `cargo fmt` 全部通过；`npm run tauri dev` 窗口成功创建（MainWindowTitle=日历待办工具）
- 待人工确认：窗口内页面显示「后端返回：pong」


## 2026-09-03（开发阶段 · P1 数据层）

### 新增
- 依赖：`rusqlite`（0.32，`bundled` 特性；决策 D3 既定，一期零网络 crate）
- `src-tauri/src/store/`：
  - `schema.rs`：`schema_migrations` 幂等迁移（空表按 0 处理），v1 建一期 6 表（categories / items / field_defs / item_field_values / app_settings / schema_migrations）+ 3 索引；`items.created_at`（待办同刻按创建时间排序所需）
  - `mod.rs`：`Db`（Mutex 单连接）、`open`（建目录+外键+迁移）、`list_calendar_items`（窗口交集 start_date<=view_end AND end_date>=view_start）、`list_todo_items`（COALESCE 9999-12-31 沉底 + created_at 兜底）
  - `validation.rs`：分类名/颜色/标题/日期时刻成对/结束不早于开始 校验（中文提示，供 IPC 透传）
- 技术方案 v1.3：3.1 items 补 `created_at`；`app_settings` 明确一期建表并移入 3.1

### 验收
- `cargo test` 12 passed（迁移幂等/建表、归属分集、窗口交集与分类过滤、同刻 created_at 兜底、校验矩阵）；`cargo clippy --all-targets` 零警告；`cargo fmt` 干净；`cargo build` 通过


## 2026-09-03（开发阶段 · P2 分类模块）

### 新增
- 后端：`store/categories.rs`（Category/DeleteMode、首次启动种子 ensure_seeded、list/create/rename/set_color/delete 二选一、count；6 项单测）；`commands/categories.rs`（5 个 IPC）；`lib.rs` setup 打开 `data\calendar.db` 并 `manage(Db)`，注册分类命令
- 前端：标签栏与分类管理（总览固定顶/普通分类/未分类固定底/⚙设置占位、⋮菜单=改色/重命名/删除、删除二选一弹窗、11×6 色盘+自定义、新建分类默认取色盘最少用色）；`stores/appStore.ts`（zustand）、`services/ipc.ts|types.ts|mock.ts`、`features/color/palette.ts`（纯函数+4 单测）、`styles/tokens.css`
- 修复：vite dev watch 忽略 `src-tauri/target`（tauri dev 编译占用 exe 导致 EBUSY）

### 验收
- 后端 `cargo test` 18 passed、clippy 零警告；前端 `vitest` 5 passed、`npm run build` 通过；`tauri dev` 起窗正常、`data\calendar.db` 自动创建
- **用户手测通过**：TC-CL-001~009 全部验收（2026-09-03）
- **决策 A**：删除分类「移入未分类」时字段模板与其值一并清除（FK 级联），事项标准字段完整保留——PRD v1.7、TC-CL-005、技术方案 3.1 已同步

## 2026-09-03（开发阶段 · P3 事项模块）

### 新增
- 后端：`store/items.rs`（Item/NewItem、标题/日期时刻成对/结束不早于开始/分类存在校验，create/update/delete/get/list + 3 单测）；`commands/items.rs`（ItemDraft camelCase，create/update/delete/get_item_detail/list_items 6 个 IPC）；lib.rs 注册
- 前端：`components/Items/ItemModal.tsx`（新增/编辑：标题/描述/开始/结束/截止，编辑可换分类+删除二次确认）；`ItemsView.tsx`（过渡列表：按标签过滤，分「日历/待办」两组、分类色点、归属徽标、空态）；types/ipc/mock/appStore 扩展

### 验收
- 后端 `cargo test` 21 passed、clippy 零警告；前端 `vitest` 5 passed、`npm run build` 通过；`tauri dev` 起窗正常
- 待人工手测：TC-IT-001~012（归属动态迁移在过渡列表中即时可见；日历横条展示属 P4）

## 2026-09-03（开发阶段 · P4 日历视图）

### 新增
- 后端：注册 `list_calendar_items` IPC（窗口交集 + 分类过滤，复用 P1 store）
- 前端：`features/calendar/dates.ts`（周一起始/月行生成/今天等纯函数）+ `layout.ts`（(cs,start_time,ce,id) 泳道布局纯函数）+ 10 项 vitest（TC-CAL 布局/TC-CAL-011 排序）；`components/Calendar/CalendarView.tsx`（周/月切换、‹›导航/今天、周一起始、前后月补齐、今日高亮、横条泳道/跨格截断/分类色、+N 浮层列表按开始时间、格内「+」快捷新建预填日期、总览格+显示所属分类下拉）；ItemModal 支持 presetStartDate 与总览选分类；过渡列表 ItemsView 退役删除
### 验收
- 前端 `vitest` 15 passed、`npm run build` 通过；后端 21 passed、clippy 零警告；`tauri dev` 起窗正常
- 待人工手测：TC-CAL-001~012（对照 doc/原型.html）

## 2026-09-03（开发阶段 · P5 待办视图）

### 新增
- 后端：注册 `list_todo_items` IPC（复用 P1 store：COALESCE 9999-12-31 沉底 + created_at 兜底）
- 前端：`features/todo/group.ts` 分组纯函数（按年月分组、「长期规划」沉底，+2 vitest）；`components/Todo/TodoPanel.tsx`（时间轴：组头圆点/年月/数量、点击折叠展开（会话级）、条目整块分类色白字、点击打开编辑弹窗、简易虚拟滚动）；appStore 增加 dataVersion/bump，日历/待办跨面板写后同步刷新

### 验收
- 前端 `vitest` 17 passed、`npm run build` 通过；后端 21 passed、clippy 零警告；`tauri dev` 起窗正常
- 待人工手测：TC-DUE-001~008、TC-FLD-014（待办条目只显示标题）

## 2026-09-03（开发阶段 · P6 自定义字段 · 后端）

### 新增
- `store/fieldconvert/mod.rs`：六类型枚举、value_json 编解码、`(from,to)` 表驱动转换矩阵（PRD 6.6）+ 7 组穷举测试
- `store/fields.rs`：字段 CRUD、新建校验（单选/多选必带选项）、set_options 失效项过滤（TC-FLD-012/013）、change_type 事务内迁移历史值并生成选项（文本/数字/日期→单选/多选按历史去重）、move_field 上移下移 + 6 测试
- `store/values.rs`：事项字段值 upsert/list（切分类不删其它分类值，PRD 4.3）
- `commands/fields.rs`：list/create/rename/delete/set_field_options/change_field_type/move_field/list_item_field_values 8 个 IPC；items ItemDraft 增加 fieldValues 并在 create/update 保存
### 验收
- `cargo test` 34 passed、clippy 零警告
- 前端字段管理 UI 与事项弹窗字段区（TC-FLD 手测）下一步继续
## 2026-09-04（开发阶段 · P6 自定义字段 · 前端）

### 新增
- `services/types.ts`：FieldType/FIELD_TYPE_LABELS/FieldDef/FieldValueRow/FieldValuePayload 类型与守卫；`ItemDraft.fieldValues`（仅覆盖当前分类模板字段，PRD 4.3）
- `services/ipc.ts`：fieldApi（list/create/rename/remove/setOptions/changeType/move/listItemValues 8 命令）
- `features/fields/value.ts`：字段值 JSON 编解码/选项解析/载荷构建纯函数（与后端 fieldconvert 对齐）+ 8 vitest
- `components/fields/FieldEditor.tsx`：六类型录入控件（文本/多行/数字/日期/单选/多选复选组）
- `components/fields/FieldManager.tsx`：字段管理弹窗（列表/↑↓排序/新增/改名/改类型确认/选项维护/删除二次确认「将丢失该字段下所有已填写数据」；非选项→选项零丢失提示）
- `ItemModal.tsx`：自定义字段区（按当前分类模板实时渲染、编辑时加载并保存字段值、切分类旧值保留展示层按模板过滤）
- `CalendarView.tsx`：分类/未分类页工具栏「字段管理」入口（总览无，PRD 6.5）
- `global.css`：字段区与字段管理弹窗样式（对齐原型）
### 验收
- `vitest` 25 passed（+8 字段值纯函数）、`npm run build` 通过、clippy/fmt 零告警（后端未改）、`tauri dev` 起窗正常
- **待用户手测**：TC-FLD-001~017（字段管理增删改/类型转换/选项维护、事项弹窗字段值保存与切分类保留、总览无字段模板、日历/待办仍只显示标题）

## 2026-09-04（开发阶段 · P7 撤销/重做与进程）

### 新增
- `store/snapshot.rs`：事项/字段/整分类级联快照与恢复原语（UPSERT 行 + 值集合 replace）+ 5 单测
- `undo/mod.rs`：UndoStack 双栈（上限 10 步、重启清空、新操作清空重做栈）+ UndoCmd 命令枚举（分类/事项/字段增删改、级联删除、字段排序）+ 4 单测
- commands 全部写操作接入撤销：执行前取快照 → store 执行 → push 一步；新增 `save_field` 复合命令（字段弹窗一次保存=一步撤销，PRD 6.7 粒度）；`undo/redo/undo_depth` IPC + `undo-depth` 事件（深度变化推送前端）
- 前端 `stores/undoStore.ts`（按钮态镜像 + 事件监听 + 撤销后刷新分类/事项并 bump 跨面板重查）、工具栏 ↶↷ 按钮、全局 Ctrl+Z/Ctrl+Y（焦点在输入框/文本域/可编辑区不触发）
- D9 单实例：官方 `tauri-plugin-single-instance` v2.4.4（经用户确认引入，红线 2 流程）；第二实例自动退出并聚焦已有窗口（TC-ENV-001）
- D11 运行部分：启动时检测 exe 同目录 `webview2\`，存在则设 `WEBVIEW2_BROWSER_EXECUTABLE_FOLDER`（打包目录放置 P9 落实）
### 验收
- `cargo test` 43 passed（+9）、clippy/fmt 零告警；`vitest` 25 passed、`npm run build` 通过；`tauri dev` 起窗正常
- **用户验收通过**：TC-UNDO-001~009（撤销/重做/上限/重做栈清空/输入框内不触发等）
- 单实例自动验证：第二实例 exit=0 拦截生效；TC-ENV-001 待用户双击手测确认

## 2026-09-04（开发阶段 · P8 备份）

### 新增
- `store/backup.rs`：整库 dump（分类/字段定义/事项[含字段值]/设置 + format_version/exported_at，不含授权码）与导入（格式版本校验、语义校验 TC-BAK-006：标题/日期成对/结束不早于开始/单选多选值命中选项，事务内整库替换）+ 默认导出路径函数 `data\backups\日历待办备份_<时间>.json` + 3 测试
- `undo`：新增 Import 命令——导入前整库快照落 `data\undo_tmp`（D10，内存只存路径，命令丢弃/重启清理），撤销=恢复导入前状态、重做=重放导入内容；UndoStack 启动清空 undo_tmp
- `commands/backup.rs`：`default_backup_path()` / `export_backup(path)` / `import_backup(path)`；导出/导入路径经官方 `tauri-plugin-dialog`（用户另存为自选目录、打开选文件；经用户确认引入），技术方案 5.4 IPC 表同步
- 前端 ⚙ 设置弹窗 `components/Settings/SettingsDialog.tsx`（数据备份：另存为对话框导出[默认文件名含日期] / 打开对话框导入 + 二次确认「将覆盖当前全部数据」+ 导入后分类/事项刷新并 bump，可 Ctrl+Z 撤销导入）；`services/ipc.ts` backupApi
### 验收
- `cargo test` 47 passed（+4）、clippy/fmt 零告警；`vitest` 25 passed、`npm run build` 通过；`tauri dev` 起窗正常
- **待用户手测**：TC-BAK-001~006（导出内容与文件名、导入二次确认、导入后 Ctrl+Z 恢复、损坏/语义违规拒绝）
- 说明：TC-BAK-005（只读目录启动提示）属启动健壮性，P9 收尾评估；导出/导入均经系统对话框由用户选择目录/文件（应验收反馈调整，未提交）

## 2026-09-04（P9 一期收尾 · v0.1.0）

### 新增 / 变更
- TC-BAK-005：启动时数据目录不可写 → 弹系统提示「请移到可写目录」后退出（经 tauri-plugin-dialog，不再静默失败）
- `README.md` 重写为正式版使用说明：绿色便携目录启动、WebView2 固定版捆绑步骤（D11 打包部分）、数据/备份/换机说明、开发命令
- 便携发布目录：`src-tauri\target\release\日历待办工具 v0.1.0\`（`日历待办工具.exe` ≈7.4MB + README + 使用说明.txt，内含 webview2\ 固定版放置指引）
### 验收
- `cargo test` 47 passed、`vitest` 25 passed、clippy/fmt 零告警；release exe 双击启动验证正常（自动生成 data\）
- **待用户最终回归**：回归最小集 17 条（TC-IT-001/006/007、TC-DUE-001/002/005、TC-CAL-001/004/005/007/011、TC-FLD-004/008、TC-UNDO-002/004/006、TC-BAK-003）

## 2026-09-04（v0.1.0 发布后修复）

### 修复
- 字段管理弹窗编辑已有字段（改名/改类型/选项维护）报 `Command save_field not found`：P7 引入的复合命令 `save_field` 漏注册于 `lib.rs`，已补注册（commit e90a126）；便携目录已重新打包并清理测试遗留 data
### 验收
- 用户复测通过；cargo 47 passed、clippy/fmt 0；新版 release exe 双击启动验证通过

## 2026-09-04（流程规则修正）

### 变更
- AGENTS.md 第 7 节新增「发布与打包铁律」：便携版 `data\` 视为生产数据（用户以便携版正式使用），严禁删除/覆盖；发布新版须新建独立版本目录或仅替换 exe；release exe 启动验证须在临时目录进行；删除 data 必须先经用户确认
- TODO.md「给下次对话的提醒」同步该规则
### 背景
- 修复 save_field 后重打包便携版时误删便携目录 data\（将其当作测试残留），教训记录为上述铁律

## 2026-09-05（v0.1.0 后功能增强 · 拖拽改期与快捷入口）

### 新增 / 变更（PRD v1.8，测试用例 88 条）
- 日历格「+」新增事项：开始**与结束**日期均默认=该格日期（原仅开始日期预填；时刻为空）；入口扩展至月视图前后月**补齐格**（原补齐格不显示）
- 拖拽改期：日历横条可拖拽到目标日期格，按「落格日期 − 原开始日期」偏移整体平移起止日期（跨度与已填时分不变，原地放下不产生写库）
- 待办拖入日历：待办条目可拖拽到日历格，开始=结束=落格日期（已填时分保留），按 5.1 规则立即迁入日历
- 两者均走 `update_item`（撤销栈可回退），不改标题/描述/截止/分类/自定义字段值
### 实现
- 前端新增 `features/calendar/drag.ts`（shiftRange/todoDropDates 纯函数 + BAR_MIME/TODO_MIME 来源区分）+ 6 vitest；`CalendarView` 横条 draggable、daycell dragover/drop 与落格高亮；`TodoPanel` 条目 draggable；`global.css` grab 光标与 dragover 高亮
- `tauri.conf.json` 窗口 `dragDropEnabled:false`：Windows 上 Tauri 系统级文件拖放监听会禁用 WebView 内 HTML5 拖拽（本项目无文件拖入需求）
- UI 契约同步 `doc/原型.html`（补齐格「+」、结束日期预填、拖拽演示）
### 验收
- `cargo test` 47 passed、`vitest` 31 passed、`npm run build` 通过；原型 script 语法冒烟通过
- **用户手测通过**：TC-IT-012（预填/补齐格入口）、TC-CAL-013/014（拖拽改期/待办拖入，含 Ctrl+Z 回退）、TC-CAL-015（补齐格入口）


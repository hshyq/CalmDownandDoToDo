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

## 2026-09-05（v0.2.0 发布）

### 变更
- 版本号 0.1.0 → 0.2.0（tauri.conf.json / Cargo.toml / package.json）
- README 更新：状态行、功能特性（拖拽改期、预填结束日期、补齐格入口）
### 打包（遵守发布铁律）
- 便携目录：`src-tauri\target\release\日历待办工具 v0.2.0\`（`日历待办工具.exe` ≈7.4MB + README + 使用说明.txt）；**v0.1.0 目录及其 data\（生产数据）未触碰**
- 使用说明.txt 新增 v0.2.0 拖拽改期说明与「从 v0.1.0 升级：拷贝旧 data\ 或仅替换 exe」指引
- 启动验证在**临时目录**进行：exe 启动正常（窗口「日历待办工具」）、data\calendar.db 自动创建、D9 单实例拦截第二实例生效；验证后进程终止、临时目录清理，无残留
### 升级方式（用户）
- 方式一（推荐）：把 v0.1.0 目录中的 data\ 整体拷入 v0.2.0 目录；或方式二：仅用 v0.2.0 的 exe 替换 v0.1.0 目录中的旧 exe（均不丢数据）

## 2026-09-08（用户正式目录迁移 + 交互修订）

### 变更
- **正式使用目录**：经用户确认迁至项目 `release\日历待办工具 v0.2.0\`（生产数据 data\ 随迁，78 条事项校验完整）；.gitignore 排除 `release\`；`src-tauri\target\release\` 下旧目录为待清理副本
- 日历工具栏顺序改为「‹ / 今天 / ›」（用户反馈，对齐原型既有契约）
- 新增**年月标题点击选择面板**（原型 pk-* 契约落地，TC-CAL-016/017）：月视图=12 宫格选月+翻年，选后跳该月（原日保留、天数截断）；周视图=按月浏览周行网格（当前周高亮、今天点标记），点整行跳该周；点击面板外关闭
### 验收
- `npm run build`、`vitest` 31 passed；**待用户手测 TC-CAL-016/017**（与颜色选择器需求一起打包交付）

## 2026-09-08（v0.2.1 交互与色盘修订）

### 变更（PRD v1.9，测试用例 91 条）
- **分类色盘改墨刀式**（用户确认，色值取自墨刀取色器截图实测）：1 行灰阶 9 档 + 4 行柔和彩色（9 色系由浅到深），替代 11×6 飞书式；新建分类默认色取标准行（第 3 行）；「更多颜色」升级为 SV 渐变面板 + 色相条 + HEX 输入（三者联动，原 HEX/RGB 输入弹窗废弃）
- **色块文字颜色自适应**（5.4）：日历横条/待办条目文字随背景亮度自动切深字 `#1F1F1F` 或白字（YIQ>160），适配色板中的浅色；去掉固定白字与文字阴影
- **原型契约补齐**（正式版此前遗漏的 3 处）：周视图标题显示本周区间（如 `2026-09-01 ~ 09-07`，原显示年月）；总览页工具栏加「不可新增，仅编辑/删除」标签；事项弹窗与日期字段时间控件隐藏系统图标、点击输入区任意位置打开选择器（showPicker）
### 实现
- `features/color/palette.ts` 重写（墨刀色板/stdRow/`textColorOn`/`hexToHsv`/`hsvToHex` 纯函数，vitest +5）；`ColorPicker.tsx` 重写（色板网格 + SV 面板拖拽取色）；`CalendarView`/`TodoPanel`/`ItemModal`/`FieldEditor` 配套；`global.css` 色盘与取色面板样式
- 原型同步（色板数据、SV 取色弹窗、字色自适应）；测试用例修订 TC-CL-001、TC-CAL-003、TC-DUE-007，新增 TC-CL-010、TC-IT-013
### 验收
- `cargo test` 47 passed、`vitest` 36 passed、`npm run build` 通过、原型 script 语法冒烟通过
- **待用户手测**：TC-CL-001/010（新色盘与默认色）、TC-CAL-003/016/017（字色/年月面板/工具栏）、TC-DUE-007、TC-IT-013（时间控件）
### 打包（遵守发布铁律）
- 版本号 0.2.0 → 0.2.1；正式目录 `release\日历待办工具 v0.2.0\` 重命名为 `release\日历待办工具 v0.2.1\` 并仅替换 exe 与使用说明.txt（**生产 data\ 原地未动**，78 条事项校验完整）
- 新 exe 临时目录启动验证通过（窗口正常、calendar.db 自动创建），验证环境已清理

## 2026-09-08（v0.2.2 总览页开放新增）

### 变更（PRD v1.10，用户反馈）
- 总览页工具栏新增「+ 新增事项」按钮：弹窗显示「所属分类」下拉（默认第一个分类），与日历格「+」入口并存
- 移除总览页「不可新增，仅编辑/删除」提示标签（v1.9 按原型补的标签，随规则开放一并移除）
- 分类页/未分类页行为不变（默认当前分类、不显示分类下拉）
### 文档
- PRD v1.10（3 章总览行 / 6.3 入口 / 6.4 总览能力）；TC-CL-007 修订；原型同步（总览显示新增按钮、去 tag）
### 验收
- `npm run build`、`vitest` 36 passed；待用户手测 TC-CL-007（总览新增）
### 打包
- 版本号 0.2.1 → 0.2.2；正式目录重命名为 `release\日历待办工具 v0.2.2\` 并仅替换 exe 与使用说明.txt（生产 data\ 原地未动，78 条事项校验完整）；临时目录启动验证通过后清理

## 2026-09-08（交互增强 · 头尾拖拽与待办日数字；日期类型方案出原型待确认）

### 新增（PRD v1.11，测试用例 93 条）
- **横条头尾拖拽改期**（TC-CAL-018）：拖横条左缘改开始日期、右缘改结束日期，可跨行/跨周/跨月；拖动中横条实时跟随指针，越界钳制（拖头不越过结束、拖尾不早于开始）；走 update_item 计入撤销；`drag.ts` 新增 `clampEdge` 纯函数（+6 vitest）
- **待办条目右侧日数字**（TC-DUE-009）：标题左侧、最右侧显示截止日期的「日」（09-20 → 20；长期规划显示 —）
### 日期类型方案（需求：工作日/休息日/法定假日 + 日历标注，**原型已出方案待用户确认**）
- 标注方案：每格数字右侧角标「班（蓝）/ 休（灰）/ 假（红）」，法定假日日期数字红色；未指定的日期按周一~五工作日、周六日休息日推算
- 编辑方案：工具栏「日期类型」按钮 → 月历式管理弹窗，点击日期循环切换 班→休→假→恢复默认，可翻月，带图例
- 原型含演示数据（09-12/13 调休上班、10-01~03 法定假日）；正式版待确认后实现（涉及 schema 迁移 v2 新表 + IPC + undo）
### 验收
- `npm run build`、`vitest` 42 passed、原型 script 语法冒烟通过；待用户确认日期类型方案后一并打包

## 2026-09-08（v0.3.0 日期类型正式版）

### 新增（PRD v1.12，测试用例 106 条；方案经用户确认）
- **日期类型**（PRD 5.5 / TC-DT-001~006）：默认周一~五工作日、周六日休息日；可指定任意日期为工作日（班·蓝）/休息日（休·灰）/法定假日（假·红），清除即恢复默认；仅存覆盖项（schema 迁移 **v2** 新表 `day_types`，未指定日期按星期推算不落库）
- **日历标注**：每格数字右侧角标；法定假日日期数字红色
- **编辑入口**：工具栏「日期类型」按钮 → 月历管理弹窗（`DayTypeDialog`，点击日期循环切换、翻月、图例；单元格数字与角标 flex 对齐——用户反馈原型对齐问题已修）；日历格角标直接点击同样切换
- 写操作（设置/清除）经 undo 包装（`UndoCmd::DayTypeSet` before/after），Ctrl+Z 可回退；数据持久化
- 用户已确认角标/编辑方案与「其他没有问题」，横条头尾拖拽、待办日数字一并随本版打包
### 实现
- 后端：schema v2、`store/daytypes.rs`（list/get/set + 日期与类型校验 + 3 测试）、`commands/daytypes.rs`（list_day_types/set_day_type）、undo 新命令、lib.rs 注册；cargo **50** passed、clippy/fmt 0
- 前端：`types.ts`（DayType/DayTypeRow/`defaultDayType` + 3 vitest）、`ipc.ts` dayTypeApi、`CalendarView` 角标与加载、`DayTypeDialog.tsx`、global.css 样式；vitest **45** passed、build 通过
### 打包
- 版本号 0.2.2 → **0.3.0**（schema 变更 + 新功能）；正式目录 `release\日历待办工具 v0.2.2\` 重命名为 `release\日历待办工具 v0.3.0\`，替换 exe 与使用说明.txt（生产 data\ 原地未动，82 条事项校验完整）
- 临时整目录副本启动验证：用户旧库（schema v1）自动迁移到 v2、`day_types` 表创建、82 条事项完好；验证后进程终止、临时副本清理，原目录未动

## 2026-09-08（v0.3.1 滚轮切换周期）

### 新增（PRD v1.13，TC-CAL-019，用户反馈）
- 鼠标悬浮日历视图区时，滚轮滚动切换上/下周期（周视图按周、月视图按月，向下=下一个周期）；按滚动量累计触发防一次滚动连跳；日历内容溢出（窗口较矮）时不劫持滚轮、保留内容滚动；原型同步
### 验收与打包
- `npm run build`、`vitest` 45 passed、原型 script 冒烟通过；版本号 0.3.0 → 0.3.1；正式目录重命名为 `release\日历待办工具 v0.3.1\` 并替换 exe 与使用说明.txt（生产 data\ 原地未动）


## 2026-09-14（UI 微调：描述输入区加高）

### 变更（用户反馈）
- 新增/编辑事项弹窗中「描述」多行文本输入区由 2 行加高至 **5 行**（`ItemModal` `rows=5`；`doc/原型.html` 描述 textarea 同步 `rows="5"`，UI 契约一致）
- 自定义字段的「多行文本」类型控件保持 2 行不变（本次仅调整标准描述字段）
### 验收
- `vitest` 45 passed、`npm run build` 通过；未触及 Rust 后端与数据结构
### 打包
- 版本号 0.3.1 → **0.3.2**；正式目录重命名为 `release\日历待办工具 v0.3.2\` 并替换 exe 与使用说明.txt（生产 data\ 原地未动）；临时目录启动验证通过后清理
- 排障记录：`tauri build` 失败系 `target\` 构建缓存硬编码项目移动前旧路径（`D:\project\20260831 日历工具`，缺 `02 工具类\` 层级）；清除 `target\release\build` 与 `.fingerprint` 后重编通过

## 2026-09-14（事项弹窗点外关闭）

### 变更（用户确认的行为规则，测试用例先行：TC-IT-014/015）
- 新增/编辑事项弹窗打开时，点击**弹窗以外、应用窗口以内**的区域（遮罩）→ 弹窗立即关闭且**不保存**（等同「取消」，编辑中修改丢弃、数据库保持原值）；点击**应用窗口以外**（切换其他软件）→ 行为不变，弹窗保留、切回后内容仍在
- 生效范围**仅事项弹窗**（用户确认）：设置/日期类型/字段管理/颜色选择器等其余弹窗保持点外不关、显式按钮关闭
- 删除二次确认弹窗点外 → 仅关确认框退回编辑弹窗（用户确认），不执行删除
- 实现：`Modal` 基座新增可选 `closeOnOverlayClick`（默认 false 行为不变）；按下/松开都在遮罩上才判定为点外关闭（防拖拽误关）；`busy` 期间不响应；遮罩点击一律 `stopPropagation` 不穿透到底层日历与嵌套外层弹窗
- 原型同步：`modal()` 增加 `dismissable` 参数，仅事项弹窗传 true；其余 7 处弹窗（更多颜色/重命名分类/新建分类/日期类型/某日事项/字段管理/设置）由原「点外关闭」改为「点外不关」，与实现精确对齐
### 验收
- `vitest` 45 passed、`npm run build` 通过、原型 script 语法冒烟通过；未触及 Rust 后端；**用户手测 TC-IT-014/015 通过**
### 打包
- 版本号 0.3.2 → **0.3.3**；正式目录重命名为 `release\日历待办工具 v0.3.3\` 并替换 exe 与使用说明.txt（生产 data\ 原地未动）；临时目录启动验证通过（data 自动初始化、进程存活）后清理

## 2026-09-15（定名 CalmDownandDoToDo）

### 变更
- 项目定名 **CalmDownandDoToDo**（无连字符，「Calm Down and Do To-Do」口号式命名，用户选定；GitHub 查重无同名仓库，最近似的 gabemiller/calmdown 为 markdown 编辑器、领域不同）
- 分工：英文名对外（GitHub 仓库名 + README 大标题 + 口号「先冷静，再一件件做完」）；中文「日历待办工具」对内（exe 文件名、窗口标题、发布目录名不变）
- 同步：README 大标题与副题、AGENTS.md 项目速览；`identifier`（com.calendartodo.app）与 productName 保持不变，数据目录不受影响
### 发布
- GitHub Release **v0.3.3** 已发布：https://github.com/hshyq/CalmDownandDoToDo/releases/tag/v0.3.3
- 附件 `CalmDownandDoToDo-v0.3.3.zip`（2.9MB，英文名顶层目录 + exe/README/使用说明，**不含生产 data**）；License 文件（MIT）随仓库入库；本地临时打包文件已清理
- Release 附件更新（用户反馈）：zip 内容精简为 exe + 使用说明（移除仓库版 README——压缩包内文档导航失效无意义）；使用说明.txt 精简为「使用/WebView2/备份」三节（用户修订）；发布目录内 README.md 已移除；新 zip 已替换 Release 旧附件

## 2026-09-15（事项弹窗标题框拉宽）

### 变更（用户反馈，UI 修复）
- 事项弹窗「标题」输入框与「描述」输入区同宽（占满整行）
- 根因：标题 input 缺 `type="text"` 属性，未匹配样式表 `input[type="text"]` 的 `flex: 1` 选择器，宽度塌为默认值；原型中本有该属性（代码与原型契约的偏差，本次对齐）。FieldEditor 各类型控件均已带 type，无同类问题
### 验收
- `vitest` 45 passed、`npm run build` 通过；待用户手测
### 打包
- 版本号 0.3.3 → **0.3.4**；正式目录重命名为 `release\日历待办工具 v0.3.4\` 并替换 exe 与使用说明.txt（生产 data\ 原地未动）；临时目录启动验证通过后清理
- GitHub Release **v0.3.4** 已发布：https://github.com/hshyq/CalmDownandDoToDo/releases/tag/v0.3.4 ，附件 `CalmDownandDoToDo-v0.3.4.zip`（2.9MB，仅 exe + 使用说明，不含生产 data）
- 排障记录：`tauri dev` 同样受 `target\debug` 旧路径缓存影响，已清除 debug 侧 build 与 .fingerprint（release 侧上次已清）

# TODO.md — 进度便签

> 用法：新对话先读 `AGENTS.md`，再扫一眼本文件了解进度；结束对话前必须刷新本文件（记录当前进度与下一步）。

**2026-11-21 指令 B+C 完成：已推送并发布 v0.3.20（本地与远程同步）**：①推送 `bc653d4..99624d7`（5 个提交：fix 拖拽改期保留打卡身份 + v0.3.20 打包 + 文档）到 main——本次代理 127.0.0.1:10808 未开、**直连推送/API 全程可用**（网络备忘更新：先试直连，不通再走代理）。②GitHub Release **v0.3.20（便携绿色版）** 已上线（正式非 draft，tag v0.3.20 指向 main），附件 `CalmDownandDoToDo-v0.3.20.zip`（仅 exe+使用说明，2.9MB），notes=拖拽改期保留打卡身份修复；下载 HEAD 验证 200、latest 指向正确。③token 与临时文件已清理（未入仓库）。正式目录现状：`release\日历待办工具 v0.3.19\` 与 `v0.3.20\`（均含生产 data；v0.3.17/v0.3.18 用户已自行清理）。

**2026-11-21 v0.3.20 已打包（指令「打包」完成；随 B+C 发布）**：随本版内容——缺陷修复：拖拽改期/转待办保留打卡身份与打卡项关联（`fix 2e01f3b`，TC-CK-023，用户手测通过）。版本号三处升 0.3.20 + CHANGELOG（功能条目+发布条目）+ Cargo.lock 联动。**新建** `release\日历待办工具 v0.3.20\`（exe 7.9MB+使用说明，从 v0.3.19 原样复制）；临时目录启动验证通过（窗口正常、data 自动生成、migrations 1~5、种子分类 5 条）后清理；**v0.3.19 目录及生产 data\ 原地未动**（已核对）。

**2026-11-21 修复：拖拽改期清空打卡身份（已提交 2e01f3b；用户手测通过；随 v0.3.20 打包）**：现象=打卡事项在月视图拖到另一日期后，「打卡」勾与「打卡项」被清空。根因=`update_item` 的 ItemDraft.is_checkin 缺省=false、habit_id 缺省=写 NULL，而拖拽改期唯一写库口 `CalendarView.moveItem`（横条平移/待办拖入/头尾拖拽共用）与日历拖入待办的 `calendarToTodoDraft` 都不传这两个字段；事项弹窗保存是成对显式传（正常）。修复=**打卡字段改「缺省=保留原值」契约**（对齐 fieldValues 不传不动）：后端 `ItemDraft.is_checkin` 改 `Option<bool>`，新增 `resolve_update(old)` 填充（update 用）+ `From` 缺省 false（create 用）+3 单测；前端 mock.update 对齐（isCheckin 缺省保留）、types.ts/两调用点注释。测试用例先行：TC-CK-023（四种拖拽后打卡身份保留、热力图跟随）+变更记录；PROJECT_MAP 速查更 001~023。验证：cargo 68 passed（+3）、clippy/fmt 0、vitest 89、tsc/build 通过；用户手测通过。

**2026-10-15 指令 B+C 完成：已推送并发布 v0.3.19（本地与远程同步）**：①推送 `981d730..9138aee`（14 个提交：v1.28 拖拽排序+字段管理入设置 / v1.29 备份导出优化 / v1.30 打卡入口精简 / 三次打包 / 文档一致性修复）到 main。②GitHub Release **v0.3.19（便携绿色版）** 已上线（正式非 draft，tag v0.3.19 指向 main），附件 `CalmDownandDoToDo-v0.3.19.zip`（仅 exe+使用说明，2.9MB），notes 涵盖 v0.3.16 之后全部更新（三批功能按版本分段）；下载地址 HEAD 验证 200、latest 指向正确。③发布后清理：git credential token、临时 zip/stage/notes 文件全部删除（token 未入仓库）。**网络备忘：本机直连 github.com 443 超时，系统代理 127.0.0.1:10808（V2Ray 系）——git 需 `-c http.proxy=http://127.0.0.1:10808`，python urllib 需 ProxyHandler，git credential 取 token 的文件放项目目录而非 /tmp（Windows python 看不见 Git Bash 的 /tmp）**。正式目录现状：`release\日历待办工具 v0.3.18\` 与 `v0.3.19\`（均含生产 data；v0.3.17 用户已自行清理）。

**2026-10-15 文档一致性审计与修复（用户指令「检查文档一致性」）**：修复 4 处——①README 版本行 v0.3.16→v0.3.19、功能特性补三批新功能（分类/打卡项拖拽排序、打卡两入口、字段管理设置入口、备份两段式+默认桌面）②README 日期类型入口「工具栏」→「设置→日期类型」（v0.3.9 时代旧账，上次审计漏网）③PROJECT_MAP 状态行更至 v1.28~v1.30 完成随 v0.3.17/18/19 打包、远端最后发布 v0.3.16④CHANGELOG 补「2026-10-07 v0.3.17 发布」条目（当时打包提交漏写，按时间序插入并注明补记）。核对无矛盾：PRD/测试用例/技术方案/TODO/原型/开发批次计划/版本号三处；提示（未动）：release 各版「使用说明.txt」备份节未涵盖范围导出（用户自维护）。

**2026-10-15 v0.3.19 已打包（指令「打包」完成）**：随本版内容——PRD v1.30 移除打卡视图「＋ 添加打卡」按钮与弹窗（打卡记录创建入口=「今天打卡」+事项弹窗勾「打卡」；空态引导改指「设置→打卡项」）。本地提交 `7a6449f`（feat v1.30）+ chore（版本 0.3.19 三处与 CHANGELOG）+ Cargo.lock 联动。**新建** `release\日历待办工具 v0.3.19\`（exe 7.9MB+使用说明）；临时目录启动验证通过后清理；旧版本目录与生产 data\ 原地未动。**已随 B+C 指令发布。**

**2026-10-11 v1.30 移除打卡视图「添加打卡」按钮已开发完成并提交（7a6449f；用户手测通过；随 v0.3.19 打包）**：打卡视图 ckbar 右上「＋ 添加打卡」按钮与整个 AddCheckinModal/NewHabitInput 组件删除（原型同步删 openCheckinModal/saveCheckin/ckApplyTpl 与按钮）；空打卡项引导改「可在设置→打卡项创建，或编辑事项时勾选打卡输入新名称」；打卡记录创建入口=「今天打卡」快捷按钮 + 事项弹窗勾「打卡」（补历史日期=打卡后编辑改日期）；PRD 6.11 表述同步（打卡项创建入口三→两、模板带出时机三→两）。文档同步：测试用例（TC-CK-008/014/017 修订+变更记录）、PRD v1.30、PROJECT_MAP。验证：vitest 89、tsc/build 通过、tauri dev 起窗正常、原型浏览器实测（按钮移除/范围切换/今天打卡保留）。

**2026-10-11 v0.3.18 已打包（指令「打包」完成；本地已提交、未推送、未建 Release）**：随本版内容——PRD v1.29 导出备份优化（两段式范围选择+默认桌面）+ v1.28（分类/打卡项拖拽排序、字段管理入设置弹窗、可见列对齐，已随 v0.3.17 打包过 exe 但未发布 GitHub）。本地提交 `51d708f`（feat v1.29）+ `ec8509c`（chore 版本与 CHANGELOG）+ Cargo.lock 联动；版本号三处升 0.3.18。**新建** `release\日历待办工具 v0.3.18\`（exe 7.9MB+使用说明，从 v0.3.17 原样复制）；临时目录启动验证通过（窗口正常、data 自动生成、migrations 1~5、种子分类 5 条）后清理；**v0.3.17 目录及生产 data\ 原地未动**（已核对，含今日使用数据）。**等指令 B「推送」（本地领先远程 9 个提交）/ 指令 C「发布 v0.3.18」**。

**2026-10-11 v1.29 导出备份优化已开发完成并提交（51d708f；用户手测通过；随 v0.3.18 打包）**：两段式导出——①设置→数据备份→「导出备份」先弹范围弹窗（默认当前自然月；快捷 本月/上个月/上上个月/全部 高亮填入、自然月跨年正确；自定义起止=手改后高亮消失；「全部」日期置灰禁用=不过滤）②「选择位置并导出」→另存为**默认桌面**（`app.path().desktop_dir()`，失败回退 data\backups）→按范围导出 JSON（format_version 2 不变，可直接导入）。后端：`dump_range`（范围语义=日历开始+结束均有且与范围交集即含、否则按截止在范围内、无截止不含；分类/字段定义/设置始终全量）+`export_backup(path,start?,end?)`（成对/格式/顺序校验）+`export_filename`；前端：`backupQuickRange` 纯函数（+3 vitest 含跨年/闰年）、ipc export 可选范围、SettingsDialog 范围弹窗（叠在设置弹窗上，取消仅关本层）、`.chip.on` 样式。文档四同步：测试用例（TC-BAK-001 修订+TC-BAK-007~010+变更记录）、PRD v1.29（6.8）、技术方案 v1.7（IPC 一览）、PROJECT_MAP 速查表。验证：cargo 65 passed（+1 dump_range）、clippy 0、fmt 0、vitest 89 passed（+3）、tsc/build 通过、tauri dev 起窗正常；用户手测 TC-BAK-007~010 通过。

**2026-10-11 导出备份优化原型已出（v1.29 方向，范围语义用户已确认；弹窗层级 bug 已修，待最终确认后开发）**：仅改 `doc/原型.html`（浏览器已自查）。两段式导出：①点「导出备份」先弹「导出范围」弹窗——默认当前自然月，快捷 本月/上个月/上上个月/全部（高亮选中），自定义开始/结束日期（分段输入，手动改即取消快捷高亮，「全部」时日期区禁用置灰）②「选择位置并导出」→ 正式版弹另存为（**默认桌面**）再导出。范围语义（用户已确认）：日历=与范围交集即含（显示自身完整起止）、待办=截止日期在范围内、未设截止仅「全部」包含；分类与字段定义始终全量随包。**弹窗基座改叠加式**（用户反馈 bug：范围弹窗取消连设置弹窗一起关了）：`modal()` 由覆盖改 append 叠层、`closeModal()` 只移除最顶层（设置上开范围/模板/TXT 弹窗取消后设置保留）；`renderSettings` 用 `key='settings'` 同 key 替换防重渲染叠加；子弹窗内 `initSegs` 改绑 `lastDialog()`。浏览器实测 7 场景全过（范围/TXT/模板取消→设置保留；模板保存/日期类型点格/字段管理点可见→单层；事项弹窗独立开关；segs 输入跳段正常）。**已开发完成（见上条）。**

**2026-10-07 v0.3.17 已打包（指令「打包」完成；本地已提交、未推送、未建 Release）**：随本版内容——PRD v1.28 四项（分类拖拽排序/打卡项拖拽排序/字段管理入设置弹窗/可见列对齐），用户手测通过（「没问题」）。本地提交 `219718a`（feat 功能+文档）+ `304a5df`（chore 版本与 CHANGELOG）+ Cargo.lock 联动；版本号三处升 0.3.17。**新建** `release\日历待办工具 v0.3.17\`（exe 7.9MB+使用说明，从 v0.3.16 原样复制使用说明）；临时目录启动验证通过（窗口正常、data 自动生成、migrations 1~5、种子分类 sort 0/1/2/3+未分类 1000 沉底）后清理；**v0.3.16 目录及生产 data\ 原地未动**（已核对）。备注：release exe 进程名/窗口标题为中文「日历待办工具」，Git Bash `tasklist | grep calendar` 检测不到（GBK 编码），用 PowerShell 按 Path 查。**等指令 B「推送」（本地领先远程 5 个提交）/ 指令 C「发布 v0.3.17」**。

**2026-10-07 v1.28 四项已开发完成（原型用户已确认；代码完成待用户手测，未提交）**：①左侧事项类型拖拽排序（TabBar 整行可拖、总览/未分类固定；`reorder_categories` IPC+`UndoCmd::CategorySort`；各入口所属分类下拉读 store.categories 顺序自动同步）②打卡项拖拽排序（HabitPanel ⠿ 手柄；`reorder_habits` IPC+`UndoCmd::HabitSort`；打卡视图/各下拉按 list 序自动同步）③字段管理入口移入设置弹窗页签（`FieldPanel.tsx` 替代 `FieldManager.tsx` 弹窗，日期类型下方/打卡项上方；工具栏按钮删除）④字段管理可见列硬对齐（fname min-width:0、fm-vis 缩进对齐字段名）。共享层：`features/dnd/reorder.ts`（纯函数+7 vitest）+`useListDrag.ts` hook；两类重排 IPC 均全量顺序整批事务提交（集合完整性/去重/存在性校验，整批回滚），撤销=sort 快照（对齐 FieldSort 模式），未动 schema（复用 sort_order 列）。文档四同步：测试用例（TC-CL-011/012、TC-CK-022、TC-FLD-020/021、TC-UNDO-011+变更记录）、PRD v1.28、技术方案 v1.6（IPC 一览补 habits 组/两类 reorder）、PROJECT_MAP（状态行/目录树/速查表）。验证：cargo 64 passed（+3：habits/categories reorder、undo sort）、clippy 0、fmt 0、vitest 86 passed（+7）、tsc/build 通过。**已随 v0.3.17 打包，用户手测通过。**

**2026-10-07 四项 UI 修订原型已出（PRD v1.28 方向，用户已确认进入开发）**：仅改 `doc/原型.html`（浏览器已自查，未动代码/PRD/用例）。①设置-打卡项 ⠿ 手柄拖拽排序（`habitSortedList` 重排 sort；打卡视图筛选行/全部页/事项弹窗与添加打卡的打卡项下拉同步顺序）②字段管理「可见」列硬对齐（ftype/fopt/op 补 `flex:none`、fname 补 `min-width:0`+省略、展开勾选区 `fm-vis` 缩进 26px→与字段名对齐 6px）③字段管理入口从工具栏移入设置弹窗页签（日期类型下方、打卡项上方；`renderFm`→`fieldsBody`，`settingsTabSwitch('fields')` 复位编辑态；工具栏按钮删除；字段区空提示文案同步「设置→字段管理」）④左侧事项类型整行拖拽排序（仅普通分类，总览/未分类固定；重排 `state.categories` 数组序，各入口所属分类下拉/勾选顺序自动同步，未分类保持沉底）。验证方式：python http.server 起本地服务 + 浏览器派发 DragEvent 事件链实测（拖拽排序/插入指示线/视图与下拉同步均通过）。

**2026-10-05 v0.3.16 已发布（指令 A+B+C 全部完成）**：推送 `0778169..c6ee7fe`（13 个提交，main 与远程同步）；GitHub Release **v0.3.16（便携绿色版）** 已上线（正式非 draft，tag v0.3.16 指向 main），附件 `CalmDownandDoToDo-v0.3.16.zip`（仅 exe+使用说明，3.0MB，下载地址已验证）；notes 涵盖 v0.3.8 之后全部更新（打卡功能为主）。随本版内容——PRD v1.27 四项 UI 修订（设置弹窗加宽+按钮横排、默认近1月、热力带 flex-wrap 自适应换行、字段管理对齐去「· 」）。正式目录 `release\日历待办工具 v0.3.16\`。发布方式备忘：本机无 gh CLI，用 git credential 取 token 走 GitHub REST API；Release notes JSON 必须用 python 生成（bash heredoc 会把 `\\` 折叠成 `\` 造成非法 JSON）。

**2026-10-05 文档一致性审计与修复（用户要求检查自相矛盾）**：修复 7 处——①README 版本行 v0.3.10→v0.3.16、功能特性补打卡与列表增强（描述列/默认一个月内/多选批量删除）、删重复的「拖拽转待办」条目②技术方案数据字典补 schema v4/v5（habits 表含 template_json、items.is_checkin/habit_id、idx_items_habit）+修订记录 v1.5（此前停留在 v3，打卡表结构完全缺失）③PROJECT_MAP 状态行更至 v0.3.16 已发布、habits.rs 补 set_template、TC-CK 用例号 015→021④PRD 补「默认近 1 月（v1.27）」与「添加打卡按模板带出（无模板回落打卡项名/未分类）」消除与 6.11 模板段的矛盾。测试用例/CHANGELOG/原型/开发批次计划检查无矛盾。

**2026-10-05 v1.27 四项已提交（d90747d，用户手测通过）**：①设置弹窗 560→620+按钮防压缩②默认近1月③热力带 flex-wrap 自适应（bandRows+3 单测删除）④字段管理 vis-tag 定宽 110px+描述去「· 」。TC-CK-021 修订、PRD v1.27；vitest 79/tsc/build 全绿。

**2026-10-05 v1.26 四项改动已提交（12af7c4，用户手测通过）**：①滚轮翻页修复（视图切换后监听重绑）②模板带出仅补空（编辑不覆盖分类/标题/已有值字段；含值加载竞态兜底）③设置-打卡项新增行=名称+关联分类下拉，默认色=分类色④全部总览近6月/近1年热力带按三个月换行（heatmap.bandRows+3 vitest）。原型同步验证通过；TC-CK-019~021 新增；PRD v1.26。vitest 82/tsc/build 全绿。

**2026-10-05 v0.3.14 已打包（指令 A 完成；本地已提交、未推送、未建 Release）**：随本版内容——打卡功能全量（PRD v1.25：双身份/归属日期/热力图/三入口创建 + ③打卡项模板带出）+ 打卡项页签手测两修复（新增按钮右对齐、分类下拉 220px 截断）。正式目录**新建** `release\日历待办工具 v0.3.14\`（exe+使用说明；v0.3.13 目录及生产 data 原地未动，核对一致；临时目录启动验证通过后清理）。**等指令 B「推送」（本地领先远程 9 个提交）/ 指令 C「发布 v0.3.14」**。

**2026-10-05 打卡功能+模板已提交（f68e38a，用户手测通过）**：schema v4/v5（habits 表+template_json）、打卡视图（CheckinView 热力带+聚焦大图+tooltip）、三处模板带出（添加打卡/事项弹窗/今天打卡）、设置「打卡项」页签（增删改名/色盘/模板）、全部写操作可撤销；两轮手测修复（原型多选收集与日期拆分、正式版新增行布局与下拉截断）。cargo 61/clippy 0/fmt、vitest 79/build 全绿。

**2026-09-30 v0.3.13 已打包（指令 A 完成；本地已提交、未推送、未建 Release）**：随本版内容——事项弹窗所属分类下拉带色点（v1.24，用户手测通过）。正式目录重命名 `release\日历待办工具 v0.3.13\`（生产 data\ 原地未动，前后核对一致；临时目录启动验证通过后清理）。**等指令 B「推送」（本地领先远程）/ 指令 C「发布 v0.3.13」**。

**2026-09-29 事项弹窗分类下拉带色点已完成（PRD v1.24；用户手测通过；已提交 f31fda6）**：「所属分类」由原生 select 改自定义下拉——闭合态=当前分类色点+名称、展开项=色点+名称（与左侧分类列表一致）、未分类沉底、点外收起、切分类刷新字段区不变。新增 `CatSelect.tsx`。

**2026-09-28 v0.3.12 已打包（指令 A 完成；本地已提交、未推送、未建 Release）**：随本版内容——列表视图默认一个月内+待办时间线去标签（v1.22）、列表多选批量删除（v1.23，一步撤销）、撤销后列表刷新修复（用户手测通过）。正式目录重命名 `release\日历待办工具 v0.3.12\`（生产 data\ 原地未动，前后核对一致；临时目录启动验证通过后清理）。**等指令 B「推送」（本地领先远程）/ 指令 C「发布 v0.3.12」**。

**2026-09-28 列表视图多选+批量删除已完成（PRD v1.23；用户手测通过，含撤销刷新修复）**：行首复选框多选（表头全选/半选态）→「删除所选 (N)」二态确认 → 批量删除；**一步撤销**恢复全部（新增 `UndoCmd::ItemDeleteBatch` + `delete_items_batch` IPC + 单测）。原型/用例/PRD/前后端代码同步；cargo 56、clippy/fmt 0、vitest 68、build 通过。

**2026-09-27 列表默认一个月内 + 待办时间线去标签已完成（PRD v1.22；待用户手测 TC-CAL-021/TC-DUE-010；未打包未提交）**：①列表视图范围默认「一个月内」（每次进入生效、重置恢复）②待办时间线去「今天 MM/DD」标签只留红色虚线。原型/用例/PRD/代码四同步；vitest 68、tsc+build 通过。**用户已确认：与后续改动攒一批，随下版打包（不重打 v0.3.11）**。

**2026-09-27 v0.3.11 已打包（指令 A 完成；本地已提交、未推送、未建 Release）**：随本版内容——列表视图新增「描述」列（PRD v1.21，标题右侧/限宽省略/悬停全文/未填 —）。正式目录重命名 `release\日历待办工具 v0.3.11\`（生产 data\ 原地未动，前后核对一致；临时目录启动验证通过后清理）。**等指令 B「推送」/ 指令 C「发布 v0.3.11」**。

**2026-09-27 列表视图新增「描述」列已完成（PRD v1.21；TC-CAL-020 期望已随版更新，用户可继续在 v0.3.11 实测）**：描述列位于**标题列右侧**（归属列前，初版在截止列后、按用户反馈调整），限宽 220px 单行省略截断、悬停 tooltip 看全文、未填显示「—」。执行顺序：原型（浏览器已验证）→ 测试用例 TC-CAL-020 修订 → PRD 6.10 v1.21 → `ListView.tsx`+`global.css`；vitest 68 passed、tsc+vite build、cargo 55 passed。

**2026-09-19 v0.3.9 已打包（指令 A 完成；本地未推送、未建 Release）**：随本版内容——日期类型入口移入设置 + 列表视图 + 列表样式/id 修复（PRD v1.18）。正式目录 `release\日历待办工具 v0.3.9\`（生产 data 原地未动，临时目录验证通过）。**等指令 B「推送」（领先远程 6 个提交）/ 指令 C「发布 v0.3.9」**。

**2026-09-19 v0.3.10 已打包（指令 A 完成+归属列修复重打；本地未推送、未建 Release）**：随本版内容——日期类型入口移入设置 + 列表视图完整版 + 分段日期回显修复（PRD v1.18/v1.19/v1.20）。正式目录 `release\日历待办工具 v0.3.10\`（生产 data 原地未动，临时目录验证通过）。**等指令 B「推送」（领先远程 23 个提交）/ 指令 C「发布 v0.3.10」**。

**2026-09-19 日期类型移入设置 + 列表视图已实现（待用户手测 TC-DT-007、TC-CAL-019/020；本地 commit 未 push）**：①设置弹窗加「日期类型」页签（工具栏按钮移除，DayTypePanel 自包含）②列表视图（周/月/列表三态；冻结列/动态字段列/分组/点击编辑/滚轮排除）。PRD v1.18 已同步。cargo 55、vitest 68、build、clippy/fmt 0。

**2026-09-19 文档一致性检查与修复（commit 已入本地）**：技术方案数据字典更新至 schema v3（field_defs 新结构 + category_fields 表 + 行为说明）+ 修订记录 v1.4 + 决策 D13/D14；PRD 6.5 入口修正（所有页面可用）+ 可见性操作补充；README 版本行/功能特性同步至 v0.3.8（色条/时间线/TXT 导出/字段全局化/分段输入等）；PROJECT_MAP schema.rs 行补 v3。**遗留建议**：`release\…v0.3.8\使用说明.txt` 的备份节未提 TXT 导出（用户自维护文档，待用户决定是否补充）。

**2026-09-19 v0.3.8 已发布（指令 A+B+C 完成；已推送、Release 已上线）**：随本版内容——自定义字段全局化+分类可见性（schema v3）、日期/时刻分段输入、分类下拉排序（PRD v1.17）。正式目录 `release\日历待办工具 v0.3.8\`。**schema v3 存量迁移已实测**（临时目录+生产 data 副本：110 条事项/50 行字段值零丢失，可见性正确迁移）。**等指令 B「推送」（领先远程 24 个提交）/ 指令 C「发布 v0.3.8」**。

**2026-09-19 v0.3.7 已打包（指令 A 完成；未推送、未建 Release）**：日历类型每天色条 + 今日按类型染色 + 拖拽转待办（PRD v1.16）。正式目录 `release\日历待办工具 v0.3.7\`（生产 data 原地未动）。

**2026-09-17 v0.3.6 已打包（指令 A 完成；本地未推送、未建 Release）**：随本版内容——待办当前时间线 + 导出 TXT 快捷范围 + 修复范围弹窗日期框点击（PRD v1.15）。正式目录 `release\日历待办工具 v0.3.6\`（生产 data 原地未动，临时目录验证通过）。

**2026-09-16 v0.3.5 已打包（指令 A 完成；未推送、未建 Release）**：TXT 导出（PRD v1.14 / TC-EXP）随本版。正式目录 `release\日历待办工具 v0.3.5\`（生产 data 原地未动，临时目录验证通过）。

**2026-09-16 v0.3.4 已发布（GitHub Release 已上线）**：标题框拉宽（补 type 属性，与描述区同宽）。正式目录 `release\日历待办工具 v0.3.4\`（生产 data 原地未动）；Release 附件 `CalmDownandDoToDo-v0.3.4.zip`（仅 exe+使用说明）。

**2026-09-15 已发布到 GitHub**：仓库 https://github.com/hshyq/CalmDownandDoToDo （MIT License），main 已推送并跟踪。共 77 个跟踪文件（含 LICENSE）。**版本发布流程（2026-09-16 用户立规）**：升版本号 → tauri build → 更新正式目录 → 临时目录验证 → 本地 commit 后**停下等用户验证**；用户说「推送」才 push；说「发布」才建 Release（英文 zip 名，仅 exe+使用说明）。`tauri dev` 若报旧路径错误，清 `target\debug\build` 与 `.fingerprint`。

**2026-09-15 项目定名**：**CalmDownandDoToDo**（无连字符；对外 GitHub 仓库名/README 标题 + 口号「先冷静，再一件件做完」；exe 与窗口标题保持「日历待办工具」）。README/AGENTS/CHANGELOG 已同步。GitHub 查重无同名。

**2026-09-15 仓库精简（commit f21d27e + 后续，跟踪文件 132 → 76）**：`gen/schemas/`（构建自生成）加入 .gitignore 并移出跟踪；删除 android/ios 移动端图标与 17 个冗余桌面图标（Square\*Logo=UWP 商店、icon.icns=macOS、多尺寸 png=Linux/移动 bundle，bundle.active=false 全部零引用）；桌面图标仅保留 `icon.ico`（tauri-build 隐式用作 exe 资源图标）。tauri build 验证通过、exe 正常产出。

**2026-09-14 仓库精简（commit f21d27e，跟踪文件 132 → 93）**：`gen/schemas/`（构建自生成）加入 .gitignore 并移出跟踪；删除 android/ios 移动端图标 40 个（本项目仅 Windows 桌面，bundle.active=false 全部零引用）；tauri build 验证通过。桌面图标保留 18 个（icon.ico 为 exe 资源图标隐式必需；Square*Logo/icns/png 系列零引用，是否进一步精简待用户决定）。

**2026-09-14 发布到仓库准备检查（commit 1a20984）**：
- 仓库跟踪文件检查：132 个文件全部为源码/文档/配置，无产物、二进制、临时文件混入；源码无硬编码盘符路径（红线 6 合规）
- 文档一致性修正：README 从 v0.2.0 同步至 v0.3.3（版本行 + 功能特性补日期类型/滚轮/墨刀色盘/点外关闭 + 导航补开发批次计划）；测试用例规则变更记录补 TC-IT-014/015 留痕；PROJECT_MAP 目录树补 `src/test/smoke.test.ts`
- .gitignore 补充系统文件与日志（Thumbs.db/Desktop.ini/.DS_Store/*.log）；其余范围已恰当（data/dist/target/release/node_modules 均排除，Cargo.lock 与 package-lock.json 正常入库）
- target 残留已清理（用户确认）：`src-tauri\target\release\日历待办工具 v0.2.0\` 旧便携副本与 `src-tauri\target\release\data\` 历史测试库已删除；生产数据 `release\日历待办工具 v0.3.3\data\` 完好

**2026-09-14 v0.3.3 已发布到正式目录**（`release\日历待办工具 v0.3.3\`，生产 data 原地未动）：
- 内容：**事项弹窗点外关闭**（点弹窗外·窗口内=关闭不保存；点窗口外=行为不变；仅事项弹窗生效，删除确认点外退回编辑；TC-IT-014/015 用户手测通过，commit d30d62d）
- 打包：版本号 0.3.2 → 0.3.3；目录重命名 + 替换 exe/使用说明；临时目录启动验证通过后清理
- **待用户手测**：实际使用中感受点外关闭手感（误关频度），如需加防误触延迟再说

**2026-09-14 v0.3.2 已发布到正式目录**（`release\日历待办工具 v0.3.2\` 已重命名为 v0.3.3，生产 data 原地未动）：
- 内容：事项弹窗「描述」输入区 2 行 → 5 行（`ItemModal` rows=5；原型同步；commit bb3da36）
- 打包：版本号 0.3.1 → 0.3.2；目录重命名 + 替换 exe/使用说明；临时目录启动验证通过（data 自动生成、进程存活）；`target\` 旧路径构建缓存已清（项目移动遗留）
- **待用户手测**：事项弹窗描述区高度

**一期完成 · v0.1.0 发布（2026-09-04，P0~P9 全部验收通过并提交）**。业务开发按 `doc/开发批次计划.md` 已完成一期全部批次；二期另行推进。

**2026-09-05 功能增强（PRD v1.8）已完成并验收**：①日历格「+」新增预填开始+结束日期 ②横条拖拽平移改期 ③待办拖入日历 ④补齐格「+」入口。文档基线：PRD v1.8 / 测试用例 88 条。

**2026-09-08 v0.3.1 已发布到正式目录（当前）**（`release\日历待办工具 v0.3.1\`，生产 data 原地未动、83 条事项）：
- v0.3.0 内容：**日期类型**（班/休/假角标，PRD v1.12 / TC-DT-001~006，方案经用户确认，schema 迁移 v2 已验证）+ 横条头尾拖拽（TC-CAL-018）+ 待办日数字（TC-DUE-009）+ 总览页新增（v0.2.2）
- v0.3.1 内容：**滚轮切换上/下周期**（PRD v1.13 / TC-CAL-019）
- 历史批次：v0.2.1（工具栏顺序/年月面板/墨刀色盘/字色自适应/时间控件 showPicker）、v0.2.2（总览开放新增）
- **待用户手测**：TC-DT-001~006、TC-CAL-018/019、TC-DUE-009、TC-CL-010、TC-IT-013

## 已完成

- [x] **2026-09-08 v0.2.1 交互与色盘修订（PRD v1.9，测试用例 91 条，commit 5dcf3d0 + 打包提交）**：
  - 分类色盘墨刀化：`palette.ts` 重写（截图实测色值/标准行第 3 行/`textColorOn`/HSV 转换，vitest +5）、`ColorPicker.tsx` 重写（色板+SV 面板+色相条+HEX 联动）
  - 字色自适应（横条/待办条目按背景亮度切深字白字）；原型契约补齐（周视图标题区间、总览「不可新增」tag、时间控件隐藏图标+showPicker）
  - 原型同步（色板数据/SV 取色弹窗/字色）；PRD v1.9、测试用例 91 条、PROJECT_MAP/CHANGELOG 已刷新
  - 验证：cargo 47、vitest 36、build 通过；v0.2.1 exe 临时目录启动验证通过后交付

- [x] **2026-09-05 拖拽改期与快捷入口增强（用户验收通过；commit 0c057f2）**：
  - `features/calendar/drag.ts` 纯函数（shiftRange 平移 / todoDropDates 待办拖入 / BAR_MIME·TODO_MIME 来源区分）+ 6 vitest
  - `CalendarView`：横条 draggable、daycell dragover/drop 与落格高亮、补齐格「+」；`ItemModal`「+」新增预填开始=结束=格日期；`TodoPanel` 条目 draggable
  - 写库走 `update_item`（撤销可回退；fieldValues 不传保留旧值；原地放下不写库）
  - `tauri.conf.json` `dragDropEnabled:false`（Windows 系统级拖放监听会禁用 WebView 内 HTML5 拖拽）
  - 同步 `doc/原型.html`（预填/补齐格/拖拽演示，script 语法冒烟通过）；PRD v1.8、测试用例 88 条、PROJECT_MAP、CHANGELOG 已刷新
  - 验证：cargo 47 passed、vitest 31 passed、build 通过；**用户手测 TC-IT-012、TC-CAL-013~015 通过**

- [x] 产品方案与技术方案讨论定稿（一期 18 条需求细化、二期邮箱方案改 SMTP 直发）
- [x] 《Vibe Coding 项目文档标准化指南》更新：纳入测试用例/原型两份文档（外部文件，仅更新一次）
- [x] `doc/PRD.md`（v1.6，2026-09-02 设计评审修订 + 快捷入口 v1.5/v1.6）
- [x] `doc/技术方案.md`（v1.2，含数据字典与决策记录 D1~D12）
- [x] `doc/测试用例.md`（85 条用例 + 回归最小集 17 条）
- [x] `AGENTS.md`（AI 宪法，9 节）
- [x] `PROJECT_MAP.md`（实施蓝图 + 「改哪里」速查表）
- [x] 目录骨架：`src/`、`src-tauri/`、`doc/`
- [x] `doc/原型.html`（UI 交互原型，**2026-09-02 经用户确认**；核心布局算法已冒烟验证）
- [x] 2026-09-02 设计评审修订：PRD v1.4 / 技术方案 v1.2 / 测试用例 83 条；新决策 D9 单实例、D10 撤销快照落盘且剔除授权码、D11 WebView2 Fixed Version 捆绑免预装、D12 zustand 确认；git 初始化经用户指示暂缓（见「下一步」）
- [x] 原型迭代（评审走查）：layoutWeek 与 +N 浮层排序按开始时间对齐 A2 规则；日历格 hover「+」快捷新建入口（PRD 6.3 v1.5 / TC-IT-012）
- [x] 原型迭代（走查反馈）：日历格快捷入口扩展至总览页——总览新增弹窗带所属分类下拉（默认第一分类），分类/未分类页不显示该字段（PRD 6.3 v1.6 / TC-CL-007、TC-IT-012 修订）
- [x] `doc/开发批次计划.md` 落档：P0~P9 批次范围/验收/交接约定（2026-09-02）
- [x] **P0 工程初始化完成**（2026-09-02）：骨架/IPC ping/图标配置就位；三绿+clippy+fmt；tauri dev 起窗；pong 已人工确认；git init + 首次提交 `2588e7b`

## 下一步（按批次推进，范围/验收见 `doc/开发批次计划.md`）

- [x] **P0 工程初始化**：Tauri 2 + React 18 + TS + vitest + zustand（D12）；`.gitignore` 就位；IPC ping 打通。验收：三绿 + clippy/fmt + `tauri dev` 起窗（pong 待人工确认）
- [x] **P0 收口动作**：`git init -b main` + 首次提交 `2588e7b chore: P0 工程初始化…`（2026-09-02，经用户批准）；`.gitignore` 已含 `data\`、`node_modules\`、`dist\`、`src-tauri\target\`、`.zcode\`
- [ ] `webview2\` 固定版运行时捆绑（D11）：在 P9 打包阶段落实
- [x] **P1 数据层完成**（2026-09-03）：schema_migrations 幂等迁移（v1 建 6 表+3 索引+items.created_at）；Db(Mutex) open/迁移；list_calendar_items（窗口交集）/list_todo_items（COALESCE 沉底）查询；validation 校验；`cargo test` 12 passed、clippy 零警告
- [x] **P2 分类模块完成**（2026-09-03）：后端 store::categories + commands::categories（18 测试/clippy 0）；前端 TabBar/色盘/删除二选一（vitest 5/build/tauri dev 正常）。**手测 TC-CL-001~009 通过**；删除「移入未分类」语义按决策 A 落档（PRD v1.7 / TC-CL-005 / 技术方案 3.1）
- [x] **P3 事项模块完成**（2026-09-03）：后端 store::items + commands::items（21 测试/clippy 0）；前端 ItemModal/ItemsView（vitest 5/build/tauri dev 正常）。**手测 TC-IT-001~012 通过**；提交 3238635
- [x] **P4 日历视图完成**（2026-09-03）：list_calendar_items IPC；dates/layout 纯函数+10 vitest；CalendarView 周月/补齐/今日/横条泳道跨格/+N/格内「+」预填/总览选分类。**手测 TC-CAL-001~012 通过**；提交 b2e377a
- [x] **P5 待办视图完成**（2026-09-03）：list_todo_items IPC；group 分组纯函数（17 vitest）；TodoPanel 时间轴/折叠/虚拟滚动/色块；dataVersion 跨面板刷新。**手测 TC-DUE-001~008 / TC-FLD-014 通过**；修复 .todo-pane 宽度塌缩（align-items 覆盖）并补贯穿竖线；提交 d0ab2be
- [x] **P6 自定义字段·后端完成**（2026-09-03）：store/fieldconvert（FieldType/JSON 编解码/矩阵 convert_value+7 穷举测试）、store/fields（CRUD/set_options 过滤/change_type 迁移/move_field +6 测试）、store/values（set/list）；commands/fields（8 IPC）+ items draft fieldValues；34 cargo tests、clippy 0；提交 1d0cbe7
- [x] **P6 前端·代码完成**（2026-09-04，待手测 TC-FLD-001~017）：字段管理弹窗（增删改名/改类型确认/选项维护/排序）、ItemModal 六类型字段区（值加载/保存合并、切分类按模板过滤展示、PRD 4.3）、types/ipc 扩展与 fieldApi、FieldEditor 控件、features/fields 值编解码纯函数（+8 vitest）；vitest 25/build 通过/tauri dev 起窗正常。mock 未扩展字段（预览非验收路径，视图直连真实 IPC）
- [x] **P6 前端验收通过并提交**（2026-09-04，用户手测 TC-FLD-001~017 通过）：修复字段值载荷命名（FieldValuePayload 后端 serde camelCase → fieldDefId）；commit 0d88ab7
- [x] **P7 撤销/重做+进程完成并提交**（2026-09-04，用户验收通过；commit a9a8003）：
  - [x] store::snapshot 快照/恢复原语 + undo 双栈（上限 10、重启清空）+ 命令枚举（+9 cargo 测试，共 43）
  - [x] commands 全部写操作入栈（分类/事项/字段增删改、级联删除、排序）+ 字段复合 save_field（一次保存=一步撤销）+ undo/redo/depth IPC + undo-depth 事件
  - [x] 前端：undoStore 按钮态/事件监听、工具栏 ↶↷ 按钮、Ctrl+Z/Y 快捷键（输入框内不触发）、撤销后跨面板刷新
  - [x] D11 WebView2 固定版检测：exe 同目录 webview2\ 存在则设 WEBVIEW2_BROWSER_EXECUTABLE_FOLDER（打包部分 P9 落实）
  - [x] D9 单实例互斥：经用户确认引入官方 tauri-plugin-single-instance v2.4.4；第二实例自动退出并聚焦已有窗口；commit a9a8003
- [x] **P8 备份完成并提交**（2026-09-04，用户验收通过；commit 9c09fd0）：store/backup.rs、undo Import（D10 落盘）、commands default_backup_path/export/import、⚙ 设置弹窗经官方 tauri-plugin-dialog 选目录/文件（应验收反馈调整）
- [x] **P9 一期收尾完成并提交**（2026-09-04，用户回归最小集验收通过；commit e0172a6）：
  - [x] TC-BAK-005 启动只读目录提示（dialog）；README 正式版；release exe 便携目录（target\release\日历待办工具 v0.1.0\，双击验证通过）；CHANGELOG/PROJECT_MAP/TODO 终态
  - [ ] 用户最终回归最小集 17 条通过 → 提交 P9 → 一期发布
- [x] **v0.2.0 发布完成**（2026-09-05）：版本号三处升 0.2.0；便携目录 `src-tauri\target\release\日历待办工具 v0.2.0\`（exe+README+使用说明.txt，含拖拽说明与升级指引）；临时目录启动验证通过（窗口正常、calendar.db 生成、单实例拦截生效），验证环境已清理；**v0.1.0 目录及 data\ 未触碰**
- [ ] 用户切换到 v0.2.0 便携目录（拷贝旧 data\ 或仅替换 exe）
- [ ] 二期（另行推进）：托盘常驻、提醒设置、SMTP 直发、同步与过期汇总弹窗

## 给下次对话的提醒

- **用户正式使用目录（2026-09-08 迁移，当前 v0.3.1）**：`release\日历待办工具 v0.3.1\`（项目根下 release\ 目录，生产数据 data\，82 条事项；.gitignore 已排除 release\）。**今后发新版：新版本目录放 `release\` 下，或仅把新 exe 交付用户替换**；`src-tauri\target\release\` 下的 v0.1.0/v0.2.0 目录均为旧副本（v0.1.0 data 是过期快照），清理须用户确认。
- 文档基线：**PRD v1.8 / 技术方案 v1.3 / 测试用例 88 条（回归最小集 17 条）**；技术方案 v1.5/v1.6 为纯 UI 交互变更（未升架构版），v1.3 为 P1 数据字典补全；业务规则唯一权威是 PRD 第 5 章。
- **拖拽前提**：`tauri.conf.json` 窗口 `dragDropEnabled:false` 必须保留，否则 WebView 内 HTML5 拖拽在 Windows 上失效。
- 每批开工先读 `doc/开发批次计划.md` 对应批次；批次收口按「批次完成定义」执行（含刷新本文件与 CHANGELOG）。
- 改业务规则先改测试用例再改码；宣称完成前跑回归最小集（AGENTS 第 9 节）。
- **便携版 data 是生产数据**（用户以便携版正式使用并手动维护）：重打包/验证 exe 严禁删除或污染便携目录 data\（铁律见 AGENTS 第 7 节）。


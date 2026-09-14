# TODO.md — 进度便签

> 用法：新对话先读 `AGENTS.md`，再扫一眼本文件了解进度；结束对话前必须刷新本文件（记录当前进度与下一步）。

## 当前阶段

**2026-09-15 已发布到 GitHub（当前）**：仓库 https://github.com/hshyq/CalmDownandDoToDo （MIT License），main 分支已推送并建立跟踪；共 77 个跟踪文件（含 LICENSE）。**下一步（可选）**：GitHub Release 页上传 v0.3.3 exe 附件（仓库不含 exe，release\ 目录被 gitignore）；后续版本发布后记得 push。

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


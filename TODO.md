# TODO.md — 进度便签

> 用法：新对话先读 `AGENTS.md`，再扫一眼本文件了解进度；结束对话前必须刷新本文件（记录当前进度与下一步）。

## 当前阶段

**开发阶段 · P7 撤销/重做与进程（代码完成：撤销部分用户验收通过；D9 单实例已实现并自动验证，TC-ENV-001 待双击手测确认）**

## 已完成

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
- [x] **P7 撤销/重做+进程完成**（2026-09-04；撤销部分用户验收通过，D9/D11 实现完毕）：
  - [x] store::snapshot 快照/恢复原语 + undo 双栈（上限 10、重启清空）+ 命令枚举（+9 cargo 测试，共 43）
  - [x] commands 全部写操作入栈（分类/事项/字段增删改、级联删除、排序）+ 字段复合 save_field（一次保存=一步撤销）+ undo/redo/depth IPC + undo-depth 事件
  - [x] 前端：undoStore 按钮态/事件监听、工具栏 ↶↷ 按钮、Ctrl+Z/Y 快捷键（输入框内不触发）、撤销后跨面板刷新
  - [x] D11 WebView2 固定版检测：exe 同目录 webview2\ 存在则设 WEBVIEW2_BROWSER_EXECUTABLE_FOLDER（打包部分 P9 落实）
  - [x] D9 单实例互斥：经用户确认引入官方 tauri-plugin-single-instance v2.4.4；第二实例自动退出并聚焦已有窗口（自动验证拦截生效）；TC-ENV-001 待用户双击手测
- [ ] **P8 备份**：导出导入/语义校验/二次确认/导入快照(D10)（TC-BAK）
- [ ] **P9 一期收尾**：回归最小集 17 条/全量测试/便携打包/README/文档刷新（DoD）
- [ ] 二期（另行推进）：托盘常驻、提醒设置、SMTP 直发、同步与过期汇总弹窗

## 给下次对话的提醒

- 文档基线：**PRD v1.6 / 技术方案 v1.3 / 测试用例 85 条（回归最小集 17 条）**；技术方案 v1.5/v1.6 为纯 UI 交互变更（未升架构版），v1.3 为 P1 数据字典补全；业务规则唯一权威是 PRD 第 5 章。
- 每批开工先读 `doc/开发批次计划.md` 对应批次；批次收口按「批次完成定义」执行（含刷新本文件与 CHANGELOG）。
- 改业务规则先改测试用例再改码；宣称完成前跑回归最小集（AGENTS 第 9 节）。

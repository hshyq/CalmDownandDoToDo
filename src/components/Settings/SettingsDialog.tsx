// 设置弹窗（P8：数据备份面板；二期 tab 置灰）。对齐原型「设置 → 数据备份」界面。
// 导出/导入经官方 tauri-plugin-dialog（用户自选目录/文件）。
// P10：TXT 导出（PRD 6.9）——范围弹窗默认当前月首~下月末，结束上限=开始+6 个月−1 天。
import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import Modal from "../Modal/Modal";
import { backupApi, txtExportApi } from "../../services/ipc";
import { backupQuickRange, defaultExportRange, maxEndDate, shortcutRange } from "../../features/export/dates";
import type { BackupQuickUnit, ShortcutUnit } from "../../features/export/dates";
import { SegDateInput } from "../fields/SegInputs";
import DayTypePanel from "../Calendar/DayTypePanel";
import FieldPanel from "../fields/FieldPanel";
import HabitPanel from "./HabitPanel";
import { useAppStore } from "../../stores/appStore";

interface Props {
  onClose: () => void;
}

type Tab = "backup" | "daytypes" | "fields" | "habits" | "mail" | "records";
/** 备份导出范围选择状态（v1.29 两段式导出）：快捷项或 custom（手动改过日期）。 */
type BkQuick = BackupQuickUnit | "all" | "custom";

const JSON_FILTER = [{ name: "JSON 备份", extensions: ["json"] }];
const TXT_FILTER = [{ name: "文本文件", extensions: ["txt"] }];

const BK_QUICK_OPTIONS: ReadonlyArray<{ unit: BackupQuickUnit | "all"; label: string }> = [
  { unit: "this", label: "本月" },
  { unit: "prev", label: "上个月" },
  { unit: "prev2", label: "上上个月" },
  { unit: "all", label: "全部" },
];

/** 本地今天（yyyy-MM-dd）。 */
const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function SettingsDialog({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("backup");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [importPath, setImportPath] = useState<string | null>(null);
  const [confirmPath, setConfirmPath] = useState<string | null>(null);
  // TXT 导出范围弹窗（PRD 6.9）
  const [txtOpen, setTxtOpen] = useState(false);
  // 备份导出范围弹窗（v1.29 两段式：先范围后另存为）
  const [bkOpen, setBkOpen] = useState(false);
  const [bkQuick, setBkQuick] = useState<BkQuick>("this");
  const [bkStart, setBkStart] = useState("");
  const [bkEnd, setBkEnd] = useState("");
  const [bkErr, setBkErr] = useState("");
  const def = defaultExportRange(todayStr());
  const [txtStart, setTxtStart] = useState(def.start);
  const [txtEnd, setTxtEnd] = useState(def.end);
  const [txtErr, setTxtErr] = useState("");

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 3600);
  };

  /** 打开备份导出范围弹窗（v1.29 两段式第①步）：默认当前自然月。 */
  const openBkDialog = () => {
    const r = backupQuickRange("this", todayStr());
    setBkStart(r.start);
    setBkEnd(r.end);
    setBkQuick("this");
    setBkErr("");
    setBkOpen(true);
  };

  /** 快捷范围点选：填入自然月起止并高亮；「全部」=不过滤。 */
  const applyBkQuick = (unit: BackupQuickUnit | "all") => {
    setBkQuick(unit);
    setBkErr("");
    if (unit === "all") return;
    const r = backupQuickRange(unit, todayStr());
    setBkStart(r.start);
    setBkEnd(r.end);
  };

  /** 手动改日期 → 自定义范围（取消快捷高亮）。 */
  const onBkDate = (which: "start" | "end", v: string) => {
    if (which === "start") setBkStart(v);
    else setBkEnd(v);
    setBkQuick((q) => (q === "all" ? q : "custom"));
    setBkErr("");
  };

  /** 两段式第②步（v1.29）：校验范围 → 另存为（默认桌面）→ 按范围导出。 */
  const doExportBackup = async () => {
    if (bkQuick !== "all") {
      if (bkStart.length !== 10 || bkEnd.length !== 10) {
        setBkErr("请先填完整的开始与结束日期，或选择快捷范围");
        return;
      }
      if (bkEnd < bkStart) {
        setBkErr("结束日期不能早于开始日期");
        return;
      }
    }
    setBkErr("");
    setBusy(true);
    try {
      const defaultPath = await backupApi.defaultPath();
      const path = await save({
        title: "导出备份",
        defaultPath,
        filters: JSON_FILTER,
      });
      if (path === null) {
        showToast("已取消导出");
        return;
      }
      const s = bkQuick === "all" ? undefined : bkStart;
      const e = bkQuick === "all" ? undefined : bkEnd;
      await backupApi.export(path, s, e);
      setBkOpen(false);
      showToast(s ? `已导出 ${s} ~ ${e} 范围备份：${path}` : `已导出全部数据备份：${path}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "导出失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const pickImport = async () => {
    setBusy(true);
    try {
      const path = await open({
        title: "选择备份文件",
        multiple: false,
        directory: false,
        filters: JSON_FILTER,
      });
      if (path === null) {
        showToast("已取消导入");
        return;
      }
      setImportPath(typeof path === "string" ? path : "");
      setConfirmPath(typeof path === "string" ? path : "");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "打开文件失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (confirmPath === null) return;
    setBusy(true);
    try {
      await backupApi.import(confirmPath);
      // 整库已替换：刷新分类/当前列表并 bump，驱动日历/待办重查；撤销按钮态由 undo-depth 事件同步
      const app = useAppStore.getState();
      await app.load();
      await app.loadItems();
      app.bump();
      setConfirmPath(null);
      setImportPath(null);
      showToast("导入完成");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "导入失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  /** 打开 TXT 导出范围弹窗（每次打开重置为默认范围）。 */
  const openTxtDialog = () => {
    const d = defaultExportRange(todayStr());
    setTxtStart(d.start);
    setTxtEnd(d.end);
    setTxtErr("");
    setTxtOpen(true);
  };

  /** 开始日期变化：若结束为空或超出新上限，自动钳到上限（PRD 6.9 半年限制）。 */
  const onTxtStartChange = (v: string) => {
    setTxtStart(v);
    setTxtErr("");
    if (v.length === 10) {
      const max = maxEndDate(v);
      if (!txtEnd || txtEnd > max) setTxtEnd(max);
    }
  };

  /** 快捷范围：开始=今天，结束按单位计算（一周/一月/两月，PRD 6.9 v1.15）。 */
  const applyShortcut = (unit: ShortcutUnit) => {
    const r = shortcutRange(unit, todayStr());
    setTxtStart(r.start);
    setTxtEnd(r.end);
    setTxtErr("");
  };

  /** 确定导出：校验范围 → 另存为 → 后端生成 txt（TC-EXP-002/005/006）。 */
  const doExportTxt = async () => {
    if (txtStart.length !== 10 || txtEnd.length !== 10) {
      setTxtErr("请选择开始与结束日期");
      return;
    }
    if (txtEnd > maxEndDate(txtStart)) {
      setTxtErr(`导出范围不能超过半年：结束日期最晚为 ${maxEndDate(txtStart)}`);
      return;
    }
    if (txtEnd < txtStart) {
      setTxtErr("结束日期不能早于开始日期");
      return;
    }
    setBusy(true);
    try {
      const defaultPath = await txtExportApi.defaultPath(txtStart, txtEnd);
      const path = await save({
        title: "导出 TXT",
        defaultPath,
        filters: TXT_FILTER,
      });
      if (path === null) {
        showToast("已取消导出");
        return;
      }
      const [calN, todoN] = await txtExportApi.exportTxt(path, txtStart, txtEnd);
      setTxtOpen(false);
      showToast(`已导出 ${calN + todoN} 条（日历 ${calN} / 待办 ${todoN}）：${path}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "导出失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const tabBtn = (k: Tab, label: string, badge?: string) => (
    <button
      type="button"
      className={tab === k ? "on" : ""}
      onClick={() => {
        if (badge) {
          showToast("该功能在二期开放");
          return;
        }
        setTab(k);
      }}
    >
      {label}
      {badge ? <span className="badge">{badge}</span> : null}
    </button>
  );

  return (
    <Modal title="设置" onClose={onClose} width={620}>
      <div className="set-wrap">
        <div className="set-tabs">
          {tabBtn("backup", "数据备份")}
          {tabBtn("daytypes", "日期类型")}
          {tabBtn("fields", "字段管理")}
          {tabBtn("habits", "打卡项")}
          {tabBtn("mail", "邮箱绑定", "二期")}
          {tabBtn("records", "提醒发送记录", "二期")}
        </div>
        {tab === "daytypes" ? (
          <DayTypePanel />
        ) : tab === "fields" ? (
          <FieldPanel />
        ) : tab === "habits" ? (
          <HabitPanel />
        ) : (
        <div className="set-body">
          <div className="set-actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={openBkDialog}>
              导出备份
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => void pickImport()}>
              导入备份
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={openTxtDialog}>
              导出 TXT
            </button>
          </div>
          {importPath !== null ? (
            <div className="note picked">已选择：{importPath}</div>
          ) : null}
          <div className="note">
            · 导出前先选择<b>时间范围</b>（默认当前自然月，可快捷选上个月/上上个月/全部，或自定义），确定后选择保存位置（默认桌面）。<br />
            · 范围内事项：日历与范围有交集即含（显示自身完整起止）、待办按截止日期；分类与字段定义始终全量导出。<br />
            · 导出为带版本号的单 JSON 文件，文件名默认含导出日期。<br />
            · 导入会覆盖当前全部数据，需二次确认；导入前的状态可撤销（Ctrl+Z）。<br />
            · 「导出 TXT」按时间范围导出事项清单（PRD 6.9）：默认当前月+下一自然月，结束最晚=开始+6 个月−1 天；日历显示自身起止、待办按截止日期，无截止不导出。<br />
            · 备份文件不含邮箱授权码；数据库位于 exe 同目录 data\calendar.db，删除目录即卸载干净。
          </div>
        </div>
        )}
      </div>

      {bkOpen ? (
        <Modal
          title="导出备份"
          onClose={() => setBkOpen(false)}
          width={440}
          footer={
            <>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setBkOpen(false)}>取消</button>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void doExportBackup()}>选择位置并导出</button>
            </>
          }
        >
          <div className="iform">
            <div className="frow">
              <label>导出范围</label>
              <span className="chips">
                {BK_QUICK_OPTIONS.map(({ unit, label }) => (
                  <button
                    key={unit}
                    type="button"
                    className={`chip${bkQuick === unit ? " on" : ""}`}
                    disabled={busy}
                    onClick={() => applyBkQuick(unit)}
                  >
                    {label}
                  </button>
                ))}
              </span>
            </div>
            <div className="frow">
              <label>开始日期</label>
              <span style={bkQuick === "all" ? { opacity: 0.45, pointerEvents: "none" } : undefined}>
                <SegDateInput value={bkStart} onChange={(v) => onBkDate("start", v)} />
              </span>
            </div>
            <div className="frow">
              <label>结束日期</label>
              <span style={bkQuick === "all" ? { opacity: 0.45, pointerEvents: "none" } : undefined}>
                <SegDateInput value={bkEnd} onChange={(v) => onBkDate("end", v)} />
              </span>
            </div>
          </div>
          {bkErr ? <div className="ferr">{bkErr}</div> : null}
          <div className="note">
            · 日历事项与范围有交集即导出（显示自身完整起止）；待办按截止日期在范围内；未设截止的事项仅「全部」包含。<br />
            · 分类与自定义字段定义始终全量导出（导入后结构完整）。<br />
            · 确定范围后选择保存位置（<b>默认桌面</b>），文件名含导出日期。
          </div>
        </Modal>
      ) : null}

      {confirmPath !== null ? (
        <Modal
          title="导入备份"
          onClose={() => setConfirmPath(null)}
          width={420}
          footer={
            <>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setConfirmPath(null)}>取消</button>
              <button type="button" className="btn-danger" disabled={busy} onClick={() => void doImport()}>确认导入</button>
            </>
          }
        >
          <p>导入将<strong>覆盖当前全部数据</strong>（分类/事项/字段定义与值）。</p>
          <p className="del-note">导入前的状态已计入撤销栈，可 Ctrl+Z 恢复。</p>
        </Modal>
      ) : null}

      {txtOpen ? (
        <Modal
          title="导出 TXT"
          onClose={() => setTxtOpen(false)}
          width={420}
          footer={
            <>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setTxtOpen(false)}>取消</button>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void doExportTxt()}>选择位置并导出</button>
            </>
          }
        >
          <div className="iform">
            <div className="frow">
              <label>快捷范围</label>
              <span className="chips">
                <button type="button" className="chip" disabled={busy} onClick={() => applyShortcut("w")}>一周内</button>
                <button type="button" className="chip" disabled={busy} onClick={() => applyShortcut(1)}>一个月内</button>
                <button type="button" className="chip" disabled={busy} onClick={() => applyShortcut(2)}>两个月内</button>
              </span>
            </div>
            <div className="frow">
              <label>开始日期</label>
              <SegDateInput value={txtStart} onChange={onTxtStartChange} />
            </div>
            <div className="frow">
              <label>结束日期</label>
              <SegDateInput value={txtEnd} onChange={(v) => { setTxtEnd(v); setTxtErr(""); }} />
            </div>
          </div>
          {txtErr ? <div className="ferr">{txtErr}</div> : null}
          <div className="note">
            · 默认导出当前月与下一个自然月；结束日期最晚为开始日期 + 6 个月。<br />
            · 日历事项与范围有交集即导出（显示自身起止日期）；待办按截止日期，无截止不导出。
          </div>
        </Modal>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </Modal>
  );
}



// 设置弹窗（P8：数据备份面板；二期 tab 置灰）。对齐原型「设置 → 数据备份」界面。
// 导出/导入经官方 tauri-plugin-dialog（用户自选目录/文件）。
import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import Modal from "../Modal/Modal";
import { backupApi } from "../../services/ipc";
import { useAppStore } from "../../stores/appStore";

interface Props {
  onClose: () => void;
}

type Tab = "backup" | "mail" | "records";

const JSON_FILTER = [{ name: "JSON 备份", extensions: ["json"] }];

export default function SettingsDialog({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("backup");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [importPath, setImportPath] = useState<string | null>(null);
  const [confirmPath, setConfirmPath] = useState<string | null>(null);

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 3600);
  };

  const doExport = async () => {
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
      await backupApi.export(path);
      showToast(`已导出：${path}`);
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
    <Modal title="设置" onClose={onClose} width={560}>
      <div className="set-wrap">
        <div className="set-tabs">
          {tabBtn("backup", "数据备份")}
          {tabBtn("mail", "邮箱绑定", "二期")}
          {tabBtn("records", "提醒发送记录", "二期")}
        </div>
        <div className="set-body">
          <div className="set-actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void doExport()}>
              导出备份
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => void pickImport()}>
              导入备份
            </button>
          </div>
          {importPath !== null ? (
            <div className="note picked">已选择：{importPath}</div>
          ) : null}
          <div className="note">
            · 导出为带版本号的单 JSON 文件，文件名默认含导出日期，可在对话框中选择保存目录。<br />
            · 导入会覆盖当前全部数据，需二次确认；导入前的状态可撤销（Ctrl+Z）。<br />
            · 备份文件不含邮箱授权码；数据库位于 exe 同目录 data\calendar.db，删除目录即卸载干净。
          </div>
        </div>
      </div>

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

      {toast ? <div className="toast">{toast}</div> : null}
    </Modal>
  );
}



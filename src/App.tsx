import { useEffect } from "react";
import TabBar from "./components/TabBar/TabBar";
import CalendarView from "./components/Calendar/CalendarView";
import TodoPanel from "./components/Todo/TodoPanel";
import { useAppStore } from "./stores/appStore";
import { useUndoStore } from "./stores/undoStore";

export default function App() {
  const { load } = useAppStore();
  const undoInit = useUndoStore((s) => s.init);

  useEffect(() => {
    load().catch(() => {
      /* 加载失败由组件操作提示 */
    });
    undoInit().catch(() => {
      /* 撤销初始化失败不影响主流程 */
    });
  }, [load, undoInit]);

  // 全局撤销/重做快捷键（PRD 6.7）：焦点在文本输入控件时不触发（交给输入框文本级撤销）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      const k = e.key.toLowerCase();
      const { undo, redo, canUndo, canRedo } = useUndoStore.getState();
      if (k === "z" && canUndo) {
        e.preventDefault();
        void undo().catch(() => { /* 撤销失败由按钮路径提示 */ });
      } else if (k === "y" && canRedo) {
        e.preventDefault();
        void redo().catch(() => { /* 重做失败由按钮路径提示 */ });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <TabBar />
      <CalendarView />
      <TodoPanel />
    </div>
  );
}

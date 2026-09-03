import { useEffect } from "react";
import TabBar from "./components/TabBar/TabBar";
import { useAppStore } from "./stores/appStore";
import { OVERVIEW } from "./services/types";

export default function App() {
  const { categories, activeTab, ready, load } = useAppStore();

  useEffect(() => {
    load().catch(() => {
      /* 加载失败：TabBar 操作会给出友好提示；此处避免未处理 Promise */
    });
  }, [load]);

  const currentName =
    activeTab === OVERVIEW
      ? "总览"
      : (categories.find((c) => c.id === activeTab)?.name ?? "…");

  return (
    <div className="app">
      <TabBar />
      <main className="main">
        <div className="toolbar">
          <span className="title">{currentName}</span>
        </div>
        <div className="placeholder">
          {ready ? "日历区将在 P4 实现" : "正在加载…"}
        </div>
      </main>
      <aside className="todo-pane">待办区将在 P5 实现</aside>
    </div>
  );
}
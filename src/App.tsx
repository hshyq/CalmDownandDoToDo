import { useEffect } from "react";
import TabBar from "./components/TabBar/TabBar";
import CalendarView from "./components/Calendar/CalendarView";
import TodoPanel from "./components/Todo/TodoPanel";
import { useAppStore } from "./stores/appStore";

export default function App() {
  const { load } = useAppStore();

  useEffect(() => {
    load().catch(() => {
      /* 加载失败由组件操作提示 */
    });
  }, [load]);

  return (
    <div className="app">
      <TabBar />
      <CalendarView />
      <TodoPanel />
    </div>
  );
}

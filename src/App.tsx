import { useEffect, useState } from "react";

/** P0 冒烟页：三栏骨架占位 + 前后端 IPC 打通验证（ping） */
export default function App() {
  const [ping, setPing] = useState<string>("检测中…");

  useEffect(() => {
    const inTauri = "__TAURI_INTERNALS__" in window;
    if (!inTauri) {
      setPing("浏览器预览模式（IPC 仅在 Tauri 窗口内可用）");
      return;
    }
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<string>("ping"))
      .then((v) => setPing(`后端返回：${v}`))
      .catch((e) => setPing(`IPC 失败：${String(e)}`));
  }, []);

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <aside style={{ width: 160, flex: "none", borderRight: "1px solid #e3e6ea", background: "#fff", padding: 8 }}>
        标签栏（P2 实现）
      </aside>
      <main style={{ flex: 1, padding: 12 }}>
        <h1 style={{ fontSize: 18 }}>日历待办工具</h1>
        <p style={{ marginTop: 12 }}>P0 工程骨架就绪 · {ping}</p>
      </main>
      <aside style={{ width: 280, flex: "none", borderLeft: "1px solid #e3e6ea", background: "#fff", margin: "10px 10px 10px 0", borderRadius: 8, padding: 10 }}>
        待办区（P5 实现）
      </aside>
    </div>
  );
}
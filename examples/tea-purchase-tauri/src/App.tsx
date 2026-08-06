import type { ActionIntent } from "@package-first/core";
import { SurfaceRenderer, useSurface } from "@package-first/renderer-react";
import { useEffect, useState } from "react";

import { createExampleRuntime, type TauriExampleRuntime } from "./runtime.js";

type PackChoice = "default" | "antd";
let runtimePromise: Promise<TauriExampleRuntime> | undefined;
function getRuntime() {
  runtimePromise ??= createExampleRuntime();
  return runtimePromise;
}

export function App() {
  const [runtime, setRuntime] = useState<TauriExampleRuntime>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    void getRuntime()
      .then(setRuntime)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Runtime 初始化失败",
        ),
      );
  }, []);
  if (error) return <main className="startup">启动失败：{error}</main>;
  if (!runtime) return <main className="startup">正在连接 Tauri Runtime…</main>;
  return <RuntimeApp runtime={runtime} />;
}

function RuntimeApp({ runtime }: { runtime: TauriExampleRuntime }) {
  const [surfaceId, setSurfaceId] = useState(runtime.searchSurfaceId);
  const [pack, setPack] = useState<PackChoice>("default");
  const [lastIntent, setLastIntent] = useState<ActionIntent>();
  const [message, setMessage] = useState(
    runtime.initialPreferenceError
      ? `偏好已降级到内存：${runtime.initialPreferenceError}`
      : "模拟 Agent 已选择 searchTeaProducts",
  );
  const surface = useSurface(runtime.surfaceStore, surfaceId);

  useEffect(
    () =>
      runtime.toolRuntime.subscribe((event) => {
        if (event.type === "result.surfaceCreated" && event.resultSurfaceId) {
          setSurfaceId(event.resultSurfaceId);
          setMessage(
            event.toolId === "createPurchaseOrder"
              ? "采购单创建成功"
              : "Host 已返回商品",
          );
        }
      }),
    [runtime],
  );

  function handleAction(intent: ActionIntent): void {
    setLastIntent(intent);
    if (intent.action === "select") {
      setMessage("选择已同步");
      return;
    }
    try {
      const outcome = runtime.toolRuntime.handleAction(intent);
      if (outcome.kind === "confirmation-required") {
        setSurfaceId(outcome.confirmationSurface.id);
        setMessage("采购提交等待强制确认");
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "操作失败");
    }
  }

  function next(): void {
    if (surfaceId.includes("tea-search-form--result")) {
      setSurfaceId(runtime.createSelectionSurface());
    } else if (surfaceId === "tea-selection") {
      if (runtime.selectedTeaIds().length === 0)
        setMessage("请至少选择一种茶叶");
      else setSurfaceId(runtime.createPurchaseSurface());
    }
  }

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">PACKAGE-FIRST · MILESTONE 5 · TAURI 2</p>
        <h1>Tool-to-UI 桌面闭环</h1>
        <p>
          与 Web 复用 Tool Definitions、Surface 模型、ActionIntent 和 Mock Host
          Executor。
        </p>
      </header>
      <section className="status-bar">
        <span>{message}</span>
        <code>
          {surface.id} · revision {surface.revision}
        </code>
      </section>
      <section className="pack-switcher" aria-label="Component Pack">
        <strong>WebView Component Pack</strong>
        {(["default", "antd"] as const).map((id) => (
          <button
            type="button"
            key={id}
            aria-pressed={pack === id}
            onClick={() => setPack(id)}
          >
            {id}
          </button>
        ))}
      </section>
      <section className="views">
        {(["compact", "workspace"] as const).map((mode) => (
          <article className="view-card" key={mode}>
            <div className="view-heading">
              <span>{mode}</span>
              <small>{mode}</small>
            </div>
            <SurfaceRenderer
              surfaceId={surfaceId}
              store={runtime.surfaceStore}
              componentRegistry={runtime.componentRegistry}
              reactComponents={runtime.reactComponents}
              mode={mode}
              preferredPack={pack}
              enabledPackIds={[pack]}
              capabilities={["web", "desktop"]}
              onActionIntent={handleAction}
              onError={(renderError) => setMessage(renderError.message)}
            />
          </article>
        ))}
      </section>
      <section className="controls">
        {(surfaceId.includes("tea-search-form--result") ||
          surfaceId === "tea-selection") && (
          <button type="button" className="primary" onClick={next}>
            {surfaceId === "tea-selection" ? "生成采购表单" : "进入商品选择"}
          </button>
        )}
        {surfaceId === "purchase-form" && (
          <>
            <button
              type="button"
              onClick={() => {
                const before = JSON.stringify(
                  runtime.surfaceStore.requireSurface("purchase-form").data,
                );
                const result = runtime.applyAgentLayoutOperations();
                setMessage(
                  result.ok && before === JSON.stringify(result.value.data)
                    ? "Agent Operations 已应用且数据保留"
                    : result.ok
                      ? "数据变化"
                      : result.error.message,
                );
              }}
            >
              模拟 Agent 调整表单
            </button>
            <button
              type="button"
              onClick={() => void runtime.saveRemarkPreference()}
            >
              保存备注偏好
            </button>
          </>
        )}
      </section>
      <section className="evidence-grid">
        <article>
          <h2>最近 ActionIntent</h2>
          <pre>
            {lastIntent ? JSON.stringify(lastIntent, null, 2) : "尚未产生"}
          </pre>
        </article>
        <article>
          <h2>当前 Surface Data</h2>
          <pre>{JSON.stringify(surface.data, null, 2)}</pre>
        </article>
      </section>
    </main>
  );
}

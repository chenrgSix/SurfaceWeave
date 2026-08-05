import type { ActionIntent, ActionResult } from "@package-first/core";
import { SurfaceRenderer, useSurface } from "@package-first/renderer-react";
import { useEffect, useState } from "react";

import { createExampleRuntime, type TauriExampleRuntime } from "./runtime.js";

let runtimePromise: Promise<TauriExampleRuntime> | undefined;

function getRuntime(): Promise<TauriExampleRuntime> {
  runtimePromise ??= createExampleRuntime();
  return runtimePromise;
}

export function App() {
  const [runtime, setRuntime] = useState<TauriExampleRuntime>();
  const [startupError, setStartupError] = useState<string>();

  useEffect(() => {
    void getRuntime()
      .then(setRuntime)
      .catch((error: unknown) => {
        setStartupError(
          error instanceof Error ? error.message : "Tauri Runtime 初始化失败",
        );
      });
  }, []);

  if (startupError !== undefined) {
    return <main className="startup">启动失败：{startupError}</main>;
  }
  if (runtime === undefined) {
    return <main className="startup">正在连接 Tauri Runtime…</main>;
  }
  return <RuntimeApp runtime={runtime} />;
}

function RuntimeApp({ runtime }: { runtime: TauriExampleRuntime }) {
  const [surfaceId, setSurfaceId] = useState("tea-selection");
  const [lastIntent, setLastIntent] = useState<ActionIntent>();
  const [lastResult, setLastResult] = useState<ActionResult>();
  const [message, setMessage] = useState(
    runtime.initialPreferenceError === undefined
      ? "偏好已从 Tauri Store 恢复；业务表单数据未恢复"
      : `偏好不可用，已安全降级为本次会话内存：${runtime.initialPreferenceError}`,
  );
  const surface = useSurface(runtime.surfaceStore, surfaceId);

  async function handleAction(originalIntent: ActionIntent): Promise<void> {
    if (originalIntent.action === "select") {
      setLastIntent(originalIntent);
      setMessage("茶叶选择已同步到聊天和工作区");
      return;
    }
    const intent =
      originalIntent.action === "purchase.create"
        ? { ...originalIntent, idempotencyKey: originalIntent.id }
        : originalIntent;
    setLastIntent(intent);
    const result = await runtime.actionExecutor.execute(intent);
    setLastResult(result);
    if (result.status === "error") {
      setMessage(`${result.error?.code}: ${result.error?.message}`);
      return;
    }
    if (intent.action === "tea.search") {
      const teas = Array.isArray(result.output) ? result.output : [];
      runtime.replaceTeaResults(
        teas.flatMap((item) =>
          typeof item === "object" &&
          item !== null &&
          !Array.isArray(item) &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.origin === "string" &&
          typeof item.price === "number"
            ? [
                {
                  id: item.id,
                  name: item.name,
                  origin: item.origin,
                  price: item.price,
                },
              ]
            : [],
        ),
      );
      setMessage("Rust search_teas 已返回模拟茶叶列表");
      return;
    }
    if (intent.action === "purchase.create") {
      const created = runtime.ensurePurchaseSurface();
      if (!created.ok) {
        setMessage(`${created.error.code}: ${created.error.message}`);
        return;
      }
      setSurfaceId("purchase-form");
      setMessage("语义动作已映射到 create_purchase；采购表单已生成");
    }
  }

  function applyAgentChange(): void {
    const before = structuredClone(
      runtime.surfaceStore.requireSurface("purchase-form").data,
    );
    const result = runtime.applyAgentLayoutOperations();
    if (!result.ok) {
      setMessage(`${result.error.code}: ${result.error.message}`);
      return;
    }
    setMessage(
      JSON.stringify(before) === JSON.stringify(result.value.data)
        ? "Agent Operations 已应用，兼容表单数据完整保留"
        : "Agent Operations 已应用，但数据发生了非预期变化",
    );
  }

  async function savePreference(): Promise<void> {
    const result = await runtime.saveRemarkPreference();
    if (!result.ok) {
      setMessage(`${result.error.code}: ${result.error.message}`);
      return;
    }
    setMessage(
      runtime.initialPreferenceError === undefined
        ? "备注折叠 Preference Patch 已写入 Tauri Store"
        : "持久存储仍不可用；偏好只保存于本次会话内存",
    );
  }

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">PACKAGE-FIRST · MILESTONE 3 · TAURI 2</p>
        <h1>受控桌面动态 UI</h1>
        <p>
          React Renderer 运行在 WebView；语义 ActionIntent 经过宿主白名单后，
          才能调用 capabilities 明确授权的 Rust Command。
        </p>
      </header>

      <section className="status-bar">
        <span>{message}</span>
        <code>
          {surface.id} · revision {surface.revision}
        </code>
      </section>

      <section className="views">
        {(["compact", "workspace"] as const).map((mode) => (
          <article className="view-card" key={mode}>
            <div className="view-heading">
              <span>
                {mode === "compact" ? "聊天紧凑视图" : "工作区完整视图"}
              </span>
              <small>{mode}</small>
            </div>
            <SurfaceRenderer
              surfaceId={surfaceId}
              store={runtime.surfaceStore}
              componentRegistry={runtime.componentRegistry}
              reactComponents={runtime.reactComponents}
              mode={mode}
              onActionIntent={(intent) => void handleAction(intent)}
              onError={(error) => setMessage(`${error.code}: ${error.message}`)}
            />
          </article>
        ))}
      </section>

      <section className="controls">
        {surfaceId === "purchase-form" && (
          <>
            <button
              type="button"
              className="primary"
              onClick={applyAgentChange}
            >
              模拟 Agent 调整表单
            </button>
            <button type="button" onClick={() => void savePreference()}>
              持久化备注折叠偏好
            </button>
            <button type="button" onClick={() => setSurfaceId("tea-selection")}>
              返回茶叶选择
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
          <h2>最近 ActionResult</h2>
          <pre>
            {lastResult ? JSON.stringify(lastResult, null, 2) : "尚未执行"}
          </pre>
        </article>
        <article>
          <h2>当前会话 Surface Data</h2>
          <pre>{JSON.stringify(surface.data, null, 2)}</pre>
        </article>
      </section>
    </main>
  );
}

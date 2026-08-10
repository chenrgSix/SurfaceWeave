import type { ActionIntent } from "@surfaceweave/core";
import { SurfaceRenderer, useSurface } from "@surfaceweave/react";
import { useEffect, useState } from "react";

import {
  applyAgentLayoutOperations,
  componentRegistry,
  createPurchaseSurface,
  createSelectionSurface,
  reactComponents,
  searchFlow,
  selectedTeaIds,
  surfaceStore,
  toolRuntime,
} from "./runtime.js";

type PackChoice = "default" | "react-aria" | "antd";
const enabledPacks: Record<PackChoice, string[]> = {
  default: ["default", "tea-business"],
  "react-aria": ["react-aria", "default"],
  antd: ["antd", "default"],
};

export function App() {
  const [surfaceId, setSurfaceId] = useState(searchFlow.surface.id);
  const [pack, setPack] = useState<PackChoice>("default");
  const [lastIntent, setLastIntent] = useState<ActionIntent>();
  const [message, setMessage] = useState("模拟 Agent 已选择 searchTeaProducts");
  const surface = useSurface(surfaceStore, surfaceId);

  useEffect(
    () =>
      toolRuntime.subscribe((event) => {
        if (event.type === "result.surfaceCreated" && event.resultSurfaceId) {
          setSurfaceId(event.resultSurfaceId);
          setMessage(
            event.toolId === "createPurchaseOrder"
              ? "采购单创建成功"
              : "Host 已返回茶叶商品",
          );
        }
      }),
    [],
  );

  function handleAction(intent: ActionIntent): void {
    setLastIntent(intent);
    if (intent.action === "select") {
      setMessage("选择已在聊天与工作区实时同步");
      return;
    }
    try {
      const outcome = toolRuntime.handleAction(intent);
      if (outcome.kind === "confirmation-required") {
        setSurfaceId(outcome.confirmationSurface.id);
        setMessage("副作用工具必须确认，Agent 与 Pack 无法绕过");
      } else if (outcome.kind === "invocation-requested") {
        setMessage("Runtime 已向 Host 发出结构化 invocation request");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    }
  }

  function next(): void {
    if (surfaceId.includes("tea-search-form--result")) {
      setSurfaceId(createSelectionSurface());
      setMessage("本地选择步骤已创建");
    } else if (surfaceId === "tea-selection") {
      if (selectedTeaIds().length === 0) {
        setMessage("请至少选择一种茶叶");
      } else {
        setSurfaceId(createPurchaseSurface());
        setMessage("createPurchaseOrder Surface 已由 Tool Schema 生成");
      }
    }
  }

  function adjust(): void {
    const before = JSON.stringify(
      surfaceStore.requireSurface("purchase-form").data,
    );
    const result = applyAgentLayoutOperations();
    setMessage(
      result.ok && before === JSON.stringify(result.value.data)
        ? "Agent Operations 已应用，表单数据保持不变"
        : result.ok
          ? "数据发生变化，请检查"
          : result.error.message,
    );
  }

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">PACKAGE-FIRST · MILESTONE 5</p>
        <h1>Tool-to-UI 茶叶采购闭环</h1>
        <p>注册 Tool → Schema UI → Host 执行 → 结果 UI → 下一 Tool。</p>
      </header>
      <section className="status-bar">
        <span>{message}</span>
        <code>
          {surface.id} · revision {surface.revision}
        </code>
      </section>
      <section className="pack-switcher" aria-label="Component Pack">
        <strong>Renderer / Component Pack</strong>
        {(["default", "react-aria", "antd"] as const).map((id) => (
          <button
            key={id}
            type="button"
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
              <span>
                {mode === "compact" ? "聊天紧凑视图" : "工作区完整视图"}
              </span>
              <small>{mode}</small>
            </div>
            <SurfaceRenderer
              surfaceId={surfaceId}
              store={surfaceStore}
              componentRegistry={componentRegistry}
              reactComponents={reactComponents}
              mode={mode}
              preferredPack={pack}
              enabledPackIds={enabledPacks[pack]}
              capabilities={["web"]}
              actionStateSource={toolRuntime.actionStateSource}
              onActionIntent={handleAction}
              onError={(error) => setMessage(error.message)}
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
          <button type="button" onClick={adjust}>
            模拟 Agent：收货信息前置并折叠备注
          </button>
        )}
      </section>
      <section className="evidence-grid">
        <article>
          <h2>Invocation</h2>
          <pre>
            {JSON.stringify(
              toolRuntime
                .listTools()
                .map(({ id, version }) => ({ id, version })),
              null,
              2,
            )}
          </pre>
        </article>
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

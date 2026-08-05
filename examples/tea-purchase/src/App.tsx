import type { ActionIntent } from "@package-first/core";
import { SurfaceRenderer, useSurface } from "@package-first/renderer-react";
import { useState } from "react";

import {
  applyAgentLayoutOperations,
  componentRegistry,
  ensurePurchaseSurface,
  reactComponents,
  selectedTeaIds,
  surfaceStore,
  teaToolResult,
} from "./runtime.js";

export function App() {
  const [surfaceId, setSurfaceId] = useState("tea-selection");
  const [lastIntent, setLastIntent] = useState<ActionIntent>();
  const [message, setMessage] = useState("等待用户选择茶叶");
  const surface = useSurface(surfaceStore, surfaceId);

  function openPurchaseForm(): void {
    if (selectedTeaIds().length === 0) {
      setMessage("请至少选择一种茶叶");
      return;
    }
    const result = ensurePurchaseSurface();
    if (!result.ok) {
      setMessage(`${result.error.code}: ${result.error.message}`);
      return;
    }
    setSurfaceId(result.value.id);
    setMessage("采购表单已由 JSON Schema 确定性生成");
  }

  function applyAgentChange(): void {
    const before = structuredClone(
      surfaceStore.requireSurface("purchase-form").data,
    );
    const result = applyAgentLayoutOperations();
    if (!result.ok) {
      setMessage(`${result.error.code}: ${result.error.message}`);
      return;
    }
    const preserved =
      JSON.stringify(before) === JSON.stringify(result.value.data);
    setMessage(
      preserved
        ? "Agent Operations 已应用；已填写数据完整保留"
        : "Agent Operations 已应用；请检查数据迁移结果",
    );
  }

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">PACKAGE-FIRST · MILESTONE 1</p>
        <h1>对话式动态 UI SDK</h1>
        <p>
          Tool Schema 生成可信 Surface，业务 Agent 只发送语义
          Operations，宿主只接收结构化 ActionIntent。
        </p>
      </header>

      <section className="status-bar">
        <span>{message}</span>
        <code>
          {surface.id} · revision {surface.revision}
        </code>
      </section>

      <section className="views">
        <article className="view-card compact-card">
          <div className="view-heading">
            <span>聊天紧凑视图</span>
            <small>compact</small>
          </div>
          <SurfaceRenderer
            surfaceId={surfaceId}
            store={surfaceStore}
            componentRegistry={componentRegistry}
            reactComponents={reactComponents}
            mode="compact"
            onActionIntent={(intent) => {
              setLastIntent(intent);
              setMessage(`已产生 ActionIntent: ${intent.action}`);
            }}
          />
        </article>

        <article className="view-card workspace-card">
          <div className="view-heading">
            <span>工作区完整视图</span>
            <small>workspace</small>
          </div>
          <SurfaceRenderer
            surfaceId={surfaceId}
            store={surfaceStore}
            componentRegistry={componentRegistry}
            reactComponents={reactComponents}
            mode="workspace"
            onActionIntent={(intent) => {
              setLastIntent(intent);
              setMessage(`已产生 ActionIntent: ${intent.action}`);
            }}
          />
        </article>
      </section>

      <section className="controls">
        {surfaceId === "tea-selection" ? (
          <button type="button" className="primary" onClick={openPurchaseForm}>
            根据采购 Schema 生成表单
          </button>
        ) : (
          <>
            <button
              type="button"
              className="primary"
              onClick={applyAgentChange}
            >
              模拟 Agent：收货信息前置并折叠备注
            </button>
            <button type="button" onClick={() => setSurfaceId("tea-selection")}>
              返回茶叶选择
            </button>
          </>
        )}
      </section>

      <section className="evidence-grid">
        <article>
          <h2>模拟 Tool Result</h2>
          <pre>{JSON.stringify(teaToolResult, null, 2)}</pre>
        </article>
        <article>
          <h2>最近 ActionIntent</h2>
          <pre>
            {lastIntent === undefined
              ? "尚未产生"
              : JSON.stringify(lastIntent, null, 2)}
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

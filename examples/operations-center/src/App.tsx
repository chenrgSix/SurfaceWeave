import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { SurfaceRenderer, useSurface } from "@surfaceweave/react";

import { ConfirmationData, createDemoReactRegistry } from "./component-pack.js";
import { OperationsDemo, type DemoSnapshot } from "./demo-runtime.js";
import { Icon } from "./icons.js";
import { routes } from "./scenario.js";

export function App() {
  const [demo, setDemo] = useState(() => new OperationsDemo());
  useEffect(() => () => demo.dispose(), [demo]);
  return (
    <CommandCenter
      demo={demo}
      reset={() => {
        demo.dispose();
        setDemo(new OperationsDemo());
      }}
    />
  );
}

function CommandCenter({
  demo,
  reset,
}: {
  demo: OperationsDemo;
  reset: () => void;
}) {
  const state = useSyncExternalStore(demo.subscribe, demo.getSnapshot);
  const [showShared, setShowShared] = useState(false);
  const registry = useMemo(() => createDemoReactRegistry(demo), [demo]);
  const status = state.invocation?.status;
  const editable = status === "editing";
  const render = (
    surfaceId: string,
    mode: "compact" | "workspace" = "workspace",
  ) => (
    <SurfaceRenderer
      surfaceId={surfaceId}
      store={demo.store}
      componentRegistry={demo.components}
      reactComponents={registry}
      preferredPack="operations"
      mode={mode}
      actionStateSource={demo.tools.actionStateSource}
      onActionIntent={demo.handleAction}
    />
  );

  return (
    <div className="app-shell">
      <nav className="icon-rail" aria-label="主要导航">
        <a className="brand-mark" href="#top" aria-label="SurfaceWeave 首页">
          <Icon name="layers" size={25} />
        </a>
        <div className="rail-links">
          <a href="#workspace" className="active" aria-label="处置工作台">
            <Icon name="grid" size={21} />
          </a>
          <a href="#runtime" aria-label="运行时证据">
            <Icon name="pulse" size={22} />
          </a>
          <a
            href="https://chenrgsix.github.io/SurfaceWeave/"
            target="_blank"
            rel="noreferrer"
            aria-label="打开项目文档"
          >
            <Icon name="book" size={21} />
          </a>
        </div>
        <span className="rail-version">SW</span>
      </nav>
      <div className="app-content" id="top">
        <header className="topbar">
          <a href="#top" className="wordmark">
            SurfaceWeave<span>/</span>
            <span className="topbar-title">Operations Center</span>
          </a>
          <div className="topbar-right">
            <span className="live-label">
              <i /> 交互演示
            </span>
            <span className="avatar">LX</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">AGENTIC WORKSPACE / 供应链运营</p>
              <h1>从异常，到行动。</h1>
              <p>Agent 生成可操作的工作界面，人掌握每一次业务执行。</p>
            </div>
            <button
              className="button reset-button"
              aria-label="重置演示"
              onClick={() => {
                setShowShared(false);
                reset();
              }}
            >
              <Icon name="refresh" size={15} />{" "}
              <span className="reset-label">重置演示</span>
            </button>
          </div>
          <div className="workspace-grid">
            <div className="main-column">
              <section
                className="incident-hero"
                aria-labelledby="incident-title"
              >
                <div className="incident-heading">
                  <span className="severity">
                    <i /> P1 · 供应中断
                  </span>
                  <div className="incident-entry">
                    <span className="incident-ref">INC-0842 / 演示数据</span>
                    {state.surfaceId === null ? (
                      <button
                        className="hero-cta"
                        onClick={() => {
                          demo.start();
                          document
                            .getElementById("workspace")
                            ?.scrollIntoView({ block: "start" });
                        }}
                      >
                        <Icon name="spark" size={14} /> 生成处置工作台{" "}
                        <Icon name="arrow" size={14} />
                      </button>
                    ) : (
                      <a className="hero-cta" href="#workspace">
                        进入处置工作台 <Icon name="arrow" size={14} />
                      </a>
                    )}
                  </div>
                </div>
                <div className="incident-copy">
                  <div>
                    <h2 id="incident-title">
                      一批关键芯片延误。
                      <br />
                      <span>八条产线，正在等待。</span>
                    </h2>
                    <p>
                      深圳 → 汉堡的 MCU 货运延迟 36 小时。
                      <br />
                      需要在停线前，为慕尼黑工厂找到可执行的恢复方案。
                    </p>
                  </div>
                  <div className="impact-orbit">
                    <span>受影响产线</span>
                    <strong>
                      08<small>LINES</small>
                    </strong>
                    <div>
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </div>
                <SupplyRoute />
                <div className="hero-footer">
                  <span>
                    <Icon name="box" size={14} /> SHP-0826 · 12,800 件 MCU
                  </span>
                  <span>
                    <Icon name="clock" size={14} /> 处置窗口剩余 06h 20m ·
                    场景设定
                  </span>
                </div>
              </section>
              {state.surfaceId === null ? (
                <div className="metrics">
                  <Metric
                    label="原计划恢复"
                    value="54"
                    unit="h"
                    detail="等待海运到港"
                  />
                  <Metric
                    label="可选恢复路线"
                    value="03"
                    detail="空运 / 调拨 / 等待"
                  />
                  <Metric
                    label="最快可缩短"
                    value="36"
                    unit="h"
                    detail="采用空运方案 · 模拟估算"
                    positive
                  />
                </div>
              ) : (
                <LiveMetrics demo={demo} surfaceId={state.surfaceId} />
              )}
              <section
                className="workbench card"
                id="workspace"
                aria-label="主处置工作台"
              >
                <div className="panel-heading">
                  <div className="panel-title">
                    <span className="panel-icon">
                      <Icon name="layers" />
                    </span>
                    <div>
                      <h2>处置工作台</h2>
                      <p>
                        {state.reorganized
                          ? "语义组件 + 原子变更 · 由 Agent 重新组织"
                          : "由注册 Tool Schema 生成 · 通过 SurfaceRenderer 渲染"}
                      </p>
                    </div>
                  </div>
                  {state.surfaceId && (
                    <Revision demo={demo} surfaceId={state.surfaceId} />
                  )}
                </div>
                {state.surfaceId === null ? (
                  <div className="empty-workbench">
                    <div className="surface-skeleton" aria-hidden="true">
                      <div>
                        <i />
                        <i />
                        <i />
                      </div>
                      <span />
                      <span />
                      <b />
                    </div>
                    <p className="eyebrow">SCHEMA → SURFACE → ACTION</p>
                    <h3>不止分析问题。直接生成解决问题的界面。</h3>
                    <p>
                      从恢复计划的 Tool Schema
                      出发，生成字段、绑定数据、建立执行边界。
                    </p>
                    <button
                      className="button primary"
                      onClick={() => demo.start()}
                    >
                      <Icon name="spark" /> 让 Agent 生成处置台{" "}
                      <Icon name="arrow" size={16} />
                    </button>
                    <small>无需 API Key · 可重复操作的脚本化 Agent</small>
                  </div>
                ) : (
                  <>
                    <div
                      className={`workspace-status ${state.preserved ? "success" : ""}`}
                    >
                      <Icon
                        name={state.preserved ? "check" : "code"}
                        size={15}
                      />
                      <span>
                        {state.preserved
                          ? "4 个操作已原子应用，用户输入完整保留"
                          : "这是工具生成的输入界面。先改一句备注，再让 Agent 重组。"}
                      </span>
                    </div>
                    {status === "error" ? (
                      <div className="outcome error-outcome" role="status">
                        <span className="outcome-icon">
                          <Icon name="refresh" size={25} />
                        </span>
                        <h3>承运商暂时不可用，计划没有丢失。</h3>
                        <p>
                          这是演示预设的首次失败。重试会复用已确认参数和原幂等键，不会重新读取表单。
                        </p>
                        <code>{state.invocation?.lastIdempotencyKey}</code>
                        <div className="outcome-buttons">
                          <button
                            className="button primary"
                            onClick={() => demo.retry()}
                          >
                            <Icon name="refresh" size={16} /> 使用原幂等键重试
                          </button>
                          <button
                            className="button secondary"
                            onClick={() => demo.edit()}
                          >
                            修改后重新确认
                          </button>
                        </div>
                      </div>
                    ) : status === "success" ? (
                      <div className="outcome success-outcome" role="status">
                        <span className="outcome-icon">
                          <Icon name="check" size={28} />
                        </span>
                        <p className="eyebrow">
                          RECOVERY PLAN ACTIVATED · 模拟执行
                        </p>
                        <h3>处置已落地，执行有回执。</h3>
                        <p>
                          模拟运单{" "}
                          <strong>{String(state.receipt?.orderId)}</strong>{" "}
                          已创建。整个过程可从运行时事件追溯。
                        </p>
                        <div className="receipt-stats">
                          <span>
                            <strong>{state.hostRequests.length}</strong>宿主请求
                          </span>
                          <span>
                            <strong>
                              {
                                new Set(
                                  state.hostRequests.map(
                                    (item) => item.idempotencyKey,
                                  ),
                                ).size
                              }
                            </strong>
                            幂等键
                          </span>
                          <span>
                            <strong>1</strong>模拟运单
                          </span>
                        </div>
                        <details className="result-details">
                          <summary>
                            查看运行时生成的结果 Surface{" "}
                            <Icon name="chevron" size={14} />
                          </summary>
                          {state.invocation?.resultSurfaceId &&
                            render(state.invocation.resultSurfaceId)}
                        </details>
                        <button
                          className="button secondary"
                          onClick={() => {
                            setShowShared(false);
                            reset();
                          }}
                        >
                          再走一遍流程 <Icon name="refresh" size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="surface-content">
                        {render(state.surfaceId)}
                      </div>
                    )}
                  </>
                )}
                {state.notice && (
                  <div className="notice" role="alert">
                    {state.notice}
                  </div>
                )}
              </section>
              <section className="capability-strip" aria-label="架构边界">
                <div>
                  <Icon name="code" />
                  <strong>Agent 决定怎样呈现</strong>
                  <span>只提交受校验的语义操作</span>
                </div>
                <div>
                  <Icon name="layers" />
                  <strong>Runtime 保证状态与约束</strong>
                  <span>组件树、用户数据、执行状态分离</span>
                </div>
                <div>
                  <Icon name="shield" />
                  <strong>Host 决定能否执行</strong>
                  <span>确认后调用业务 API，此处为模拟</span>
                </div>
              </section>
            </div>
            <aside className="side-column">
              <section className="agent-panel card">
                <div className="panel-heading">
                  <div className="panel-title">
                    <span className="agent-symbol">
                      <Icon name="spark" size={19} />
                    </span>
                    <h2>处置 Copilot</h2>
                  </div>
                  <span className="mini-badge">脚本化 Agent</span>
                </div>
                <div className="agent-message">
                  <span className="eyebrow">WORKING WITH YOU</span>
                  <p>
                    {state.surfaceId === null
                      ? "我已整理出三条恢复路线。接下来，把这些信息变成一个可以核对、调整和执行的工作台。"
                      : status === "success"
                        ? "恢复计划已交给模拟宿主。你可以在下方核查：UI 变更、审批、执行和重试都有独立证据。"
                        : state.reorganized
                          ? "方案已变成对比卡，审批区已前置。你的输入没有被覆盖。现在试着挑战约束，或核对后提交。"
                          : "工作台已生成。你可以先修改备注，我会把普通表单重组成更适合决策的界面。"}
                  </p>
                  <div className="agent-sources">
                    <span>Tool Schema</span>
                    <span>物流事件</span>
                    <span>库存快照</span>
                  </div>
                </div>
                <ol className="demo-steps">
                  <Step
                    number="01"
                    done={state.surfaceId !== null}
                    title="从工具生成界面"
                    detail="字段与校验来自 Tool Schema"
                  />
                  <Step
                    number="02"
                    done={state.reorganized}
                    title="让界面随任务进化"
                    detail="替换业务组件 · 重排 · 数据保留"
                  />
                  <Step
                    number="03"
                    done={state.checks.length === 2}
                    title="亲手挑战运行时边界"
                    detail="越权与过期写入都应被拒绝"
                  />
                  <Step
                    number="04"
                    done={status === "success"}
                    title="确认、执行与故障恢复"
                    detail="审批快照 · 幂等重试 · 结果 Surface"
                  />
                </ol>
                <div className="agent-actions">
                  {state.surfaceId === null ? (
                    <button
                      className="button primary"
                      onClick={() => demo.start()}
                    >
                      <Icon name="spark" size={16} /> 开始生成
                    </button>
                  ) : (
                    <button
                      className="button agent-button"
                      disabled={!editable || state.reorganized}
                      onClick={() => demo.reorganize()}
                    >
                      <Icon
                        name={state.reorganized ? "check" : "spark"}
                        size={16}
                      />
                      {state.reorganized
                        ? "已重组 · 数据保留"
                        : "把表单重组为决策界面"}
                    </button>
                  )}
                  <p>真实 SDK 操作，无远程 LLM 调用</p>
                </div>
              </section>
              <section className="guard-panel card">
                <div className="mini-heading">
                  <Icon name="shield" size={17} />
                  <h2>别相信承诺，试着突破。</h2>
                </div>
                <p>让 Agent 发出不该被允许的修改，看看运行时怎么处理。</p>
                <button
                  className="challenge-button"
                  disabled={!editable}
                  onClick={() => demo.challenge("constraint")}
                >
                  <span>
                    <strong>隐藏强制审批</strong>
                    <small>连同一项合法修改一起提交</small>
                  </span>
                  {state.checks.includes("constraint") ? (
                    <span className="check-result">
                      <Icon name="check" size={14} /> 已拦截
                    </span>
                  ) : (
                    <Icon name="arrow" size={16} />
                  )}
                </button>
                <button
                  className="challenge-button"
                  disabled={!editable}
                  onClick={() => demo.challenge("revision")}
                >
                  <span>
                    <strong>发送过期版本</strong>
                    <small>模拟 Agent 使用旧 revision 写入</small>
                  </span>
                  {state.checks.includes("revision") ? (
                    <span className="check-result">
                      <Icon name="check" size={14} /> 已拒绝
                    </span>
                  ) : (
                    <Icon name="arrow" size={16} />
                  )}
                </button>
              </section>
              <section className="shared-panel card">
                <button
                  className="shared-toggle"
                  onClick={() => setShowShared(!showShared)}
                  disabled={state.surfaceId === null}
                  aria-expanded={showShared}
                >
                  <span className="mini-heading">
                    <Icon name="link" size={17} />
                    <strong>共享会话视图</strong>
                  </span>
                  <Icon
                    name="chevron"
                    size={15}
                    style={{
                      transform: showShared ? "rotate(90deg)" : undefined,
                    }}
                  />
                </button>
                <p>
                  同一个 Surface，另一个 React
                  视图。修改任意一侧，另一侧立即同步。
                </p>
                {showShared && state.surfaceId && (
                  <div className="shared-surface" aria-label="共享紧凑视图">
                    {status === "success" ? (
                      <p className="check-result">
                        <Icon name="check" /> 当前调用已成功
                      </p>
                    ) : status === "error" ? (
                      <p>调用失败，请在主工作台重试或返回修改。</p>
                    ) : (
                      render(state.surfaceId, "compact")
                    )}
                  </div>
                )}
                <div className="shared-footer">
                  <span className="status-dot" /> 同页共享 Store · 非跨设备同步
                </div>
              </section>
            </aside>
          </div>
          <RuntimeEvidence state={state} />
          <footer className="page-footer">
            <span>
              <Icon name="layers" size={15} /> SurfaceWeave <b>—</b> UI is a
              runtime, not a screenshot.
            </span>
            <span>
              虚构业务数据 / 脚本化 Agent / 模拟 Host / 真实 SurfaceWeave SDK
            </span>
          </footer>
        </main>
      </div>
      {state.confirmationId && (
        <ConfirmationSheet
          key={state.confirmationId}
          demo={demo}
          surfaceId={state.confirmationId}
        >
          {render(state.confirmationId)}
        </ConfirmationSheet>
      )}
    </div>
  );
}

function ConfirmationSheet({
  demo,
  surfaceId,
  children,
}: {
  demo: OperationsDemo;
  surfaceId: string;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const surface = useSurface(demo.store, surfaceId);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      className="confirmation-dialog"
      ref={dialog}
      aria-label="确认恢复计划"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          demo.edit();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        demo.edit();
      }}
    >
      <ConfirmationData.Provider value={surface.data}>
        {children}
      </ConfirmationData.Provider>
    </dialog>
  );
}

function Metric({
  label,
  value,
  unit,
  detail,
  positive = false,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <div className={`metric ${positive ? "positive" : ""}`}>
      <span>{label}</span>
      <div>
        <strong>{value}</strong>
        {unit && <b>{unit}</b>}
      </div>
      <small>{detail}</small>
    </div>
  );
}
function LiveMetrics({
  demo,
  surfaceId,
}: {
  demo: OperationsDemo;
  surfaceId: string;
}) {
  const surface = useSurface(demo.store, surfaceId);
  const route =
    routes.find((item) => item.id === surface.data.route) ?? routes[0];
  return (
    <div className="metrics">
      <Metric label="原计划恢复" value="54" unit="h" detail="等待海运到港" />
      <Metric
        label="所选方案预计恢复"
        value={String(route.hours)}
        unit="h"
        detail={route.name}
      />
      <Metric
        label="预计缩短"
        value={String(route.saving)}
        unit="h"
        detail={`${route.cost} 增量费用 · 模拟估算`}
        positive
      />
    </div>
  );
}
function Revision({
  demo,
  surfaceId,
}: {
  demo: OperationsDemo;
  surfaceId: string;
}) {
  const surface = useSurface(demo.store, surfaceId);
  return (
    <span className="revision">
      <span className="status-dot" /> rev {surface.revision}
    </span>
  );
}
function Step({
  number,
  done,
  title,
  detail,
}: {
  number: string;
  done: boolean;
  title: string;
  detail: string;
}) {
  return (
    <li className={done ? "done" : ""}>
      <span className="step-number">
        {done ? <Icon name="check" size={14} /> : number}
      </span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </li>
  );
}
function SupplyRoute() {
  return (
    <div
      className="supply-route"
      role="img"
      aria-label="深圳至汉堡运输延迟 36 小时，影响慕尼黑工厂。可选择空运直达慕尼黑。"
    >
      <svg viewBox="0 0 660 138" fill="none">
        <defs>
          <linearGradient id="route-gradient" x1="30" x2="620">
            <stop stopColor="#a899fa" />
            <stop offset="1" stopColor="#6ee7c1" />
          </linearGradient>
        </defs>
        <path
          className="route-grid"
          d="M0 26H660M0 58H660M0 90H660M0 122H660M70 0V138M170 0V138M270 0V138M370 0V138M470 0V138M570 0V138"
        />
        <path
          d="M45 94C210 94 235 94 344 94H610"
          stroke="#506078"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        <path
          className="air-path"
          d="M45 94C180-8 430-8 610 94"
          stroke="url(#route-gradient)"
          strokeWidth="2"
        />
        <circle cx="45" cy="94" r="12" fill="#a899fa" fillOpacity=".12" />
        <circle cx="45" cy="94" r="5" fill="#b4a7ff" />
        <circle cx="344" cy="94" r="5" fill="#f4b570" />
        <circle cx="610" cy="94" r="12" fill="#6ee7c1" fillOpacity=".12" />
        <circle cx="610" cy="94" r="5" fill="#6ee7c1" />
        <rect x="265" y="5" width="126" height="25" rx="12" fill="#293149" />
        <text x="328" y="22" textAnchor="middle" fill="#d2c7ff" fontSize="11">
          备选：空运直达 18h
        </text>
        <rect x="277" y="51" width="133" height="24" rx="5" fill="#3d3440" />
        <text x="344" y="67" textAnchor="middle" fill="#ffc891" fontSize="11">
          ! 汉堡港 · 延迟 36h
        </text>
        <text x="45" y="123" textAnchor="middle" fill="#c1cbdc" fontSize="11">
          深圳 · 起运
        </text>
        <text x="344" y="123" textAnchor="middle" fill="#9cacc3" fontSize="11">
          汉堡 · 中转
        </text>
        <text x="610" y="123" textAnchor="middle" fill="#c1cbdc" fontSize="11">
          慕尼黑 · 工厂
        </text>
      </svg>
    </div>
  );
}

function RuntimeEvidence({ state }: { state: DemoSnapshot }) {
  return (
    <section className="runtime-panel card" id="runtime">
      <div className="panel-heading">
        <div className="panel-title">
          <span className="panel-icon">
            <Icon name="pulse" />
          </span>
          <div>
            <h2>运行时证据</h2>
            <p>这里展示实际工具返回与 Store / Tool 事件，不是预录日志。</p>
          </div>
        </div>
        <span className="event-count">{state.events.length} EVENTS</span>
      </div>
      <div className="runtime-summary">
        <span>
          Surface <b>{state.surfaceId ?? "尚未生成"}</b>
        </span>
        <span>
          Invocation <b>{state.invocation?.status ?? "idle"}</b>
        </span>
        <span>
          Host requests <b>{state.hostRequests.length}</b>
        </span>
        <span>
          Idempotency <b>{state.invocation?.lastIdempotencyKey ?? "—"}</b>
        </span>
      </div>
      <div className="event-list" aria-label="运行时事件日志">
        {state.events.length === 0 ? (
          <div className="empty-events">
            <Icon name="pulse" /> 等待第一个真实运行时事件。点击「让 Agent
            生成处置台」开始。
          </div>
        ) : (
          [...state.events].reverse().map((event) => (
            <details className={`event-row ${event.kind}`} key={event.id}>
              <summary>
                <span className="event-number">
                  {String(event.id).padStart(2, "0")}
                </span>
                <span className="event-kind">{event.kind.toUpperCase()}</span>
                <strong>{event.title}</strong>
                <code>{event.code}</code>
                <Icon name="chevron" size={14} />
              </summary>
              <p>{event.detail}</p>
            </details>
          ))
        )}
      </div>
    </section>
  );
}

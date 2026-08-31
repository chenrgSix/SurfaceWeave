import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  SurfaceRenderer,
  safeLayoutStyle,
  useSurface,
  type ReactComponentRegistry,
  type ReactComponentPack,
  type RendererComponentProps,
} from "@surfaceweave/react";
import { ConfirmationSheet, LiveMetrics, SupplyRoute } from "./App.js";
import { createDemoReactRegistry } from "./component-pack.js";
import { Icon } from "./icons.js";
import {
  StudioRuntime,
  conversationTemplates,
  pageManifests,
  type ChatMessage,
} from "./studio-runtime.js";

const StudioContext = createContext<{
  runtime: StudioRuntime;
  registry: ReactComponentRegistry;
} | null>(null);
function useStudio() {
  const context = useContext(StudioContext);
  if (!context) throw new Error("Studio provider required");
  return context;
}

export function Studio() {
  const [runtime, setRuntime] = useState(() => new StudioRuntime());
  useEffect(() => () => runtime.dispose(), [runtime]);
  return (
    <StudioSession
      runtime={runtime}
      reset={() => {
        runtime.dispose();
        setRuntime(new StudioRuntime());
      }}
    />
  );
}

function StudioSession({
  runtime,
  reset,
}: {
  runtime: StudioRuntime;
  reset: () => void;
}) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const demoState = useSyncExternalStore(
    runtime.demo.subscribe,
    runtime.demo.getSnapshot,
  );
  const page = useSurface(runtime.demo.store, runtime.pageId);
  const form = useSurface(runtime.demo.store, demoState.surfaceId!);
  const registry = useMemo(() => {
    const registry = createDemoReactRegistry(runtime.demo);
    registry.registerPack(applicationPack);
    return registry;
  }, [runtime]);
  const context = useMemo(() => ({ runtime, registry }), [runtime, registry]);
  const [draft, setDraft] = useState("");
  const [mobileTab, setMobileTab] = useState("chat");
  const [phone, setPhone] = useState(false);
  const chatScroll = useRef<HTMLDivElement>(null);
  const canvasScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatScroll.current)
      chatScroll.current.scrollTop = chatScroll.current.scrollHeight;
  }, [state.messages.length, state.messages.at(-1)?.id]);
  useEffect(() => {
    if (canvasScroll.current) canvasScroll.current.scrollTop = 0;
  }, [state.changeCount]);
  const showResponse = (send: () => void) => {
    const before = runtime.getSnapshot().changeCount;
    send();
    setMobileTab(
      runtime.getSnapshot().changeCount > before ? "preview" : "chat",
    );
  };
  const submit = (text: string) => {
    showResponse(() => runtime.submitText(text));
    setDraft("");
  };

  return (
    <StudioContext.Provider value={context}>
      <div className="studio" data-mobile-tab={mobileTab}>
        <header className="studio-header">
          <a href="?" className="studio-brand">
            <span>
              <Icon name="layers" size={22} />
            </span>
            SurfaceWeave <b>PLAYGROUND</b>
          </a>
          <div className="studio-header-right">
            <span className="studio-session-tag">
              <i /> 预设对话 · 真实运行时
            </span>
            <a href="?demo=operations" className="original-demo">
              业务流程案例 <Icon name="arrow" size={13} />
            </a>
            <button
              className="studio-new"
              onClick={() => {
                setDraft("");
                setPhone(false);
                setMobileTab("chat");
                reset();
              }}
              title="清空会话与演示数据"
            >
              <Icon name="refresh" size={14} /> 新会话
            </button>
          </div>
        </header>
        <div className="studio-mobile-tabs">
          <button
            aria-pressed={mobileTab === "chat"}
            onClick={() => setMobileTab("chat")}
          >
            对话与指令
          </button>
          <button
            aria-pressed={mobileTab === "preview"}
            onClick={() => setMobileTab("preview")}
          >
            实时应用 <span>{state.changeCount}</span>
          </button>
        </div>
        <div className="studio-layout">
          <aside className="chat-panel" aria-label="对话控制台">
            <div className="chat-heading">
              <div className="chat-agent-mark">
                <Icon name="spark" size={20} />
              </div>
              <div>
                <h1>说一句，界面就变。</h1>
                <p>从一个字段，到整个应用。</p>
              </div>
              <span className="chat-live-dot" />
            </div>
            <div
              className="chat-thread"
              ref={chatScroll}
              role="log"
              aria-label="对话记录"
              aria-live="polite"
            >
              {state.messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
            </div>
            <div className="template-shelf">
              <div className="template-heading">
                <span>试着这样说</span>
                <span>
                  点击即发送 <Icon name="arrow" size={11} />
                </span>
              </div>
              <div className="template-grid">
                {conversationTemplates.map((template) => (
                  <button
                    key={template.id}
                    className={`template-pill template-${template.id}`}
                    title={template.prompt}
                    onClick={() =>
                      showResponse(() => runtime.send(template.id))
                    }
                  >
                    <Icon name={template.icon} size={14} />
                    <span>{template.label}</span>
                    <Icon name="arrow" size={11} />
                  </button>
                ))}
              </div>
            </div>
            <form
              className="chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                submit(draft);
              }}
            >
              <label className="sr-only" htmlFor="studio-message">
                对话指令
              </label>
              <textarea
                id="studio-message"
                value={draft}
                maxLength={300}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="选择模板，或输入模板原句…"
                rows={2}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    submit(draft);
                  }
                }}
              />
              <div>
                <span>
                  <Icon name="code" size={12} /> 预设映射，无远程模型
                </span>
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="发送指令"
                >
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </form>
            <p className="chat-disclaimer">
              主题与导航变更也通过 Surface 操作执行
            </p>
          </aside>
          <section className="studio-preview" aria-label="实时应用预览">
            <div className="preview-heading">
              <div>
                <span className="preview-live">
                  <i /> LIVE APPLICATION
                </span>
                <h2>你的界面，从不定型。</h2>
              </div>
              <div className="preview-view-toggle" aria-label="预览尺寸">
                <button aria-pressed={!phone} onClick={() => setPhone(false)}>
                  桌面
                </button>
                <button aria-pressed={phone} onClick={() => setPhone(true)}>
                  窄屏
                </button>
              </div>
            </div>
            <div
              className={`application-window ${phone ? "phone-preview" : ""}`}
            >
              <div className="window-chrome">
                <span className="window-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="window-url">
                  <Icon name="shield" size={11} /> supply.weave / recovery
                </span>
                <span className="window-version">PAGE r{page.revision}</span>
              </div>
              <div className="canvas-scroll" ref={canvasScroll}>
                <SurfaceRenderer
                  surfaceId={runtime.pageId}
                  store={runtime.demo.store}
                  componentRegistry={runtime.demo.components}
                  reactComponents={registry}
                  preferredPack="studio"
                  mode={phone ? "compact" : "workspace"}
                />
              </div>
            </div>
            <div className="preview-status">
              <div
                className="change-notice"
                key={state.changeCount}
                role="status"
              >
                <span className="change-check">
                  <Icon
                    name={state.changeCount ? "check" : "pulse"}
                    size={13}
                  />
                </span>
                <div>
                  <strong>{state.lastChange}</strong>
                  <span>
                    {state.changeCount
                      ? `已完成 ${state.changeCount} 次变更 · 输入仍在同一个 Store`
                      : "点击左侧任意模板，立即改变这个应用"}
                  </span>
                </div>
              </div>
              <button
                className="undo-button"
                disabled={!state.undoDepth}
                onClick={() => runtime.undo()}
              >
                <Icon name="refresh" size={14} /> 撤销上一条
              </button>
            </div>
            <div className="studio-proof">
              <span>PAGE + FORM</span>
              <i />
              <span>
                PAGE r{page.revision} / FORM r{form.revision}
              </span>
              <i />
              <span>{demoState.hostRequests.length} 次业务请求</span>
              <span className="proof-caption">业务数据与外部执行为模拟</span>
            </div>
          </section>
        </div>
        {demoState.confirmationId && (
          <ConfirmationSheet
            demo={runtime.demo}
            surfaceId={demoState.confirmationId}
          >
            <EmbeddedSurface surfaceId={demoState.confirmationId} />
          </ConfirmationSheet>
        )}
      </div>
    </StudioContext.Provider>
  );
}

function Message({ message }: { message: ChatMessage }) {
  return (
    <article
      className={`chat-message ${message.role} ${message.rejected ? "rejected" : ""}`}
    >
      <div className="message-author">
        {message.role === "assistant" ? (
          <>
            <Icon name="spark" size={12} /> SurfaceWeave
          </>
        ) : (
          <>
            你 <span>YOU</span>
          </>
        )}
      </div>
      <p>{message.text}</p>
      {message.operations && (
        <div className="message-receipt">
          <span>
            <Icon name="check" size={12} />{" "}
            {message.preserved ? "变更已应用 · 输入保留" : "变更已应用"}
          </span>
          <code>{message.revision}</code>
          <div>
            {message.operations.map((operation) => (
              <b key={operation}>{operation}</b>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function Application({ node, children }: RendererComponentProps) {
  return (
    <div
      className="live-app"
      data-theme={String(node.props.theme)}
      data-navigation={String(node.props.navigation)}
      data-density={String(node.props.density)}
    >
      {children}
    </div>
  );
}
function Body({ children }: RendererComponentProps) {
  return <div className="live-body">{children}</div>;
}
function Navigation() {
  const { runtime } = useStudio();
  return (
    <nav className="live-nav" aria-label="应用菜单">
      <div className="live-logo">
        <span>
          <Icon name="layers" size={19} />
        </span>
        <strong>
          orbit<span>OPERATIONS</span>
        </strong>
      </div>
      <span className="nav-caption">WORKSPACE</span>
      <div className="live-nav-items">
        <button aria-label="业务总览" onClick={() => runtime.send("restore")}>
          <Icon name="grid" size={16} />
          <span>业务总览</span>
        </button>
        <button
          aria-label="恢复工作台"
          className="active"
          onClick={() => runtime.send("work-first")}
        >
          <Icon name="box" size={16} />
          <span>恢复工作台</span>
          <b>01</b>
        </button>
        <button aria-label="协作视图" onClick={() => runtime.send("split")}>
          <Icon name="link" size={16} />
          <span>协作视图</span>
        </button>
        <button aria-label="运行事件" onClick={() => runtime.send("dense")}>
          <Icon name="pulse" size={16} />
          <span>运行事件</span>
        </button>
      </div>
      <div className="nav-bottom">
        <span className="nav-user">LX</span>
        <div>
          林晓<small>供应链运营</small>
        </div>
        <i />
      </div>
    </nav>
  );
}
function Header() {
  return (
    <header className="live-header">
      <div>
        <p>
          WORKSPACE <span>/</span> INCIDENT-0842
        </p>
        <h2>让每一次中断，都有解。</h2>
      </div>
      <span className="live-environment">
        <i /> 演示环境
      </span>
    </header>
  );
}
function Content({ node, children, mode }: RendererComponentProps) {
  return (
    <div
      className="live-content"
      data-columns={String(node.layout?.columns ?? 1)}
      style={safeLayoutStyle(node.layout, mode)}
    >
      {children}
    </div>
  );
}
function Overview() {
  return (
    <section className="live-overview" id="live-overview">
      <div className="overview-copy">
        <span className="live-incident">
          <i /> 需要你的决策
        </span>
        <h3>
          关键芯片延误。
          <br />
          <em>让八条产线重新运转。</em>
        </h3>
        <p>12,800 件 MCU · 深圳 → 慕尼黑</p>
        <div className="overview-context">
          <span>运输异常</span>
          <b>+36h</b>
          <i />
          <span>恢复路径</span>
          <b>3</b>
        </div>
      </div>
      <div className="overview-visual">
        <SupplyRoute />
        <span>
          <Icon name="plane" size={13} /> 三条可选路线，等待一个决定。
        </span>
      </div>
    </section>
  );
}
function Metrics() {
  const { runtime } = useStudio();
  return (
    <LiveMetrics
      demo={runtime.demo}
      surfaceId={runtime.demo.getSnapshot().surfaceId!}
    />
  );
}

function EmbeddedSurface({
  surfaceId,
  compact = false,
}: {
  surfaceId: string;
  compact?: boolean;
}) {
  const { runtime, registry } = useStudio();
  return (
    <SurfaceRenderer
      surfaceId={surfaceId}
      store={runtime.demo.store}
      componentRegistry={runtime.demo.components}
      reactComponents={registry}
      preferredPack="operations"
      mode={compact ? "compact" : "workspace"}
      onActionIntent={runtime.demo.handleAction}
      actionStateSource={runtime.demo.tools.actionStateSource}
    />
  );
}
function Recovery({ mirror = false }: { mirror?: boolean }) {
  const { runtime } = useStudio();
  const state = useSyncExternalStore(
    runtime.demo.subscribe,
    runtime.demo.getSnapshot,
  );
  const form = useSurface(runtime.demo.store, state.surfaceId!);
  const status = state.invocation?.status;
  return (
    <section
      className={`live-recovery ${mirror ? "is-mirror" : ""}`}
      aria-label={mirror ? "共享工作台" : "主工作台"}
    >
      <div className="live-panel-heading">
        <div>
          <span className="live-panel-icon">
            <Icon name={mirror ? "link" : "box"} size={16} />
          </span>
          <h3>
            {mirror ? "协作视图" : "供应链恢复计划"}
            <small>
              {mirror ? "同一 Surface · 独立渲染" : "TOOL → SURFACE → ACTION"}
            </small>
          </h3>
        </div>
        <span className="live-revision">
          <i /> r{form.revision}
        </span>
      </div>
      <div className="live-form-body">
        {status === "error" ? (
          <div className="studio-outcome">
            <Icon name="refresh" size={30} />
            <h3>模拟承运商暂时不可用</h3>
            <p>输入与确认快照都已保留。可以安全重试。</p>
            <button
              className="button primary"
              onClick={() => runtime.demo.retry()}
            >
              使用原幂等键重试
            </button>
            <button
              className="button secondary"
              onClick={() => runtime.demo.edit()}
            >
              返回编辑
            </button>
          </div>
        ) : status === "success" ? (
          <div className="studio-outcome">
            <Icon name="check" size={30} />
            <h3>计划已执行 · 模拟回执</h3>
            <p>
              {String(state.receipt?.orderId)} · {state.hostRequests.length}{" "}
              次请求 / 1 个幂等键
            </p>
            {state.invocation?.resultSurfaceId && (
              <EmbeddedSurface surfaceId={state.invocation.resultSurfaceId} />
            )}
          </div>
        ) : (
          <EmbeddedSurface surfaceId={form.id} compact={mirror} />
        )}
        {state.notice && (
          <p className="notice" role="alert">
            {state.notice}
          </p>
        )}
      </div>
    </section>
  );
}
function Mirror() {
  return <Recovery mirror />;
}
function PrimaryRecovery() {
  return <Recovery />;
}
function Activity() {
  const { runtime } = useStudio();
  const state = useSyncExternalStore(
    runtime.demo.subscribe,
    runtime.demo.getSnapshot,
  );
  const studio = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  return (
    <section className="live-activity">
      <div className="live-panel-heading">
        <div>
          <Icon name="pulse" size={17} />
          <h3>实时运行事件</h3>
        </div>
        <span className="live-revision">LIVE</span>
      </div>
      <div className="live-activity-summary">
        <strong>{studio.changeCount}</strong>
        <span>次界面变更</span>
        <strong>{state.hostRequests.length}</strong>
        <span>次业务请求</span>
      </div>
      <div className="live-events">
        {state.events
          .slice(-4)
          .reverse()
          .map((event) => (
            <div key={event.id}>
              <i />
              <span>{event.title}</span>
              <code>{event.code}</code>
            </div>
          ))}
      </div>
    </section>
  );
}
const applicationPack: ReactComponentPack = {
  manifest: {
    protocolVersion: "1.0",
    id: "studio",
    version: "1.0.0",
    rendererKind: "react",
    priority: 50,
    components: pageManifests,
  },
  bindings: {
    StudioApplication: Application,
    StudioBody: Body,
    StudioNavigation: Navigation,
    StudioHeader: Header,
    StudioContent: Content,
    StudioOverview: Overview,
    StudioMetrics: Metrics,
    StudioRecovery: PrimaryRecovery,
    StudioMirror: Mirror,
    StudioActivity: Activity,
  },
};

import { AgentUIToolRuntime, ToolToUIRuntime } from "@surfaceweave/agent-tools";
import {
  InMemorySurfaceStore,
  componentManifestToDefinition,
  createStandardComponentRegistry,
  recommendedSurfaceResourcePolicy,
  type ActionIntent,
  type JsonObject,
  type ToolInvocation,
  type ToolSubmissionRequest,
} from "@surfaceweave/core";

import { recoveryTool, routeComparisonManifest } from "./scenario.js";

export interface Evidence {
  id: number;
  kind: "agent" | "store" | "guard" | "host";
  title: string;
  code: string;
  detail: string;
}

export interface DemoSnapshot {
  surfaceId: string | null;
  confirmationId: string | null;
  invocation: ToolInvocation | null;
  reorganized: boolean;
  checks: string[];
  preserved: boolean;
  events: Evidence[];
  hostRequests: ToolSubmissionRequest[];
  receipt: JsonObject | null;
  notice: string | null;
}

/** Demo host and scripted Agent; all UI changes go through public SDK APIs. */
export class OperationsDemo {
  readonly components = createStandardComponentRegistry();
  readonly store: InMemorySurfaceStore;
  readonly tools: ToolToUIRuntime;
  readonly agent: AgentUIToolRuntime;
  readonly #listeners = new Set<() => void>();
  readonly #unsubscribes: Array<() => void> = [];
  readonly #timers = new Set<ReturnType<typeof setTimeout>>();
  readonly #receipts = new Map<string, JsonObject>();
  #disposed = false;
  #actionSequence = 0;
  #eventSequence = 0;
  #state: DemoSnapshot = {
    surfaceId: null,
    confirmationId: null,
    invocation: null,
    reorganized: false,
    checks: [],
    preserved: false,
    events: [],
    hostRequests: [],
    receipt: null,
    notice: null,
  };

  constructor(readonly hostDelay = 1100) {
    this.components.register(
      componentManifestToDefinition(routeComparisonManifest),
    );
    this.store = new InMemorySurfaceStore(this.components, {
      resourcePolicy: recommendedSurfaceResourcePolicy,
    });
    this.tools = new ToolToUIRuntime(this.components, this.store);
    this.tools.registerTool(recoveryTool);
    this.agent = new AgentUIToolRuntime(
      this.components,
      this.store,
      undefined,
      this.tools,
    );
    this.#unsubscribes.push(
      this.tools.subscribe((event) => {
        if (event.type === "tool.inputChanged") return;
        this.#record(
          "store",
          eventTitles[event.type] ?? event.type,
          event.type,
          `${event.invocationId} · ${event.status} · sequence ${event.sequence}`,
        );
      }),
    );
    this.#unsubscribes.push(
      this.tools.onInvocationRequested((request) => this.#execute(request)),
    );
  }

  getSnapshot = (): DemoSnapshot => this.#state;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  start() {
    if (this.#disposed || this.#state.surfaceId !== null) return;
    const result = this.agent.createToolSurface({
      toolId: recoveryTool.id,
      surfaceId: "incident-recovery",
      initialValues: {
        route: "air",
        owner: "林晓 · 供应链运营",
        note: "优先保障慕尼黑工厂 A 线，到货后通知夜班主管。",
        approval: false,
      },
    });
    if (!result.ok) {
      this.#patch({ notice: result.error.message });
      return;
    }
    const { surface, invocation } = result.value;
    const labelResult = this.agent.applyOperations({
      surfaceId: surface.id,
      baseRevision: surface.revision,
      reason: "使用中文业务提交标签",
      operations: [
        {
          type: "setProps",
          target: surface.tree.id,
          props: { submitLabel: "核对并提交计划" },
        },
      ],
    });
    if (!labelResult.ok) throw new Error(labelResult.error.message);
    this.#patch({ surfaceId: surface.id, invocation });
    this.#unsubscribes.push(
      this.store.subscribe(surface.id, (event, current) => {
        const active = this.tools.inspectInvocation(invocation.id);
        const invalidated =
          this.#state.confirmationId !== null && active.status === "editing";
        this.#patch({
          invocation: active,
          ...(invalidated
            ? {
                confirmationId: null,
                notice: "输入已变更，之前的确认已失效。请重新核对并提交。",
              }
            : {}),
        });
        if (event.type === "surface.dataChanged") {
          this.#record(
            "store",
            "字段已写入共享 Store",
            event.type,
            `同一 Surface · revision ${current.revision} · ${event.changes.map((change) => change.path).join(", ")}`,
          );
        }
      }),
    );
    this.#record(
      "agent",
      "由 Tool Schema 生成处置表单",
      "ui.createToolSurface",
      "4 个字段由注册工具生成；数据、组件树与执行权限分离。没有执行外部业务请求。",
    );
  }

  reorganize() {
    if (!this.#canEdit() || this.#state.reorganized) return;
    const surface = this.store.requireSurface(this.#state.surfaceId!);
    const before = JSON.stringify(surface.data);
    const result = this.agent.applyOperations({
      surfaceId: surface.id,
      baseRevision: surface.revision,
      reason: "对比恢复路线，并将必须人工核对的审批区前置",
      operations: [
        {
          type: "replaceComponent",
          target: "route",
          component: "RouteComparison",
        },
        {
          type: "groupNodes",
          targets: ["owner", "approval"],
          group: {
            id: "decision-gate",
            component: "Section",
            props: { title: "执行前核对" },
            layout: { gap: 12 },
          },
        },
        { type: "moveNode", target: "decision-gate", position: "first" },
        {
          type: "setProps",
          target: "note",
          props: { label: "交接备注 · 重组后完整保留" },
        },
      ],
    });
    if (!result.ok) {
      this.#patch({ notice: result.error.message });
      return;
    }
    const preserved =
      JSON.stringify(this.store.requireSurface(surface.id).data) === before;
    this.#patch({ reorganized: true, preserved, notice: null });
    this.#record(
      "agent",
      "界面结构改变，业务数据保留",
      "ui.applyOperations",
      `4 个原子操作 · replaceComponent + groupNodes + moveNode + setProps · data ${preserved ? "unchanged" : "changed"}`,
    );
  }

  challenge(kind: "constraint" | "revision") {
    if (!this.#canEdit()) return;
    const before = this.store.requireSurface(this.#state.surfaceId!);
    const result = this.agent.applyOperations({
      surfaceId: before.id,
      baseRevision: kind === "revision" ? before.revision - 1 : before.revision,
      reason:
        kind === "constraint"
          ? "挑战：隐藏强制审批字段"
          : "挑战：使用过期版本覆盖用户界面",
      operations:
        kind === "constraint"
          ? [
              {
                type: "setProps",
                target: "note",
                props: { label: "这项也不应被应用" },
              },
              { type: "setVisibility", target: "approval", visible: false },
            ]
          : [
              {
                type: "setProps",
                target: "note",
                props: { label: "过期 Agent 修改" },
              },
            ],
    });
    const intact =
      JSON.stringify(before) ===
      JSON.stringify(this.store.requireSurface(before.id));
    const expected =
      kind === "constraint" ? "HARD_CONSTRAINT_VIOLATION" : "REVISION_CONFLICT";
    if (!result.ok && result.error.code === expected && intact) {
      this.#patch({
        checks: [...new Set([...this.#state.checks, kind])],
        notice: null,
      });
      this.#record(
        "guard",
        kind === "constraint"
          ? "越权操作被拦截，整批修改未生效"
          : "过期写入被拒绝，当前版本保留",
        result.error.code,
        `${result.error.message} · Surface 和 data 均未改变`,
      );
    } else {
      this.#patch({
        notice: `挑战未得到预期拒绝：${result.ok ? "操作被接受" : result.error.code}，请查看运行时。`,
      });
    }
  }

  handleAction = (intent: ActionIntent) => {
    if (this.#disposed) return;
    // Navigation back from confirmation is a host UX action. A fresh request
    // for confirmation is required by ToolToUIRuntime before submission.
    try {
      this.#patch({ notice: null });
      const outcome = this.tools.handleAction(intent);
      this.#patch({
        invocation: this.tools.inspectInvocation(outcome.invocation.id),
        confirmationId:
          outcome.kind === "confirmation-required"
            ? outcome.confirmationSurface.id
            : null,
      });
    } catch (error) {
      this.#patch({
        notice: error instanceof Error ? error.message : String(error),
      });
    }
  };

  edit() {
    this.#dispatch("tool.edit");
  }
  retry() {
    this.#dispatch("tool.retry");
  }

  dispose() {
    this.#disposed = true;
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers.clear();
    for (const unsubscribe of this.#unsubscribes) unsubscribe();
    this.tools.dispose();
    this.#listeners.clear();
  }

  #canEdit() {
    return (
      !this.#disposed &&
      this.#state.surfaceId !== null &&
      this.#state.invocation?.status === "editing"
    );
  }

  #dispatch(action: string) {
    if (
      this.#disposed ||
      this.#state.surfaceId === null ||
      this.#state.invocation === null
    )
      return;
    const surface = this.store.requireSurface(this.#state.surfaceId);
    this.handleAction({
      id: `host-action-${++this.#actionSequence}`,
      surfaceId: surface.id,
      nodeId: surface.tree.id,
      action,
      input: { invocationId: this.#state.invocation.id },
    });
  }

  #execute(request: ToolSubmissionRequest) {
    this.#patch({
      hostRequests: [...this.#state.hostRequests, request],
      confirmationId: null,
    });
    this.tools.markInvocationStarted(request.invocationId);
    this.#record(
      "host",
      "模拟宿主收到已确认的请求",
      "host.execute",
      `idempotencyKey: ${request.idempotencyKey} · 不读取当前表单，使用已确认快照`,
    );
    const timer = setTimeout(() => {
      this.#timers.delete(timer);
      if (this.#disposed) return;
      const attempts = this.#state.hostRequests.filter(
        (item) => item.idempotencyKey === request.idempotencyKey,
      ).length;
      if (attempts === 1) {
        this.tools.rejectInvocation(request.invocationId, {
          code: "CARRIER_TEMPORARILY_UNAVAILABLE",
          message: "模拟承运商暂时不可用；请求尚未创建运单，可安全重试。",
          retryable: true,
        });
      } else {
        // Simulated server-side idempotency, distinct from UI intent deduplication.
        const receipt = this.#receipts.get(request.idempotencyKey) ?? {
          orderId: "REC-2026-0842",
          route: request.validatedArguments.route!,
          status: "已创建 · 模拟运单",
        };
        this.#receipts.set(request.idempotencyKey, receipt);
        this.tools.resolveInvocation(request.invocationId, receipt);
        this.#patch({ receipt });
      }
      this.#patch({
        invocation: this.tools.inspectInvocation(request.invocationId),
      });
    }, this.hostDelay);
    this.#timers.add(timer);
  }

  #record(kind: Evidence["kind"], title: string, code: string, detail: string) {
    this.#patch({
      events: [
        ...this.#state.events.slice(-39),
        { id: ++this.#eventSequence, kind, title, code, detail },
      ],
    });
  }
  #patch(patch: Partial<DemoSnapshot>) {
    this.#state = { ...this.#state, ...patch };
    for (const listener of this.#listeners) listener();
  }
}

const eventTitles: Record<string, string> = {
  "tool.surfaceCreated": "生成输入 Surface",
  "tool.confirmationRequested": "生成确认 Surface，绑定当前输入快照",
  "tool.invocationRequested": "人工确认完成，允许交给宿主",
  "tool.invocationStarted": "宿主开始处理请求",
  "tool.invocationFailed": "模拟承运商失败，可恢复",
  "tool.retryRequested": "安全重试，复用原幂等键",
  "tool.invocationSucceeded": "执行成功，生成回执",
  "result.surfaceCreated": "结果已生成独立 Surface",
  "tool.validationFailed": "校验未通过，未发送业务请求",
};

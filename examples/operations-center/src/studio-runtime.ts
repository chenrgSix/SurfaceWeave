import {
  cloneValue,
  componentManifestToDefinition,
  type ComponentManifest,
  type Surface,
  type UINode,
  type UIOperation,
} from "@surfaceweave/core";
import { OperationsDemo } from "./demo-runtime.js";

export const PAGE_ID = "live-application";
const enumProp = (...values: string[]) => ({ type: "string", enum: values });
export const pageManifests: ComponentManifest[] = [
  {
    semanticType: "StudioApplication",
    description:
      "Trusted application shell with allow-listed theme and navigation variants.",
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        theme: enumProp("light", "midnight", "mint", "paper"),
        navigation: enumProp("side", "top"),
        density: enumProp("comfortable", "compact"),
      },
    },
  },
  ...[
    "StudioNavigation",
    "StudioBody",
    "StudioHeader",
    "StudioContent",
    "StudioOverview",
    "StudioMetrics",
    "StudioRecovery",
    "StudioMirror",
    "StudioActivity",
  ].map((semanticType): ComponentManifest => ({
    semanticType,
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  })),
];

function node(id: string, component: string, children?: UINode[]): UINode {
  return {
    id,
    stableId: id,
    component,
    props: {},
    ...(children ? { children } : {}),
  };
}

const initialPage: Omit<Surface, "revision"> = {
  id: PAGE_ID,
  intent: "browse",
  context: { source: "host.application-shell" },
  data: {},
  tree: {
    ...node("application", "StudioApplication", [
      node("navigation", "StudioNavigation"),
      node("page-body", "StudioBody", [
        node("page-header", "StudioHeader"),
        {
          ...node("content", "StudioContent", [
            node("overview", "StudioOverview"),
            node("metrics", "StudioMetrics"),
            node("recovery", "StudioRecovery"),
            { ...node("mirror", "StudioMirror"), visible: false },
            { ...node("activity", "StudioActivity"), visible: false },
          ]),
          layout: { columns: 1, gap: 18 },
        },
      ]),
    ]),
    props: { theme: "light", navigation: "side", density: "comfortable" },
  },
};

export const conversationTemplates = [
  {
    id: "midnight",
    icon: "spark",
    label: "午夜紫",
    prompt: "换成午夜紫主题，整个页面都要变。",
    reply:
      "整个应用已切换为午夜紫。导航、图表、方案卡和表单一起变化，数据保持不变。",
    tag: "整页主题",
  },
  {
    id: "top-nav",
    icon: "layers",
    label: "菜单到顶部",
    prompt: "把左侧菜单移到顶部，给内容更多空间。",
    reply:
      "导航已从侧边移到内容上方。不是隐藏菜单：节点实际换了位置，主区域获得更宽的空间。",
    tag: "结构移动",
  },
  {
    id: "cards",
    icon: "grid",
    label: "表单变决策卡",
    prompt: "把运输方案变成对比卡片，审批放到前面。",
    reply:
      "普通选择框已替换为业务方案卡，审批区前置。你刚输入的负责人和备注都还在。",
    tag: "组件进化",
  },
  {
    id: "focus",
    icon: "plane",
    label: "进入专注模式",
    prompt: "进入专注模式，只保留我正在编辑的处置表单。",
    reply:
      "概览和指标已收起，工作台成为唯一焦点。内容暂时隐藏，字段没有删除，也没有清空。",
    tag: "整页重组",
  },
  {
    id: "split",
    icon: "link",
    label: "打开双视图",
    prompt: "把工作台变成双栏，右边实时同步我的输入。",
    reply:
      "已展开两个独立渲染的工作台，共享同一个 Surface。试着从任意一侧修改备注。",
    tag: "共享状态",
  },
  {
    id: "mint",
    icon: "spark",
    label: "薄荷绿",
    prompt: "换成清爽的薄荷绿，保留现在的布局。",
    reply: "已切换薄荷绿主题。布局和业务组件没有被重置，可以继续叠加其他变更。",
    tag: "自由组合",
  },
  {
    id: "work-first",
    icon: "arrow",
    label: "工作台置顶",
    prompt: "把处置工作台放到最上面，概览移到后面。",
    reply:
      "工作台已被移动到内容区第一位。相同稳定节点、相同输入，只改变信息的先后顺序。",
    tag: "信息重排",
  },
  {
    id: "paper",
    icon: "book",
    label: "变成简报",
    prompt: "把整个页面变成暖色简报，恢复概览和指标。",
    reply:
      "已切换暖色简报：顶部导航、完整概览、单栏正文。主题与结构在一个批次里一起改变。",
    tag: "风格与结构",
  },
  {
    id: "dense",
    icon: "grid",
    label: "紧凑布局",
    prompt: "切成紧凑布局，显示运行事件，减少页面留白。",
    reply:
      "密度已收紧，实时事件面板已加入页面。运行证据和业务表单并排出现在同一个应用中。",
    tag: "内容增减",
  },
  {
    id: "restore",
    icon: "refresh",
    label: "恢复页面布局",
    prompt: "恢复初始页面布局，但不要清空我的输入。",
    reply:
      "页面外壳已恢复浅色、侧边导航和默认布局。业务表单、所选方案和输入保持原样。",
    tag: "保留数据",
  },
] as const;

export type TemplateId = (typeof conversationTemplates)[number]["id"];
export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  revision?: string;
  operations?: string[];
  preserved?: boolean;
  rejected?: boolean;
}
interface UndoEntry {
  before: Surface;
  label: string;
}
export interface StudioSnapshot {
  messages: ChatMessage[];
  undoDepth: number;
  changeCount: number;
  lastChange: string;
  lastTargets: string[];
}

/** No model inference. Fixed chat templates issue real, validated SDK mutations. */
export class StudioRuntime {
  readonly demo = new OperationsDemo();
  readonly pageId = PAGE_ID;
  readonly #history: UndoEntry[] = [];
  readonly #listeners = new Set<() => void>();
  #sequence = 0;
  #disposed = false;
  #state: StudioSnapshot = {
    messages: [],
    undoDepth: 0,
    changeCount: 0,
    lastChange: "等待你的第一条指令",
    lastTargets: [],
  };

  constructor() {
    for (const manifest of pageManifests)
      this.demo.components.register(componentManifestToDefinition(manifest));
    this.demo.start();
    this.demo.store.createSurface(cloneValue(initialPage));
    this.#message({
      role: "assistant",
      text: "这次，界面听你说。右边是一整个正在运行的应用。选一句指令，看它改变主题、搬动导航、重组布局——也可以先写一句备注，看看它会不会丢。",
    });
  }
  getSnapshot = () => this.#state;
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  send(id: TemplateId) {
    if (this.#disposed) return;
    const template = conversationTemplates.find(
      (template) => template.id === id,
    );
    if (!template) return;
    this.#message({ role: "user", text: template.prompt });
    const form = this.demo.store.requireSurface(
      this.demo.getSnapshot().surfaceId!,
    );
    const before =
      id === "cards" ? form : this.demo.store.requireSurface(PAGE_ID);
    if (
      id === "cards" &&
      this.demo.getSnapshot().invocation?.status !== "editing"
    ) {
      this.#message({
        role: "assistant",
        text: "当前表单正在确认或执行。请先返回编辑；主题和页面布局仍然可以调整。",
        rejected: true,
      });
      return;
    }
    let operations: UIOperation[];
    if (id === "cards") {
      if (findNode(before.tree, "route")?.component === "RouteComparison") {
        this.#message({
          role: "assistant",
          text: "方案已经是对比卡片了。试试双栏、简报或另一种主题，也可以撤销最近的变更。",
        });
        return;
      }
      operations = [
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
      ];
    } else if (id === "restore") {
      this.#replace(
        before,
        initialPage.tree,
        template.label,
        template.reply,
        form,
      );
      return;
    } else operations = pageOperations(id);
    const result = this.demo.agent.applyOperations({
      surfaceId: before.id,
      baseRevision: before.revision,
      reason: template.prompt,
      operations,
    });
    if (!result.ok) {
      this.#message({
        role: "assistant",
        text: `${result.error.code}: ${result.error.message}`,
        rejected: true,
      });
      return;
    }
    this.#accepted(
      before,
      result.value,
      template.label,
      template.reply,
      form,
      operations.map((operation) => operation.type),
      operations.flatMap((operation) =>
        "target" in operation ? [operation.target] : operation.targets,
      ),
    );
  }

  submitText(text: string) {
    if (this.#disposed || text.trim() === "") return;
    const match = conversationTemplates.find(
      (template) =>
        template.prompt === text.trim() || template.label === text.trim(),
    );
    if (match) {
      this.send(match.id);
      return;
    }
    this.#message({ role: "user", text: text.trim().slice(0, 300) });
    this.#message({
      role: "assistant",
      text: "这是可重复的预设对话演示，尚未连接语言模型。请点击下方模板，或输入模板原句；我不会猜测并执行未注册指令。",
      rejected: true,
    });
  }

  undo() {
    if (this.#disposed) return;
    const entry = this.#history.at(-1);
    if (!entry) return;
    this.#message({
      role: "user",
      text: `撤销刚才的「${entry.label}」，保留现在的输入。`,
    });
    if (
      entry.before.id !== PAGE_ID &&
      this.demo.getSnapshot().invocation?.status !== "editing"
    ) {
      this.#message({
        role: "assistant",
        text: "请先返回表单编辑，再撤销业务组件变更。确认或执行中的参数不会被这里覆盖。",
        rejected: true,
      });
      return;
    }
    const current = this.demo.store.requireSurface(entry.before.id);
    const result = this.demo.agent.replaceSurface({
      surfaceId: current.id,
      baseRevision: current.revision,
      surface: replacement(current, entry.before.tree),
    });
    if (!result.ok) {
      this.#message({
        role: "assistant",
        text: result.error.message,
        rejected: true,
      });
      return;
    }
    this.#history.pop();
    this.#state = {
      ...this.#state,
      undoDepth: this.#history.length,
      changeCount: this.#state.changeCount + 1,
      lastChange: `已撤销 ${entry.label}`,
      lastTargets: [entry.before.tree.id],
    };
    this.#message({
      role: "assistant",
      text: `已撤销「${entry.label}」。恢复的是界面结构，输入仍使用当前值，没有回滚成旧数据。`,
      revision: `r${current.revision} → r${result.value.revision}`,
      operations: ["replaceSurface"],
      preserved: true,
    });
  }

  dispose() {
    this.#disposed = true;
    this.demo.dispose();
    this.#listeners.clear();
    this.#history.length = 0;
  }

  #replace(
    before: Surface,
    tree: UINode,
    label: string,
    reply: string,
    form: Surface,
  ) {
    const result = this.demo.agent.replaceSurface({
      surfaceId: before.id,
      baseRevision: before.revision,
      surface: replacement(before, tree),
    });
    if (!result.ok) {
      this.#message({
        role: "assistant",
        text: result.error.message,
        rejected: true,
      });
      return;
    }
    this.#accepted(
      before,
      result.value,
      label,
      reply,
      form,
      ["replaceSurface"],
      ["application"],
    );
  }
  #accepted(
    before: Surface,
    after: Surface,
    label: string,
    reply: string,
    form: Surface,
    operations: string[],
    targets: string[],
  ) {
    this.#history.push({ before, label });
    if (this.#history.length > 40) this.#history.shift();
    const preserved =
      JSON.stringify(form.data) ===
      JSON.stringify(this.demo.store.requireSurface(form.id).data);
    this.#state = {
      ...this.#state,
      undoDepth: this.#history.length,
      changeCount: this.#state.changeCount + 1,
      lastChange: label,
      lastTargets: [...new Set(targets)],
    };
    this.#message({
      role: "assistant",
      text: reply,
      revision: `r${before.revision} → r${after.revision}`,
      operations: [...new Set(operations)],
      preserved,
    });
  }
  #message(message: Omit<ChatMessage, "id">) {
    this.#state = {
      ...this.#state,
      messages: [
        ...this.#state.messages.slice(-79),
        { ...message, id: ++this.#sequence },
      ],
    };
    for (const listener of this.#listeners) listener();
  }
}

function replacement(surface: Surface, tree: UINode) {
  // Always retain live data, not the data embedded in the undo snapshot.
  return {
    intent: surface.intent,
    data: surface.data,
    context: surface.context,
    tree: cloneValue(tree),
    ...(surface.schemaRef ? { schemaRef: surface.schemaRef } : {}),
  };
}
export function findNode(root: UINode, id: string): UINode | undefined {
  if (root.id === id || root.stableId === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

function pageOperations(
  id: Exclude<TemplateId, "cards" | "restore">,
): UIOperation[] {
  const theme = (theme: string): UIOperation => ({
    type: "setProps",
    target: "application",
    props: { theme },
  });
  const show = (target: string, visible: boolean): UIOperation => ({
    type: "setVisibility",
    target,
    visible,
  });
  const columns = (columns: number): UIOperation => ({
    type: "setLayout",
    target: "content",
    layout: { columns, gap: 18, modes: { compact: { columns: 1 } } },
  });
  const topNav: UIOperation[] = [
    {
      type: "moveNode",
      target: "navigation",
      parent: "page-body",
      position: "first",
    },
    { type: "setProps", target: "application", props: { navigation: "top" } },
  ];
  switch (id) {
    case "midnight":
      return [theme("midnight")];
    case "mint":
      return [theme("mint")];
    case "top-nav":
      return topNav;
    case "work-first":
      return [
        {
          type: "moveNode",
          target: "recovery",
          parent: "content",
          position: "first",
        },
      ];
    case "focus":
      return [
        ...topNav,
        show("overview", false),
        show("metrics", false),
        show("mirror", false),
        show("activity", false),
        columns(1),
      ];
    case "split":
      return [
        ...topNav,
        show("overview", false),
        show("metrics", false),
        show("activity", false),
        show("mirror", true),
        columns(2),
        { type: "moveNode", target: "recovery", position: "first" },
        { type: "moveNode", target: "mirror", position: 1 },
      ];
    case "paper":
      return [
        theme("paper"),
        ...topNav,
        {
          type: "setProps",
          target: "application",
          props: { density: "comfortable" },
        },
        show("overview", true),
        show("metrics", true),
        show("mirror", false),
        show("activity", false),
        columns(1),
        { type: "moveNode", target: "overview", position: "first" },
        { type: "moveNode", target: "metrics", position: 1 },
      ];
    case "dense":
      return [
        {
          type: "setProps",
          target: "application",
          props: { density: "compact" },
        },
        show("activity", true),
        show("mirror", false),
        columns(1),
        {
          type: "setLayout",
          target: "content",
          layout: { columns: 1, gap: 10 },
        },
      ];
  }
}

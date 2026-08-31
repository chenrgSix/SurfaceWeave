// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { cloneValue, type UINode } from "@surfaceweave/core";
import { StudioSession } from "../src/Studio.js";
import { StudioRuntime, PAGE_ID, findNode } from "../src/studio-runtime.js";
import {
  validateModelOperations,
  validateModelPage,
} from "../src/model-policy.js";
import { paletteStyle } from "../src/studio-schema.js";
import {
  dynamicPage,
  finishedReply,
  pageReply,
} from "./fixtures/dynamic-page.js";

const instances: StudioRuntime[] = [];
function runtime() {
  const value = new StudioRuntime();
  value.configureModel({
    endpoint: "https://fixture.example/v1",
    model: "protocol-fixture",
    apiKey: "fixture-key",
  });
  instances.push(value);
  return value;
}
afterEach(() => {
  instances.splice(0).forEach((value) => value.dispose());
  vi.unstubAllGlobals();
});
function input(tree: UINode) {
  return { surfaceId: PAGE_ID, baseRevision: 0, tree };
}

it("renders a model-authored tree through the real SDK and preserves current input through rebuild and undo", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const value = runtime();
  const before = value.demo.store.requireSurface(PAGE_ID);
  const form = value.demo.store.requireSurface("incident-recovery");
  value.demo.store.updateData(form.id, form.revision, [
    { path: "note", value: "private input before redesign" },
  ]);
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(pageReply(dynamicPage()))
    .mockResolvedValueOnce(finishedReply());
  vi.stubGlobal("fetch", fetcher);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(() =>
      root.render(<StudioSession runtime={value} reset={() => undefined} />),
    );
    await act(() =>
      value.askModel("右侧菜单、天空蓝，重建为带全新信息卡片的页面"),
    );
    expect(
      container.querySelector(".live-app")?.lastElementChild?.tagName,
    ).toBe("NAV");
    expect(
      container
        .querySelector<HTMLElement>(".live-app")
        ?.style.getPropertyValue("--page"),
    ).toBe("#edf7ff");
    expect(
      container.querySelector(".live-generated-card h3")?.textContent,
    ).toBe("天空蓝调度指挥台");
    expect(container.querySelectorAll(".live-generated-stat")).toHaveLength(2);
    expect(
      container
        .querySelector(".live-generated-children[style*=grid]")
        ?.getAttribute("style"),
    ).toContain("repeat(2");
    expect(container.querySelector(".live-overview")).toBeNull();
    expect(
      container.querySelector<HTMLTextAreaElement>(".live-app textarea")?.value,
    ).toBe("private input before redesign");
    expect(value.demo.store.requireSurface(PAGE_ID).tree).toEqual(
      dynamicPage(),
    );
    const receipt = value
      .getSnapshot()
      .messages.find((message) => message.receipt);
    expect(receipt?.operations).toEqual(["replaceSurface"]);
    expect(receipt?.receipt?.status).toBe("applied");
    expect(JSON.parse(receipt!.receipt!.result)).toMatchObject({
      beforeTree: before.tree,
      afterTree: dynamicPage(),
      afterRevision: 1,
    });
    const payload = JSON.parse(String(fetcher.mock.calls[0]![1]?.body));
    expect(
      payload.tools.map(
        (tool: { function: { name: string } }) => tool.function.name,
      ),
    ).toEqual(["ui_apply_operations", "ui_replace_page"]);
    for (const [, init] of fetcher.mock.calls)
      expect(String(init?.body)).not.toContain("private input before redesign");
    await act(() => {
      const current = value.demo.store.requireSurface(form.id);
      value.demo.store.updateData(form.id, current.revision, [
        { path: "note", value: "new input after redesign" },
      ]);
      value.undo();
    });
    expect(value.demo.store.requireSurface(PAGE_ID).tree).toEqual(before.tree);
    expect(
      container.querySelector(".live-app")?.firstElementChild?.tagName,
    ).toBe("NAV");
    expect(
      container.querySelector<HTMLTextAreaElement>(".live-app textarea")?.value,
    ).toBe("new input after redesign");
    expect(value.demo.getSnapshot().hostRequests).toEqual([]);
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});

it.each(["left", "right", "top", "bottom"] as const)(
  "renders %s navigation at the actual corresponding tree edge",
  async (edge) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const value = runtime();
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(pageReply(dynamicPage(edge)))
        .mockResolvedValueOnce(finishedReply()),
    );
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(() =>
        root.render(<StudioSession runtime={value} reset={() => undefined} />),
      );
      await act(() => value.askModel("移动菜单"));
      const parent = container.querySelector(
        edge === "top" || edge === "bottom" ? ".live-body" : ".live-app",
      );
      expect(
        (edge === "right" || edge === "bottom"
          ? parent?.lastElementChild
          : parent?.firstElementChild
        )?.tagName,
      ).toBe("NAV");
      expect(
        container.querySelector(".live-app")?.getAttribute("data-navigation"),
      ).toBe(edge);
    } finally {
      await act(() => root.unmount());
    }
  },
);

it("accepts custom palette and rightward move in one atomic operations batch, then clears palette with a theme preset", () => {
  const value = runtime();
  const before = value.demo.store.requireSurface(PAGE_ID);
  const operations = [
    {
      type: "setProps",
      target: "application",
      props: {
        navigation: "right",
        palette: { background: "#87ceeb", accent: "#1269AB" },
      },
    },
    {
      type: "moveNode",
      target: "navigation",
      parent: "application",
      position: "last",
    },
  ];
  const checked = validateModelOperations(
    {
      surfaceId: PAGE_ID,
      baseRevision: before.revision,
      reason: "protocol fixture",
      operations,
    },
    before,
    value.demo.components,
  );
  expect(value.demo.agent.applyOperations(checked).ok).toBe(true);
  expect(value.demo.store.requireSurface(PAGE_ID).tree.props.palette).toEqual({
    background: "#87ceeb",
    accent: "#1269AB",
  });
  value.send("midnight");
  expect(value.demo.store.requireSurface(PAGE_ID).tree.props.palette).toEqual(
    {},
  );
  expect(
    paletteStyle({
      background: "url(https://evil.example)",
      accent: "#1269AB",
      position: "fixed",
    }),
  ).toEqual({ "--accent": "#1269AB" });
});

const invalidTrees: Array<[string, (tree: UINode) => void]> = [
  [
    "CSS color injection",
    (tree) => {
      tree.props.palette = { accent: "red;display:none" };
    },
  ],
  [
    "unknown palette token",
    (tree) => {
      tree.props.palette = { css: "#123456" };
    },
  ],
  [
    "missing recovery",
    (tree) => {
      findNode(tree, "workspace-wrap")!.children = [];
    },
  ],
  [
    "hidden recovery ancestor",
    (tree) => {
      findNode(tree, "workspace-wrap")!.visible = false;
    },
  ],
  [
    "wrong navigation edge",
    (tree) => {
      tree.props.navigation = "left";
    },
  ],
  [
    "copied host component",
    (tree) => {
      findNode(tree, "content")!.children!.push({
        id: "fake-form",
        component: "StudioRecovery",
        props: {},
      });
    },
  ],
  [
    "protected identity change",
    (tree) => {
      findNode(tree, "recovery")!.stableId = "new-recovery";
    },
  ],
  [
    "identity alias",
    (tree) => {
      findNode(tree, "stat-a")!.stableId = "recovery";
    },
  ],
  [
    "business binding",
    (tree) => {
      findNode(tree, "dispatch-copy")!.binding = {
        path: "note",
        valueType: "string",
      };
    },
  ],
  [
    "business component",
    (tree) => {
      findNode(tree, "stat-a")!.component = "Form";
    },
  ],
  [
    "unsupported layout",
    (tree) => {
      findNode(tree, "content")!.layout = { position: "fixed" };
    },
  ],
  [
    "children in a leaf",
    (tree) => {
      findNode(tree, "stat-a")!.children = [
        cloneValue(findNode(tree, "recovery")!),
      ];
      findNode(tree, "workspace-wrap")!.children = [];
    },
  ],
  [
    "resource node limit",
    (tree) => {
      findNode(tree, "content")!.children!.push(
        ...Array.from({ length: 150 }, (_, i) => ({
          id: `extra-${i}`,
          component: "Text",
          props: { text: "extra" },
        })),
      );
    },
  ],
  [
    "resource depth limit",
    (tree) => {
      let child = findNode(tree, "workspace-wrap")!;
      for (let i = 0; i < 12; i++) {
        const next = {
          id: `deep-${i}`,
          component: "Stack",
          props: {},
          children: child.children ?? [],
        };
        child.children = [next];
        child = next;
      }
    },
  ],
];
it.each(invalidTrees)(
  "rejects %s without mutation or host requests",
  async (_name, mutate) => {
    const value = runtime();
    const before = value.demo.store.requireSurface(PAGE_ID);
    const tree = dynamicPage();
    mutate(tree);
    expect(() =>
      validateModelPage(input(tree), before, value.demo.components),
    ).toThrow();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(pageReply(tree)),
    );
    await value.askModel("尝试重建页面");
    expect(value.demo.store.requireSurface(PAGE_ID)).toEqual(before);
    expect(value.getSnapshot().messages.at(-1)?.receipt?.status).toBe(
      "rejected",
    );
    expect(value.demo.getSnapshot().hostRequests).toEqual([]);
  },
);

it("rejects data/context replacement and use of page replacement on the business Surface", () => {
  const value = runtime();
  const before = value.demo.store.requireSurface(PAGE_ID);
  expect(() =>
    validateModelPage(
      { ...input(dynamicPage()), data: { approval: true } },
      before,
      value.demo.components,
    ),
  ).toThrow();
  expect(() =>
    validateModelPage(
      { ...input(dynamicPage()), context: {} },
      before,
      value.demo.components,
    ),
  ).toThrow();
  expect(() =>
    validateModelPage(
      input(dynamicPage()),
      value.demo.store.requireSurface("incident-recovery"),
      value.demo.components,
    ),
  ).toThrow();
});

it.each(["stale", "cancel"])(
  "ignores a %s page replacement without overwriting the current tree",
  async (mode) => {
    const value = runtime();
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      ),
    );
    const pending = value.askModel("重新设计页面");
    if (mode === "cancel") value.cancelModel();
    else
      value.demo.agent.applyOperations({
        surfaceId: PAGE_ID,
        baseRevision: 0,
        reason: "concurrent edit",
        operations: [
          { type: "setProps", target: "application", props: { theme: "mint" } },
        ],
      });
    const current = cloneValue(value.demo.store.requireSurface(PAGE_ID));
    resolve(pageReply(dynamicPage()));
    await pending;
    expect(value.demo.store.requireSurface(PAGE_ID)).toEqual(current);
    expect(value.getSnapshot().changeCount).toBe(0);
  },
);

it("keeps the independent business confirmation intact across full page replacement and undo", async () => {
  const value = runtime();
  const form = value.demo.store.requireSurface("incident-recovery");
  value.demo.store.updateData(form.id, form.revision, [
    { path: "approval", value: true },
  ]);
  value.demo.handleAction({
    id: "confirm",
    surfaceId: form.id,
    nodeId: form.tree.id,
    action: "tool.submit",
    input: { invocationId: value.demo.getSnapshot().invocation!.id },
  });
  const confirmationId = value.demo.getSnapshot().confirmationId;
  expect(confirmationId).not.toBeNull();
  const confirmation = cloneValue(
    value.demo.store.requireSurface(confirmationId!),
  );
  const currentForm = cloneValue(value.demo.store.requireSurface(form.id));
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(pageReply(dynamicPage()))
      .mockResolvedValueOnce(finishedReply()),
  );
  await value.askModel("重新设计页面，但保留确认步骤");
  expect(
    value.getSnapshot().messages.find((message) => message.receipt)?.receipt
      ?.status,
  ).toBe("applied");
  value.undo();
  expect(value.demo.getSnapshot().confirmationId).toBe(confirmationId);
  expect(value.demo.store.requireSurface(confirmationId!)).toEqual(
    confirmation,
  );
  expect(value.demo.store.requireSurface(form.id)).toEqual(currentForm);
  expect(value.demo.getSnapshot().hostRequests).toEqual([]);
});

it("does not silently reset a rebuilt page when a fixed template references removed panels", async () => {
  const value = runtime();
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(pageReply(dynamicPage()))
      .mockResolvedValueOnce(finishedReply()),
  );
  await value.askModel("重新组织页面");
  const before = cloneValue(value.demo.store.requireSurface(PAGE_ID));
  value.send("split");
  expect(value.demo.store.requireSurface(PAGE_ID)).toEqual(before);
  expect(value.getSnapshot().messages.at(-1)).toMatchObject({ rejected: true });
  expect(value.getSnapshot().messages.at(-1)?.text).toContain("恢复页面布局");
  value.send("restore");
  expect(
    findNode(value.demo.store.requireSurface(PAGE_ID).tree, "mirror"),
  ).toBeDefined();
});

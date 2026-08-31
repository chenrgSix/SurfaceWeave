import { afterEach, expect, it, vi } from "vitest";
import { StudioRuntime, PAGE_ID } from "../src/studio-runtime.js";

const instances: StudioRuntime[] = [];
const config = {
  endpoint: "https://provider.example/v1",
  model: "user-model",
  apiKey: "test-only-secret",
};
function studio() {
  const value = new StudioRuntime();
  value.configureModel(config);
  instances.push(value);
  return value;
}
const jsonReply = (message: unknown, finish_reason = "stop") =>
  new Response(JSON.stringify({ choices: [{ message, finish_reason }] }));
const completion = () => jsonReply({ content: "处理完成" });
function operationReply(
  surfaceId: string,
  baseRevision: number,
  operations: unknown[],
  name = "ui_apply_operations",
) {
  return jsonReply(
    {
      tool_calls: [
        {
          id: "call-1",
          type: "function",
          function: {
            name,
            arguments: JSON.stringify({
              surfaceId,
              baseRevision,
              reason: "用户的自由指令",
              operations,
            }),
          },
        },
      ],
    },
    "tool_calls",
  );
}
const theme = (value = "midnight") => ({
  type: "setProps",
  target: "application",
  props: { theme: value },
});
it("accepts registered component changes addressed by stableId and preserves generated node identity", async () => {
  const value = studio();
  const before = value.demo.store.requireSurface("incident-recovery");
  const route = before.tree.children!.find(
    (node) => node.stableId === "route",
  )!;
  expect(route.id).not.toBe("route");
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      operationReply(before.id, before.revision, [
        {
          type: "replaceComponent",
          target: "route",
          component: "RouteComparison",
        },
        {
          type: "groupNodes",
          targets: ["owner", "approval"],
          group: {
            id: "model-review",
            component: "Section",
            props: { title: "模型自定义核对区" },
          },
        },
        { type: "moveNode", target: "model-review", position: "first" },
      ]),
    )
    .mockResolvedValueOnce(completion());
  vi.stubGlobal("fetch", fetcher);
  await value.askModel("把方案变成卡片，负责人和审批合并成核对区");
  const after = value.demo.store.requireSurface(before.id);
  expect(
    after.tree.children!.find((node) => node.stableId === "route"),
  ).toMatchObject({
    id: route.id,
    component: "RouteComparison",
    binding: route.binding,
  });
  expect(after.data).toEqual(before.data);
  expect(value.getSnapshot().changeCount).toBe(1);
  value.undo();
  expect(value.demo.store.requireSurface(before.id).tree).toEqual(before.tree);
});
afterEach(() => {
  instances.splice(0).forEach((value) => value.dispose());
  vi.unstubAllGlobals();
});

it("executes novel model-authored operations with real SDK receipts, excludes field data and preserves it through undo", async () => {
  const value = studio();
  const form = value.demo.store.requireSurface("incident-recovery");
  value.demo.store.updateData(form.id, form.revision, [
    { path: "note", value: "PRIVATE-NOTE" },
  ]);
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      operationReply(PAGE_ID, 0, [
        theme(),
        {
          type: "setProps",
          target: "page-header",
          props: { title: "只为晚班设计的新工作台" },
        },
        {
          type: "setLayout",
          target: "content",
          layout: { columns: 2, gap: 27 },
        },
      ]),
    )
    .mockResolvedValueOnce(completion());
  vi.stubGlobal("fetch", fetcher);
  await value.askModel("给晚班设计一个双栏界面，间距 27");
  const page = value.demo.store.requireSurface(PAGE_ID);
  expect(page.revision).toBe(1);
  expect(page.tree.props.theme).toBe("midnight");
  const receipt = value
    .getSnapshot()
    .messages.find((message) => message.receipt)?.receipt;
  expect(receipt?.status).toBe("applied");
  expect(JSON.parse(receipt!.result)).toMatchObject({
    beforeRevision: 0,
    afterRevision: 1,
  });
  for (const [, init] of fetcher.mock.calls) {
    expect(String(init?.body)).not.toContain("PRIVATE-NOTE");
    expect(String(init?.body)).not.toContain(config.apiKey);
  }
  expect(JSON.stringify(value.getSnapshot())).not.toContain(config.apiKey);
  value.undo();
  expect(value.demo.store.requireSurface(PAGE_ID).tree.props.theme).toBe(
    "light",
  );
  expect(value.demo.store.requireSurface(form.id).data.note).toBe(
    "PRIVATE-NOTE",
  );
  expect(value.demo.getSnapshot().hostRequests).toEqual([]);
});

it("rejects an entire batch with invalid CSS, forbidden tools, hidden approvals, altered bindings or host parameters", async () => {
  const cases: Array<{
    surfaceId: string;
    operations: unknown[];
    name?: string;
  }> = [
    {
      surfaceId: PAGE_ID,
      operations: [theme(), theme("url(https://evil.example)")],
    },
    {
      surfaceId: PAGE_ID,
      operations: [
        { type: "setVisibility", target: "recovery", visible: false },
      ],
    },
    {
      surfaceId: PAGE_ID,
      operations: [
        {
          type: "moveNode",
          target: "recovery",
          parent: "navigation",
          position: "last",
        },
      ],
    },
    {
      surfaceId: PAGE_ID,
      operations: [theme()],
      name: "ui_propose_tool_submission",
    },
    {
      surfaceId: "incident-recovery",
      operations: [
        { type: "setVisibility", target: "approval", visible: false },
      ],
    },
    {
      surfaceId: "incident-recovery",
      operations: [
        {
          type: "setProps",
          target: "approval",
          props: { label: "我不再需要审批" },
        },
      ],
    },
    {
      surfaceId: "incident-recovery",
      operations: [
        {
          type: "replaceComponent",
          target: "route",
          component: "RouteComparison",
          binding: { path: "owner", valueType: "string" },
        },
      ],
    },
  ];
  for (const item of cases) {
    const value = studio();
    const before = value.demo.store.requireSurface(item.surfaceId);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        operationReply(before.id, before.revision, item.operations, item.name),
      );
    vi.stubGlobal("fetch", fetcher);
    await value.askModel("attempt");
    expect(value.demo.store.requireSurface(before.id)).toEqual(before);
    expect(value.getSnapshot().messages.at(-1)?.receipt?.status).toBe(
      "rejected",
    );
    expect(value.demo.getSnapshot().hostRequests).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});

it("rejects stale replies after a user edit rather than replacing the fresh revision", async () => {
  const value = studio();
  const before = value.demo.store.requireSurface("incident-recovery");
  let resolve!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    ),
  );
  const pending = value.askModel("换卡片");
  value.demo.store.updateData(before.id, before.revision, [
    { path: "note", value: "newer input" },
  ]);
  resolve(
    operationReply(before.id, before.revision, [
      {
        type: "replaceComponent",
        target: "route",
        component: "RouteComparison",
      },
    ]),
  );
  await pending;
  expect(value.demo.store.requireSurface(before.id).data.note).toBe(
    "newer input",
  );
  expect(value.getSnapshot().messages.at(-1)?.text).toContain(
    "REVISION_CONFLICT",
  );
  expect(value.getSnapshot().changeCount).toBe(0);
});

it("does not execute late replies after cancellation or disposal and does not call a model for fixed templates", async () => {
  for (const dispose of [false, true]) {
    const value = studio();
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    value.send("mint");
    expect(fetcher).not.toHaveBeenCalled();
    const revision = value.demo.store.requireSurface(PAGE_ID).revision;
    const pending = value.askModel("换紫色");
    if (dispose) value.dispose();
    else value.disconnectModel();
    resolve(operationReply(PAGE_ID, revision, [theme()]));
    await pending;
    expect(value.demo.store.requireSurface(PAGE_ID).tree.props.theme).toBe(
      "mint",
    );
    expect(value.getSnapshot().modelBusy).toBe(false);
    if (!dispose) expect(value.getSnapshot().model).toBeNull();
  }
});

it("never substitutes templates for provider errors or text-only claims of success", async () => {
  for (const reply of [
    completion(),
    new Response("failure", { status: 500 }),
  ]) {
    const value = studio();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(reply));
    await value.askModel("午夜紫");
    expect(value.getSnapshot().changeCount).toBe(0);
    expect(value.demo.store.requireSurface(PAGE_ID).tree.props.theme).toBe(
      "light",
    );
    expect(value.getSnapshot().modelBusy).toBe(false);
  }
});

it("caps model rounds and records partial completion without hiding earlier successful batches", async () => {
  const value = studio();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () =>
      operationReply(
        PAGE_ID,
        value.demo.store.requireSurface(PAGE_ID).revision,
        [theme()],
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  await value.askModel("continue");
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(value.getSnapshot().changeCount).toBe(4);
  expect(value.getSnapshot().messages.at(-1)?.text).toContain("上限");
  fetcher
    .mockReset()
    .mockResolvedValueOnce(operationReply(PAGE_ID, 4, [theme("mint")]))
    .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
  await value.askModel("continue again");
  expect(value.getSnapshot().messages.at(-1)?.text).toContain(
    "此前 1 个成功批次仍保留",
  );
  expect(value.demo.store.requireSurface(PAGE_ID).tree.props.theme).toBe(
    "mint",
  );
});

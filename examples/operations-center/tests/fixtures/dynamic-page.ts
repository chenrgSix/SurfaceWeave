import type { UINode } from "@surfaceweave/core";

/** A protocol fixture authored by the test, not a real model response. */
export function dynamicPage(
  edge: "left" | "right" | "top" | "bottom" = "right",
): UINode {
  const node = (
    id: string,
    component: string,
    props = {},
    children?: UINode[],
  ): UINode => ({
    id,
    stableId: id,
    component,
    props,
    ...(children ? { children } : {}),
  });
  const navigation = node("navigation", "StudioNavigation");
  const content = node("content", "StudioContent", {}, [
    node(
      "dispatch-story",
      "StudioCard",
      {
        title: "天空蓝调度指挥台",
        description: "这是协议测试生成的全新卡片，不是预设页面。",
        badge: "PROTOCOL FIXTURE",
      },
      [
        node("dispatch-copy", "Text", {
          text: "为夜班重新组织信息，表单和审批仍由原业务 Surface 管理。",
        }),
        node("dispatch-badge", "Badge", { text: "展示内容 · 非业务证据" }),
      ],
    ),
    {
      ...node("new-stats", "Grid", {}, [
        node("stat-a", "StudioStat", {
          label: "示意指标 A",
          value: "24",
          detail: "模型展示值，不来自业务绑定",
        }),
        node("stat-b", "StudioStat", {
          label: "示意指标 B",
          value: "86%",
          detail: "协议测试数据",
        }),
      ]),
      layout: { columns: 2, gap: 17, modes: { compact: { columns: 1 } } },
    },
    node("workspace-wrap", "Section", { title: "保留输入的实际工作台" }, [
      node("recovery", "StudioRecovery"),
    ]),
  ]);
  content.layout = { columns: 1, gap: 22 };
  const body = node("page-body", "StudioBody", {}, [
    node("page-header", "StudioHeader", {
      title: "流动的工作空间",
      eyebrow: "DYNAMIC SURFACE / PROTOCOL FIXTURE",
    }),
    content,
  ]);
  if (edge === "top") body.children!.unshift(navigation);
  if (edge === "bottom") body.children!.push(navigation);
  return node(
    "application",
    "StudioApplication",
    {
      theme: "light",
      navigation: edge,
      density: "comfortable",
      palette: {
        background: "#edf7ff",
        surface: "#ffffff",
        soft: "#e1f0fc",
        text: "#173b56",
        muted: "#52758f",
        border: "#c5dfef",
        accent: "#087dad",
        accentSoft: "#dbf2ff",
        navigation: "#e7f4ff",
        positive: "#237b67",
      },
    },
    edge === "left"
      ? [navigation, body]
      : edge === "right"
        ? [body, navigation]
        : [body],
  );
}
export function pageReply(
  tree: UINode,
  baseRevision = 0,
  surfaceId = "live-application",
) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            tool_calls: [
              {
                id: "replace-1",
                type: "function",
                function: {
                  name: "ui_replace_page",
                  arguments: JSON.stringify({
                    surfaceId,
                    baseRevision,
                    tree,
                    reason: "协议回归测试",
                  }),
                },
              },
            ],
          },
        },
      ],
    }),
  );
}
export function finishedReply() {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: "stop",
          message: { content: "协议测试完成，查看 SDK 实际回执。" },
        },
      ],
    }),
  );
}

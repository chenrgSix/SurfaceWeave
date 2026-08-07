import { cloneValue, validateSurface } from "@surfaceweave/core";
import type {
  ComponentRegistry,
  JsonObject,
  JsonValue,
  Surface,
  UINode,
} from "@surfaceweave/core";

import type { GenerateResultSurfaceInput, GeneratedSurface } from "./types.js";

type ResultNodeRole = "action" | "group" | "root" | "state" | "value";

function nodeId(surfaceId: string, role: ResultNodeRole, path: string): string {
  return `${surfaceId}--${role}--${encodeURIComponent(path)}`;
}

function label(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function summaryNodes(
  surfaceId: string,
  value: JsonValue,
  path = "result",
): UINode[] {
  if (Array.isArray(value)) {
    return [
      {
        id: nodeId(surfaceId, "value", path),
        stableId: path,
        component: value.length === 0 ? "EmptyState" : "DataTable",
        props:
          value.length === 0
            ? { message: "No results" }
            : {
                title: label(path.split(".").at(-1) ?? "Results"),
                items: cloneValue(value),
              },
        ...(value.length === 0
          ? {}
          : {
              binding: {
                path: `projection.${path}`,
                valueType: "array" as const,
                semantic: "collection",
              },
            }),
      },
    ];
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    if (entries.length === 0) return [];
    return entries.map(([name, item]) => {
      const childPath = `${path}.${name}`;
      if (typeof item === "object" && item !== null) {
        return {
          id: nodeId(surfaceId, "group", childPath),
          stableId: `ui.group:${childPath}`,
          component: "Accordion",
          props: { label: label(name) },
          children: summaryNodes(surfaceId, item, childPath),
        };
      }
      return {
        id: nodeId(surfaceId, "value", childPath),
        stableId: childPath,
        component: "Text",
        props: {
          text: `${label(name)}: ${item === null ? "—" : String(item)}`,
        },
      };
    });
  }
  return [
    {
      id: nodeId(surfaceId, "value", path),
      stableId: path,
      component: "Text",
      props: { text: value === null ? "Completed" : String(value) },
    },
  ];
}

/** Creates a deterministic semantic projection while keeping raw results outside the Surface. */
export function generateResultSurface(
  input: GenerateResultSurfaceInput,
  registry: ComponentRegistry,
): GeneratedSurface {
  const children: UINode[] = [];
  if (input.status === "error") {
    children.push({
      id: nodeId(input.surfaceId, "state", "error"),
      stableId: "result.error",
      component: "ErrorState",
      props: { message: input.errors?.[0]?.message ?? "Tool execution failed" },
    });
  } else if (
    input.result === undefined ||
    input.result === null ||
    (Array.isArray(input.result) && input.result.length === 0) ||
    (typeof input.result === "object" &&
      !Array.isArray(input.result) &&
      Object.keys(input.result).length === 0)
  ) {
    children.push({
      id: nodeId(input.surfaceId, "state", "empty"),
      stableId: "result.empty",
      component: "EmptyState",
      props: {
        message:
          input.status === "partial"
            ? "Partial result is empty"
            : "Completed successfully",
      },
    });
  } else {
    children.push(...summaryNodes(input.surfaceId, input.result));
  }
  for (const [index, error] of (input.errors ?? []).entries()) {
    if (input.status === "error" && index === 0) continue;
    children.push({
      id: nodeId(input.surfaceId, "state", `error-${index}`),
      stableId: `result.error.${index}`,
      component: "ErrorState",
      props: { message: `${error.code}: ${error.message}` },
    });
  }
  if (input.retryable === true) {
    children.push({
      id: nodeId(input.surfaceId, "action", "retry"),
      stableId: "result.retry",
      component: "Action",
      props: {
        label: "Retry",
        action: "tool.retry",
        invocationId: input.invocationId,
      },
    });
  }
  const data: JsonObject = {
    projection: { result: cloneValue(input.result ?? null) },
    interaction: {},
  };
  const surface: Surface = {
    id: input.surfaceId,
    revision: 0,
    intent: "browse",
    schemaRef: { id: input.definition.id, version: input.definition.version },
    tree: {
      id: nodeId(input.surfaceId, "root", "result"),
      stableId: `${input.definition.id}.result`,
      component: "Stack",
      props: {},
      children,
    },
    data,
    context: {
      source: "tool.result",
      invocationId: input.invocationId,
      correlationId: input.correlationId,
      toolId: input.definition.id,
      toolVersion: input.definition.version,
      resultStatus: input.status,
    },
  };
  validateSurface(surface, registry);
  const generated = cloneValue(surface) as Partial<Surface>;
  delete generated.revision;
  return generated as GeneratedSurface;
}

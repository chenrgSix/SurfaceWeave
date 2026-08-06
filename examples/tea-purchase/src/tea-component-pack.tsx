import type { ComponentManifest, JsonValue } from "@surfaceweave/core";
import { componentManifestToDefinition } from "@surfaceweave/core";
import type {
  ReactComponentPack,
  RendererComponentProps,
} from "@surfaceweave/react";

/** Cross-framework semantic declaration; renderers may bind or fall back from it. */
export const teaProductCardManifest: ComponentManifest = {
  semanticType: "TeaProductCard",
  description: "Selectable tea product collection with origin and unit price.",
  propsSchema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      title: { type: "string" },
      items: { type: "array" },
      multiple: { type: "boolean" },
    },
  },
  binding: { valueTypes: ["array", "string", "unknown"] },
  actions: ["select"],
  actionSchema: {
    type: "object",
    additionalProperties: false,
    required: ["action", "input"],
    properties: {
      action: { const: "select" },
      input: {},
    },
  },
  fallback: "Card",
};

export const teaProductCardDefinition = componentManifestToDefinition(
  teaProductCardManifest,
);

function itemRecord(item: JsonValue): Record<string, JsonValue> | undefined {
  return typeof item === "object" && item !== null && !Array.isArray(item)
    ? item
    : undefined;
}

function TeaProductCard({
  node,
  value,
  onValueChange,
  onAction,
}: RendererComponentProps) {
  const items = Array.isArray(node.props.items) ? node.props.items : [];
  const selected = new Set(
    Array.isArray(value) ? value.map(String) : [String(value ?? "")],
  );
  const multiple = node.props.multiple === true;
  return (
    <section aria-label={String(node.props.title ?? "Tea products")}>
      <h2>{String(node.props.title ?? "Tea products")}</h2>
      <div className="tea-product-grid">
        {items.map((item, index) => {
          const record = itemRecord(item);
          const id = String(record?.id ?? index);
          const nextValue: JsonValue = multiple
            ? selected.has(id)
              ? [...selected].filter((selectedId) => selectedId !== id)
              : [...selected, id]
            : id;
          return (
            <button
              type="button"
              className="tea-product-card"
              key={id}
              aria-pressed={selected.has(id)}
              onClick={() => {
                onValueChange(nextValue);
                onAction("select", { value: nextValue });
              }}
            >
              <strong>{String(record?.name ?? `Tea ${index + 1}`)}</strong>
              <span>{String(record?.origin ?? "Unknown origin")}</span>
              <b>¥{String(record?.price ?? "-")}</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** React implementation for the demo's default visual pack only. */
export const teaBusinessReactPack: ReactComponentPack = {
  manifest: {
    protocolVersion: "1.0",
    id: "tea-business",
    version: "1.0.0",
    rendererKind: "react",
    priority: 30,
    capabilities: ["web"],
    components: [teaProductCardManifest],
    agentGuidance: {
      summary:
        "Use TeaProductCard for tea selection when product origin and price matter.",
      usage: [
        "Bind selection state and provide items with stable identifiers.",
      ],
    },
  },
  bindings: { TeaProductCard },
};

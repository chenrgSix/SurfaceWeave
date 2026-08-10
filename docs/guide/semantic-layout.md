# Semantic LayoutSpec 1.0

::: warning RC.4 candidate
LayoutSpec 1.0 and the `Section` semantic component are included in the local
`0.1.0-rc.4` candidate but are not in the published RC.3 packages. npm `next`
will expose them only after the protected RC.4 publication succeeds.
:::

SurfaceWeave layouts are JSON-only semantic hints. They describe relationships
such as columns, spacing, alignment, and view-mode overrides without exposing
CSS, DOM properties, React components, or vendor configuration.

```ts
const layout = {
  direction: "column",
  columns: 2,
  gap: 16,
  align: "stretch",
  modes: {
    compact: { columns: 1 },
    workspace: { columns: 2 },
  },
};
```

Supported properties are `direction`, `columns`, `gap`, `align`, `justify`, and
`span`. Columns and spans range from 1 to 12; gaps range from 0 to 64. Compact
views safely reduce multi-column containers to one column.

## Generate a form layout

Default forms are deterministic single-column layouts. Developers may provide
soft hints for workspace columns, field spans, and explicit sections:

```ts
generateSurface(
  {
    surfaceId: "purchase",
    intent: "form",
    schema: purchaseSchema,
    data: {},
    developer: {
      softHints: {
        layout: { columns: 2, gap: 16 },
        groups: {
          delivery: {
            title: "Delivery information",
            layout: { columns: 2, gap: 8 },
          },
        },
        fields: {
          receiver: { group: "delivery" },
          address: { group: "delivery", layout: { span: 2 } },
        },
      },
    },
  },
  components,
);
```

Grouping changes only the component tree. Field `stableId`, `DataBinding`, and
Surface data stay unchanged. Nested objects continue to use `Accordion`.

## Apply a temporary Agent layout

`ui.applyOperations` exposes the same strict LayoutSpec in its JSON Schema:

```json
{
  "surfaceId": "purchase",
  "baseRevision": 3,
  "reason": "Make the address use the full row",
  "operations": [
    {
      "type": "setLayout",
      "target": "address",
      "layout": { "span": 2, "modes": { "compact": { "span": 1 } } }
    }
  ]
}
```

Agent writes reject unknown layout keys before changing the Store. Developer
hard constraints may lock a field's `layout`; such a lock wins over durable
preferences and temporary Agent operations.

## Renderer fallback

`ComponentManifest.layoutCapabilities` declares portable support. The Core
resolver applies the selected `compact` or `workspace` override, filters
unsupported features, and reports diagnostics. Every renderer must retain tree
order when layout support is absent. The default React, React Aria, and Ant
Design Packs use the same semantic resolution; a framework-agnostic fake
renderer validates that no React or DOM contract is required.

The normative standalone schema is exported as
`@surfaceweave/protocol/layout-schema`; the human-readable contract is
`@surfaceweave/protocol/layout`. Wire Protocol 1.0 still accepts legacy safe
layout records for compatibility, but portable new Surfaces should conform to
LayoutSpec 1.0.

See the [Milestone 6.2 audit summary](/milestone-6.2-summary) for verification
evidence and known limits.

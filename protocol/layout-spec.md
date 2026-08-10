# SurfaceWeave Semantic LayoutSpec 1.0

## Status and boundary

LayoutSpec 1.0 defines portable, optional layout hints for `UINode.layout`. The
normative standalone schema is
[`schemas/semantic-layout-1.0.schema.json`](schemas/semantic-layout-1.0.schema.json)
with identifier `urn:surfaceweave:schema:semantic-layout:1.0`. It contains JSON
only and has no CSS, DOM, React, Vue, Flutter, or component-vendor properties.

Wire Protocol 1.0 continues to accept a safe declaration object for backward
compatibility. A portable Surface conforms to this stricter LayoutSpec. Unknown
or unsupported properties must never be forwarded to a framework sink: a
Renderer ignores them and may report a diagnostic.

## Semantic properties

| Property    | Meaning                                                         |
| ----------- | --------------------------------------------------------------- |
| `direction` | Child flow: `row` or `column`.                                  |
| `columns`   | Grid column count from 1 through 12.                            |
| `gap`       | Abstract spacing unit from 0 through 64.                        |
| `align`     | Cross-axis alignment: `start`, `center`, `end`, or `stretch`.   |
| `justify`   | Main-axis distribution: `start`, `center`, `end`, or `between`. |
| `span`      | Number of parent grid columns occupied by this node, 1–12.      |

`modes.compact` and `modes.workspace` override those properties for the two
standard `SurfaceViewMode` values. Compact renderers must safely reduce a
multi-column declaration to one column. Omitted properties use the semantic
component's deterministic default; they do not inherit vendor behavior.

```json
{
  "direction": "column",
  "columns": 2,
  "gap": 16,
  "align": "stretch",
  "modes": {
    "compact": { "columns": 1 },
    "workspace": { "columns": 2 }
  }
}
```

## Capabilities and fallback

`ComponentManifest.layoutCapabilities` declares which LayoutSpec features a
semantic component can apply. A Runtime filters unsupported features and emits
a diagnostic without rewriting the Surface tree, `stableId`, binding, or data.
An implementation that supports none of the requested features still renders
children in document order. `span` is ignored when the parent is not a grid.

Layout declarations never select a Component Pack and cannot change host
capabilities, pack policy, ActionExecutor, URLs, credentials, or executable
behavior. Vendor presentation belongs in a versioned `UINode.extensions`
namespace, not in `layout`.

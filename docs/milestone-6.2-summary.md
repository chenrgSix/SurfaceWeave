# Milestone 6.2 Summary — Semantic LayoutSpec 1.0

## Outcome

Milestone 6.2 defines and implements a framework-neutral Semantic LayoutSpec
1.0 without narrowing the existing Wire Protocol 1.0 `UINode.layout` field.
The work is committed on `main` but remains unreleased: package versions are
still `0.1.0-rc.3`, and no tag, GitHub Release, or npm publication was created.

## Delivered

- standalone language-neutral LayoutSpec document and Draft 2020-12 JSON
  Schema, exported from `@surfaceweave/protocol/layout` and
  `@surfaceweave/protocol/layout-schema`;
- Core types, strict parser/serializer, compact/workspace resolution,
  capability filtering, diagnostics, and optional Component Manifest
  `layoutCapabilities`;
- the standard semantic `Section` component;
- deterministic single-column generated forms, developer root/field layout,
  compact one-column fallback, explicit Section groups, and unchanged field
  `stableId`, DataBinding, and data;
- common container/item layout mapping for the default React, React Aria, and
  Ant Design Packs;
- strict Agent Tool schemas and input validation for `setLayout`, grouped-node
  layout, and generated Surface hints;
- preference and temporary-Agent hard-constraint coverage;
- a framework-agnostic fake renderer that resolves the same Surface and
  Manifest without React, DOM, or CSS types;
- public API, authoring, architecture, package README, VitePress guide, tarball
  consumer, and release-audit updates.

## Completion audit

| Requirement                  | Evidence                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Framework-neutral protocol   | Standalone JSON Schema tests and Protocol tarball consumer pass.                                                                   |
| Core has no renderer leakage | Core compiles with `ES2022` only; boundary tests and dependency/source audit find no React, DOM, CSS, vendor Pack, or Tauri types. |
| Safe fallback                | Core resolver tests cover unknown/invalid values, unsupported capabilities, mode overrides, and compact one-column fallback.       |
| Consistent React Packs       | Default, React Aria, and AntD binding completeness and rendering tests pass; container layout and item `span` are separated.       |
| Deterministic default UI     | Generator equality, grouping, ordering, nested layout, stable binding, and unchanged data tests pass.                              |
| Agent and preference safety  | Agent writes reject non-semantic keys before Store mutation; layout locks override preferences and temporary Agent operations.     |
| Public package boundary      | Ten local tarballs install into 11 clean consumers; LayoutSpec and layout helper imports use exports only.                         |
| Documentation                | VitePress builds the new guide and corrected architecture/component catalog.                                                       |

Final validation under Node `22.23.1`:

```text
pnpm build             passed
pnpm typecheck         passed
pnpm lint              passed
pnpm test              33 files / 140 tests passed
pnpm verify:packages   10 tarballs / 11 clean consumers passed
pnpm audit:release     10 package audits passed
pnpm docs:build        passed
pnpm check:tauri       cargo check passed
```

## Known limits

- Legacy host-authored `layout` records remain accepted by Wire Protocol 1.0;
  renderers ignore unknown properties, while new Generator and Agent output is
  strict LayoutSpec 1.0.
- Explicit Sections currently group top-level form fields. Nested JSON objects
  continue to render as Accordion containers.
- `span` has an effect only under a grid parent. Missing layout support always
  falls back to tree order.
- Tabs, Divider, automatic OpenAPI parameter sections, Vue/Flutter renderers,
  and vendor-specific layout controls are not implemented.
- Existing Demo/AntD/Agentdown Vite large-chunk warnings remain known package
  costs and were not addressed by this milestone.

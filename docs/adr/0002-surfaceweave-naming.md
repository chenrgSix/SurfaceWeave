# ADR 0002: Adopt SurfaceWeave as the Project Name

- Status: Accepted
- Date: 2026-08-06

## Decision

The project, product, and future GitHub repository are named **SurfaceWeave**.
The npm scope is `@surfaceweave`.

Surface describes the runtime's central declarative UI object. Weave describes
how Tool Schema, Agent adjustments, user preferences, and Component Packs are
combined without implying a frontend workflow engine or a specific rendering
framework.

The public package names are:

| Responsibility                  | Package                     |
| ------------------------------- | --------------------------- |
| Wire protocol                   | `@surfaceweave/protocol`    |
| Framework-neutral runtime       | `@surfaceweave/core`        |
| Persistence adapters            | `@surfaceweave/storage`     |
| Preference engine               | `@surfaceweave/preferences` |
| Deterministic generation        | `@surfaceweave/generator`   |
| Agent UI tools                  | `@surfaceweave/agent-tools` |
| React renderer and default Pack | `@surfaceweave/react`       |
| React Aria Pack                 | `@surfaceweave/react-aria`  |
| Ant Design Pack                 | `@surfaceweave/antd`        |
| Tauri host adapter              | `@surfaceweave/tauri`       |

The product description is:

> SurfaceWeave — A protocol-first runtime for agent-generated, tool-driven UI.

中文定位：面向 Agent 动态生成与调整业务 UI 的协议优先运行时。

## Consequences

The previous `@package-first` names were never released according to repository
records, so the first release uses only `@surfaceweave` names and provides no
compatibility aliases. Package responsibilities, framework boundaries, wire
semantics, and runtime APIs do not change as part of this rename.

The shorter React package names are public branding only. Source directories
may retain their descriptive monorepo names, and future Vue or Flutter bindings
can use their own framework-specific packages without changing Protocol or
Core.

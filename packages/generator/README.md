# @surfaceweave/generator

Deterministic semantic Surface generation from JSON Schema, canonical Tool
Definitions, data, and interaction intent.

```sh
npm install @surfaceweave/core@next @surfaceweave/generator@next
```

In RC.4, generated forms default to a deterministic single column.
Developer soft hints may add portable root layouts, field spans, and explicit
semantic Sections while preserving field `stableId`, bindings, and data.

For `fromOpenApiOperation`, path and query parameters default to user input;
header and cookie parameters default to Host-owned context and are omitted from
the generated Tool Schema. `parameterSources` may expose a non-sensitive
business Header explicitly, but authorization, cookies, and API keys cannot be
made user-controlled.

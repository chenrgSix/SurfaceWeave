# OpenAPI to Default Form

SurfaceWeave can generate a deterministic form after an OpenAPI operation has
been converted into a canonical `ToolDefinition`. The Runtime still does not
fetch API descriptions, select credentials, call endpoints, or infer business
authorization.

::: warning Current RC.4 boundary
`fromOpenApiOperation` currently accepts one OpenAPI 3.1 operation whose Schema
references have already been dereferenced by the host. Direct full-document
operation discovery, local `$ref` resolution, and automatic parameter sections
are the next adapter increment; they are not claimed by RC.4.
:::

## Acceptance document

The repository includes a validated OpenAPI 3.1 fixture at
[`examples/tea-purchase/openapi.json`](https://github.com/chenrgSix/SurfaceWeave/blob/main/examples/tea-purchase/openapi.json).
It defines:

- `GET /tea-products` with optional query filters and deterministic defaults;
- `POST /suppliers/{supplierId}/purchase-orders` with path, query, and business
  header parameters plus a JSON request body;
- reusable local component Schemas, nullable values, arrays, enums, formats,
  constraints, `allOf`, success responses, and an error response;
- an explicit public operation and a protected side-effecting operation.

The placeholder server URL is documentation only. A trusted Host must inject
the real base URL and authentication configuration. Security schemes must never
become editable form fields.

## Host-owned parameters

Parameter location is not the same as trust ownership. SurfaceWeave applies a
conservative default when adapting an operation:

| OpenAPI location | Default source | Generated form |
| ---------------- | -------------- | -------------- |
| `path`           | user           | included       |
| `query`          | user           | included       |
| `header`         | Host           | omitted        |
| `cookie`         | Host           | omitted        |

The Host injects tenant, user, organization, authorization, trace, idempotency,
and signing values when it constructs the real request. Hiding those values in
a form is insufficient: Host-owned parameters are excluded from the canonical
Tool Schema and generated form. The Host must not pass context values as
Surface `initialValues`; Runtime submission projection discards fields absent
from the canonical Schema before producing `validatedArguments`.

A trusted integration may opt an ordinary business Header into user input:

```ts
const definition = fromOpenApiOperation({
  document: dereferencedDocument,
  path: "/reports",
  method: "get",
  parameterSources: {
    "header:X-Report-Format": "user",
  },
});
```

`Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key`,
and every cookie parameter remain Host-owned even when a caller attempts to
mark them as user-controlled. The OpenAPI document cannot select a context
source, access credentials, or weaken this boundary.

The fixture passes Redocly's recommended OpenAPI rules:

```bash
pnpm --package=@redocly/cli@2.12.3 dlx redocly lint \
  examples/tea-purchase/openapi.json
```

## Current adapter flow

Until full-document conversion is implemented, the Host resolves references
and selects one operation before calling the Generator:

```ts
import { createStandardComponentRegistry } from "@surfaceweave/core";
import {
  fromOpenApiOperation,
  generateToolSurface,
} from "@surfaceweave/generator";

const definition = fromOpenApiOperation({
  document: dereferencedDocument,
  path: "/tea-products",
  method: "get",
});

const surface = generateToolSurface(
  {
    definition,
    surfaceId: "tea-search-form",
  },
  createStandardComponentRegistry(),
);
```

The resulting Surface contains only semantic components and JSON data. It does
not retain `servers`, credentials, HTTP clients, callbacks, DOM values, or
renderer-specific properties.

## Full-document acceptance target

The planned adapter will discover operations by `operationId` or
`path + method`, resolve local references with cycle detection, merge path-level
and operation-level parameters, and generate stable semantic Sections for path,
query, header, cookie, and JSON body inputs. It will return the canonical Tool
definition separately from Host-owned HTTP binding metadata. Remote references,
network fetching, authentication execution, and arbitrary API calls remain
outside the Generator.

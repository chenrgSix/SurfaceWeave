# RC.5 Release Candidate Summary

## Status

SurfaceWeave `0.1.0-rc.5` is prepared as a release candidate for all ten public
packages. It is not published yet: npm `next` still resolves to RC.4 and
`latest` intentionally remains on immutable RC.2. No tag, GitHub Release, or
npm publication is authorized by this document.

## OpenAPI parameter ownership

- `fromOpenApiOperation` treats path and query parameters as user input while
  header and cookie parameters default to Host-owned context.
- `OpenApiParameterLocation`, `OpenApiParameterSource`, and
  `OpenApiParameterSourceKey` expose a typed trusted-Host policy boundary.
- A Host may explicitly expose an ordinary business Header, but authorization,
  proxy authorization, cookies, and API keys can never be user-controlled.
- Host-owned fields are removed from the canonical Tool input Schema, receive
  no generated binding, and are discarded by Tool submission projection. A
  Host must still avoid placing trusted context in Surface initial data.

## Real OpenAPI acceptance UI

The checked-in OpenAPI 3.1.1 tea-purchase fixture now drives the example's
initial form through the public Generator, `SurfaceStore`, and React Renderer
APIs. The example-only Host preprocessing resolves local references and selects
one Operation before calling the current adapter; it is not a new exported
full-document importer.

The initial `GET /tea-products` form renders in compact chat and workspace
views backed by the same Store. Browser acceptance verifies bidirectional data
sync and structured `ActionIntent` forwarding. The protected purchase
Operation test merges its path parameter while proving that tenant,
authentication, server URL, and other transport authority do not enter the
Tool definition or Surface.

## Compatibility

Wire Protocol remains `1.0`. RC.5 adds no package, export subpath, dependency,
peer dependency, Component Pack, Renderer, Tauri capability, workflow feature,
or executable-code surface. Existing OpenAPI callers retain the RC.4 default
for path/query parameters; the intentional safety change is that header and
cookie parameters now require explicit trusted-Host opt-in to become user
fields, and protected transport parameters reject that opt-in.

Full-document discovery, a published local `$ref` resolver, remote document
fetching, credential selection, HTTP execution, and arbitrary API calls remain
out of scope. Applications continue to select and dereference one Operation in
trusted Host code before invoking `fromOpenApiOperation`.

## Candidate verification

Under Node 22, the candidate passes cold build, typecheck, lint, 37 Vitest files
/ 155 tests, ten package tarballs / eleven clean consumers, release metadata
audit, VitePress build, and Tauri cargo check. Browser acceptance additionally
verifies that the OpenAPI-derived compact and workspace views synchronize
values and forward `ActionIntent` to the Host.

Known Vite large-chunk warnings remain limited to the multi-Pack demo, Ant
Design itself, and the Agentdown/Mermaid consumer. Package isolation tests
confirm that unselected Packs do not enter ordinary consumers.

## Installation after publication

After an explicitly approved OIDC release, install the RC through `next`:

```bash
npm install @surfaceweave/core@next \
  @surfaceweave/generator@next \
  @surfaceweave/agent-tools@next
```

React hosts add `@surfaceweave/react@next`. The current npm Registry continues
to serve RC.4 through `next` until the protected RC.5 workflow succeeds.

## Release boundary

The candidate must be committed and reviewed before an annotated
`v0.1.0-rc.5` tag is created. Only the protected `npm-release` OIDC workflow may
publish it. `latest` must remain unchanged unless the owner separately
authorizes a dist-tag move.

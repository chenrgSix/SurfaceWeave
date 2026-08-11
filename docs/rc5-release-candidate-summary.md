# RC.5 Release Summary

## Status

SurfaceWeave `0.1.0-rc.5` is published for all ten public packages. npm `next`
resolves to RC.5 and `latest` intentionally remains on immutable RC.2. The
annotated `v0.1.0-rc.5` tag fixes the release at commit
`dc8e8349adfed0c933b197435959fca0f5862efc`; the protected OIDC workflow and
[GitHub Prerelease](https://github.com/chenrgSix/SurfaceWeave/releases/tag/v0.1.0-rc.5)
record the same source boundary.

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

## Release verification

Under Node 22, the tagged source passes cold build, typecheck, lint, 37 Vitest
files / 155 tests, ten package tarballs / eleven clean consumers, release
metadata audit, VitePress build, and Tauri cargo check. Browser acceptance
additionally verifies that the OpenAPI-derived compact and workspace views
synchronize values and forward `ActionIntent` to the Host.

Post-publication validation downloaded all ten immutable tarballs from the
official Registry, verified metadata, integrity, `gitHead`, MIT licenses, and
SLSA provenance, then passed ten clean Registry consumers including Core,
React root isolation, React DOM Driver, Vue/Agentdown, both optional Packs,
Tool Runtime, and Tauri. The first workflow attempt observed Tauri before npm
propagation completed; a safe retry of the same immutable tag verified the
published artifact without rebuilding the tag or overwriting a version.

Known Vite large-chunk warnings remain limited to the multi-Pack demo, Ant
Design itself, and the Agentdown/Mermaid consumer. Package isolation tests
confirm that unselected Packs do not enter ordinary consumers.

## Installation

Install the RC through `next`:

```bash
npm install @surfaceweave/core@next \
  @surfaceweave/generator@next \
  @surfaceweave/agent-tools@next
```

React hosts add `@surfaceweave/react@next`. The current npm Registry serves
RC.5 through `next`; unqualified installs continue to resolve to RC.2.

## Immutable release boundary

The annotated `v0.1.0-rc.5` tag and published versions must not be moved,
rebuilt, overwritten, or unpublished. Only a new version may change an
accepted artifact. `latest` remains unchanged unless the owner separately
authorizes a dist-tag move.

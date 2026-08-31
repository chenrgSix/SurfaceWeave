# RC.6 Release Summary

## Status

SurfaceWeave `0.1.0-rc.6` is prepared for all ten public packages. Publication
targets npm `next`; `latest` remains on immutable `0.1.0-rc.2`. Until Registry
verification completes, the published baseline is RC.5. Source commits and a
successful documentation deployment do not by themselves establish npm delivery.

## Runtime changes since RC.5

- Core indexes committed Surfaces and caches validated component and Schema
  resolution. Opt-in immutable observations expose stable snapshots without
  changing the existing defensive-copy Store APIs.
- The React renderer subscribes at rendered-node boundaries, retaining unchanged
  nodes across unrelated updates. Action IDs are distinct across views sharing
  one Store.
- Agent UI mutations honor the hard constraints of Tool-created Surfaces for
  both operation batches and whole-Surface replacement.
- Tool execution binds confirmation to a validated input snapshot. Mutating
  inputs requires a fresh confirmation; invalid input cannot manufacture a
  successful confirmation receipt. Host retry restrictions remain authoritative.
- Preference repository mutations are serialized. Overlapping writes preserve
  accepted changes, and a failed durable write does not publish an in-memory
  update or prevent a later operation from running.

## Compatibility and package boundaries

Wire Protocol remains `1.0`; `Surface`, `UIOperation`, and `ActionIntent` wire
contracts do not change. Core adds immutable observation exports and
`writeDataPathImmutable` through its existing root entry point. Package names,
export subpaths, external dependency ranges, and peer ranges are unchanged.
All ten packages and exact internal dependencies move together to RC.6.

The stricter confirmation, constraint, and retry checks intentionally reject
operations that previously escaped their declared authority. Hosts should
refresh confirmation after editing input and honor the current invocation state.

Core remains independent of React, DOM, model SDKs, and Host execution. The
conversation playground, custom page components, temporary model credentials,
and OpenAI-compatible transport remain private example code. They are not new
npm packages and do not add business execution privileges to Agent UI tools.

## Demo and verification boundaries

The <a href="/SurfaceWeave/playground/" target="_self">live playground</a> is built from repository
sources and exercises actual Store operations, page replacement, shared input,
and layout undo. Template dialogue is scripted. Protocol fixtures verify model
transport and UI authorization, not the quality of a real model. Business
estimates and Host responses remain simulated.

Release verification covers build, strict typecheck, lint, tests, isolated
tarball consumers, package metadata and publish dry-runs. The tagged GitHub
workflow additionally checks and builds the Tauri host before publishing via
OIDC. Publication acceptance must download the official Registry tarballs and
verify integrity, `gitHead`, provenance, exact internal dependencies, unchanged
`latest`, and clean Registry consumers. Passing these gates does not certify
physical Windows/Linux desktop behavior or real-model quality.

Both release verification and publication pin npm `11.6.0`, matching CI and
retaining peer dependency checks. This avoids npm 10's circular optional-peer
resolution crash without weakening consumer validation.

## Installation after publication

```bash
npm install @surfaceweave/core@next \
  @surfaceweave/generator@next \
  @surfaceweave/agent-tools@next
```

React hosts add `@surfaceweave/react@next`. Use explicit RC versions to pin a
deployment; unqualified installs continue to select RC.2 while `latest` is
unchanged. Published versions and annotated release tags are immutable.

---
layout: home

hero:
  name: SurfaceWeave
  text: Agent-generated UI, woven safely
  tagline: A protocol-first runtime that turns Tool Schemas, Agent adjustments, user preferences, and trusted Component Packs into dynamic interfaces.
  image:
    src: /surfaceweave-mark.svg
    alt: SurfaceWeave woven surface mark
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/chenrgSix/SurfaceWeave

features:
  - title: Protocol first
    details: Surfaces, manifests, operations, events, and actions are serializable contracts—not React components or executable code.
  - title: Tool driven
    details: Generate reliable input and result UI from registered Tool Schemas, then let Agents apply typed semantic changes.
  - title: Host controlled
    details: Components emit ActionIntent values. Your Host Executor authorizes side effects and calls business systems.
  - title: Pack based
    details: Render the same semantic Surface with default React, React Aria, or Ant Design bindings without rewriting it.
---

## From a Tool to trusted UI

SurfaceWeave owns the interaction boundary—not your workflow. The business
Agent or backend chooses the next Tool; the Runtime validates, renders, retains
session data, and reports the next structured action.

<div class="surface-flow">
  <div><strong>1. Describe</strong>Register a Tool with JSON Schema and interaction metadata.</div>
  <div><strong>2. Weave</strong>Generate a Surface and apply validated Agent or preference patches.</div>
  <div><strong>3. Execute</strong>Handle ActionIntent through a host-owned, allow-listed executor.</div>
</div>

```bash
npm install @surfaceweave/core@next \
  @surfaceweave/generator@next \
  @surfaceweave/agent-tools@next
```

## One Surface, multiple trusted views

The chat view and the full workspace subscribe to the same `SurfaceStore`, so
form values and semantic revisions stay synchronized. Renderer bindings are
replaceable; the wire protocol remains framework independent.

<div class="demo-frame">
  <img src="./assets/tea-purchase-demo.jpg" alt="SurfaceWeave tea purchase Tool-to-UI example" />
</div>

::: warning Experimental release candidate
`0.1.0-rc.4` is published with npm provenance. npm `@next` resolves to RC.4;
`latest` intentionally remains on immutable RC.2. Review the
[RC.4 release summary](/rc4-release-candidate-summary) and
[compatibility matrix](/npm-compatibility-matrix) before production use.
:::

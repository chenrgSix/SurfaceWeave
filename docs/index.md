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
      text: Explore the flagship demo
      link: /guide/conversation-playground
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

## Say it. Reshape the whole application.

The flagship conversation playground pairs fixed dialogue templates with a live
application. Move the sidebar to the top, switch the whole page to a midnight
theme, enter focus mode, open synchronized views, or turn fields into decision
cards. Combine changes and undo them without losing the latest user input.
Follow the [conversation walkthrough](/guide/conversation-playground) or run `pnpm dev`.

The Agent is scripted and business APIs are simulated. Both the application shell
and business form are actual Surfaces. All mutations use the SDK; theme enums are
mapped to styles only by trusted local components.

The chat view and the full workspace subscribe to the same `SurfaceStore`, so
form values and semantic revisions stay synchronized. Renderer bindings are
replaceable; the wire protocol remains framework independent.

<div class="demo-frame">
  <img src="/conversation-playground.png" alt="SurfaceWeave dialogue changes a live application" />
</div>

::: warning Experimental release candidate
`0.1.0-rc.5` is published with npm provenance. npm `@next` resolves to RC.5;
`latest` intentionally remains on immutable RC.2. Review the
[RC.5 release summary](/rc5-release-candidate-summary) and
[compatibility matrix](/npm-compatibility-matrix) before production use.
:::

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
      text: Open live playground
      link: /playground/
      target: _self
    - theme: alt
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

## Say it. Reshape the whole application.

The flagship conversation playground connects fixed dialogue templates or your
temporarily configured model to a live application. Move navigation to any edge, create a custom palette, generate new cards and grids,
rebuild the page, open synchronized views, or turn fields into decision cards. Combine changes and undo them without losing the latest user input.
Use the **Open live playground** button above to try it directly in your browser.
No Key is needed for fixed templates. Follow the [conversation walkthrough](/guide/conversation-playground) to connect a model, or run `pnpm dev` locally.

Fixed templates are scripted; optional model mode accepts your temporary OpenAI-compatible
Chat Completions configuration and executes model-authored semantic operations. The site is static: it includes no model proxy or shared API Key. Your provider must
allow HTTPS browser requests from `https://chenrgsix.github.io`. Business APIs remain simulated. Both the application shell
and business form are actual Surfaces. All mutations use the SDK; validated semantic color tokens are
mapped to styles only by trusted local components. Generated card text and metrics
are presentation content, not authenticated business evidence.

Both embedded business views subscribe to the same `SurfaceStore`, so
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

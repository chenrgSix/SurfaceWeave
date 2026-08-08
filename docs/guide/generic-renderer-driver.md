# Generic Renderer Driver

`SurfaceRendererDriver<TTarget>` is a framework-neutral lifecycle contract for
embedding a Surface view. Core defines only `mount`, `update`, `unmount`, a
`surfaceId`, and a presentation mode. It contains no DOM, React, Vue, Executor,
or Component Pack types and is not part of the JSON Wire Protocol.

## Trusted host setup

The current DOM implementation is an optional React subpath:

```ts
import { createReactDOMRendererDriver } from "@surfaceweave/react/dom";

export const surfaceDriver = createReactDOMRendererDriver({
  store,
  componentRegistry,
  reactComponents,
  onActionIntent: handleActionIntent,
  enabledPackIds: ["tea-business", "default"],
  capabilities: ["web"],
  packPriorities: { "tea-business": 10, default: 0 },
  supportedPackVersions: { "tea-business": ["1.0.0"] },
});
```

Keep this module under host control. Agent events may choose only a known
`surfaceId`; they cannot replace registries, enable Packs, claim capabilities,
or install an Executor. The driver copies those policies when it is created.

## Agentdown + Vue example

This is a documentation-only integration checked against Agentdown `0.0.5`.
Agentdown stays an application dev/example dependency and is not a dependency
of any SurfaceWeave package. Register a local Vue renderer component through
Agentdown's `defineAgnoToolComponents`; a small wrapper correlates the tool block
to a Surface and passes only `surfaceId` into the controlled mount component.

```ts
// agentdown-tools.ts
import { defineAgnoToolComponents } from "agentdown";
import SurfaceWeaveToolBlock from "./SurfaceWeaveToolBlock.vue";

export const toolComponents = defineAgnoToolComponents({
  surfaceweave: {
    match: "ui.renderSurface",
    component: SurfaceWeaveToolBlock,
  },
});
```

```vue
<!-- SurfaceWeaveToolBlock.vue -->
<script setup lang="ts">
import type { RunSurfaceRendererProps } from "agentdown";
import { computed } from "vue";
import SurfaceWeaveView from "./SurfaceWeaveView.vue";
import { surfaceIdForToolBlock } from "./tool-surface-correlation";

const props = defineProps<RunSurfaceRendererProps>();
const surfaceId = computed(() => surfaceIdForToolBlock(props.block.id));
</script>

<template><SurfaceWeaveView :surface-id="surfaceId" /></template>
```

```vue
<!-- SurfaceWeaveView.vue: this component receives only surfaceId. -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { SurfaceViewHandle } from "@surfaceweave/core";
import { surfaceDriver } from "./surfaceweave-host";

const props = defineProps<{ surfaceId: string }>();
const target = ref<Element | null>(null);
let handle: SurfaceViewHandle | undefined;

onMounted(() => {
  handle = surfaceDriver.mount(target.value!, {
    surfaceId: props.surfaceId,
    mode: "compact",
  });
});
watch(
  () => props.surfaceId,
  (surfaceId) => handle?.update({ surfaceId, mode: "compact" }),
);
onBeforeUnmount(() => handle?.unmount());
</script>

<template><div ref="target" /></template>
```

Mount the workspace view with the same singleton driver and Store:

```ts
const workspace = surfaceDriver.mount(workspaceElement, {
  surfaceId,
  mode: "workspace",
});
```

Chat and workspace now subscribe to one `SurfaceStore`; edits made in either
view are immediately visible in the other. This is a React Renderer mounted by
a Vue host, not a Vue Renderer or an Agentdown-specific Adapter.

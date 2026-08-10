# @surfaceweave/agent-tools

Framework-independent Agent UI tool definitions and the Tool-to-UI orchestration
boundary. The host remains responsible for executing business tools.

```sh
npm install @surfaceweave/core@next @surfaceweave/generator@next @surfaceweave/agent-tools@next
```

The unreleased `main` branch isolates event/request observer failures through
`ToolToUIRuntimeOptions.onListenerError`. Call `disposeInvocation(id)` when a
host interaction is no longer addressable, or `dispose()` when tearing down the
entire Runtime, to release Runtime-owned Surface subscriptions and transient
results.

The same unreleased branch publishes strict Semantic LayoutSpec JSON Schemas in
`ui.applyOperations`. Agent `setLayout` and grouped-node writes reject CSS,
DOM, `className`, and vendor properties before Surface state changes.

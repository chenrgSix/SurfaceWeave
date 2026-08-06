# ADR 0001: No Frontend Workflow Engine

- Status: Accepted
- Date: 2026-08-06
- Baseline: Milestone 5 (`603e029`)

## Context

Dynamic UI may participate in a multi-tool business interaction, but ownership
of tool order, conditions, retries across tools, and the next business step must
remain with the embedding Agent or backend. Moving those decisions into the SDK
would duplicate business policy, weaken host authorization boundaries, and turn
a UI runtime into a second workflow system.

## Decision

This project will not implement a frontend workflow engine. The Dynamic UI
Runtime only accepts the current Tool or Surface, renders and adjusts semantic
UI, retains current-interaction data, validates arguments, emits
`ActionIntent`, presents loading/error/result state, and accepts the next
Surface supplied by its host.

Lightweight presentation continuity is allowed: Surface replace, push, back,
update, and close navigation; `correlationId`; and `parentInvocationId`. These
records may relate UI state and invocations, but they must not select business
steps or execute work in the background.

The following are explicitly outside this project:

- workflow DSLs or frontend business-rule engines;
- DAG or BPMN execution;
- durable process instances or approval orchestration;
- scheduled tasks or background process executors;
- compensation systems for failed business operations.

## Current Implementation Audit

Milestone 5 already provides multiple independent Surfaces in `SurfaceStore`,
atomic `replaceSurface`, a closed per-tool Invocation state machine,
`correlationId`, source/result Surface links, and host-delivered next Surfaces.
Those primitives satisfy the current lightweight interaction-state needs.
Therefore no `InteractionSession` abstraction is introduced.

## Consequences

Hosts remain responsible for Agent planning, authorization, multi-tool
coordination, durable process state, compensation, and deciding what Surface
comes next. Future navigation metadata must remain optional and serializable;
it must not grow transition rules, business conditions, timers, workers, or
durable orchestration semantics.

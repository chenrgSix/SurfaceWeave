# Changelog

All notable changes to SurfaceWeave will be documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and package
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0-rc.4] - 2026-08-10

### Added

- Added language-neutral Semantic LayoutSpec and client-capability contracts,
  including standalone Draft 2020-12 JSON Schemas.
- Added deterministic form sections, portable layout hints, strict Agent layout
  operations, and shared fallback across the default, React Aria, Ant Design,
  and framework-agnostic renderers.
- Added host-filtered Component Pack capability snapshots shared with
  `ui.inspectComponentPacks`.
- Added ToolInvocation-backed Action state, a non-Tool Action controller,
  optional React binding state, and a host-only interaction gate.
- Added opt-in Surface, JSON, and Operation resource policy budgets.
- Added explicit Store and Tool Runtime disposal APIs plus observer-error
  reporting hooks.

### Changed

- Coalesced pending duplicate Tool submissions and made safe retry reuse the
  original normalized input and idempotency key.
- Included release-script and tea-purchase example tests in the default Vitest
  run.
- Made protected multi-package publication safely resumable by comparing local
  and Registry artifact integrity.

### Fixed

- Prevented duplicate Invocation creation and invalid result transitions from
  leaving orphan Surface or result state.
- Isolated failing event listeners from committed Store and Runtime state.
- Kept grid-item span out of container styles across all React Component Packs.

## [0.1.0-rc.3] - 2026-08-09

### Added

- Added the framework-neutral Generic Renderer Driver contract.
- Added the optional `@surfaceweave/react/dom` entry point and external Vue 3
  plus Agentdown consumer validation.

## [0.1.0-rc.2] - 2026-08-07

### Fixed

- Assigned distinct deterministic identities to nested result groups and
  values so Tool Runtime array results produce valid Surfaces.
- Moved `next` and `latest` away from the defective RC.1 release.

## [0.1.0-rc.1] - 2026-08-07

### Added

- GitHub CI for cold builds, package consumers, release metadata, and Tauri.
- Contributor, security, issue, and pull request guidance.

### Changed

- Prepared all public packages as the synchronized `0.1.0-rc.1` suite.
- Adopted MIT package licensing and the official npm Registry.
- Replaced the provisional protocol URL with a stable URN.

### Fixed

- Serialized workspace builds so clean clones build upstream declarations
  before dependent packages.
- Allowed inert code-like text in declarations while preserving JSON,
  prototype, framework, and renderer execution boundaries.

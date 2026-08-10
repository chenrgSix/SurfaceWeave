# Changelog

All notable changes to SurfaceWeave will be documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and package
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Added configurable Surface, JSON, and Operation resource budgets.
- Added explicit Store and Tool Runtime disposal APIs plus observer-error
  reporting hooks.

### Changed

- Included release-script and tea-purchase example tests in the default Vitest
  run.
- Made protected multi-package publication safely resumable by comparing local
  and Registry artifact integrity.

### Fixed

- Prevented duplicate Invocation creation and invalid result transitions from
  leaving orphan Surface or result state.
- Isolated failing event listeners from committed Store and Runtime state.

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

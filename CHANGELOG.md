# Changelog

All notable changes to SurfaceWeave will be documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and package
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

The synchronized package suite is published under the npm `next` tag. It
remains experimental; see the post-publish validation report before use.

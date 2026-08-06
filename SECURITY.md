# Security Policy

## Supported Versions

Security fixes are applied to the `main` branch and the current `0.1.0-rc.x`
line while SurfaceWeave remains experimental. No compatibility or support claim
is made for unpublished snapshots or older prereleases.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability. Use the repository's
[private vulnerability reporting](https://github.com/chenrgSix/SurfaceWeave/security/advisories/new)
form and include reproduction steps, affected packages, expected impact, and
any suggested mitigation. Maintainers will acknowledge the report and
coordinate disclosure after validating the issue.

## Security Boundaries

SurfaceWeave treats Surface and Component Pack documents as untrusted JSON.
Core accepts only plain JSON values, rejects prototype-polluting and
framework-specific declaration fields, and resolves only registered semantic
components and actions. Renderers must not evaluate dynamic code or inject raw
HTML. Components emit `ActionIntent`; only a host-owned executor may perform
network, filesystem, Tauri command, authorization, or other side effects.

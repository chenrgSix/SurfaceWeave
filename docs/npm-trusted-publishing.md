# npm Trusted Publishing

SurfaceWeave releases should use GitHub Actions OIDC rather than a long-lived
npm automation token. The release workflow is `.github/workflows/release.yml`;
it does not run on branches or manual dispatches.

RC.2 through RC.6 successfully used this path for all ten packages. The latest
published provenance ties RC.6 to `refs/tags/v0.1.0-rc.6`, commit
`5c1e070018306827dbe5b9435b323ef57be08cd1`, and the
[release workflow](https://github.com/chenrgSix/SurfaceWeave/actions/runs/33385003085).
npm `next` resolves to RC.6; `latest` intentionally remains on RC.2.

## Observed environment review status

At RC.6 publication on 2026-08-31, the GitHub API reported
`protection_rules: []` for `npm-release`. The environment binds the npm OIDC
identity, but currently does not pause for required reviewer approval. RC.6
was explicitly authorized by the repository owner before its tag was pushed;
no environment permissions or protection settings were changed. The required
reviewer configuration described below remains outstanding and must not be
reported as a verified GitHub approval gate.

## One-time Owner Setup

1. Create a protected GitHub Environment named `npm-release` and require an
   owner review before deployment.
2. For each of the ten `@surfaceweave/*` packages, add a GitHub Actions trusted
   publisher in npm with owner `chenrgSix`, repository `SurfaceWeave`, workflow
   filename `release.yml`, environment `npm-release`, and publish permission.
3. Confirm all packages trust the same workflow before revoking the temporary
   granular access token used for `0.1.0-rc.1`.
4. After one OIDC release succeeds, disallow token-based publishing for each
   package if the npm organization policy permits it.

Trusted Publishing requires npm `11.5.1` or newer on a GitHub-hosted runner.
The publish job uses Node 24 and pinned npm 11.6.0 without dependency caching, requests only
`contents: read` and `id-token: write`, and binds publishing to the
`npm-release` environment. Required-reviewer approval depends on the outstanding
environment configuration described above. Public packages published from a public repository receive
npm provenance automatically; the workflow also passes `--provenance`.

Official references: [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/),
[npm provenance](https://docs.npmjs.com/generating-provenance-statements/), and
[GitHub OIDC](https://docs.github.com/en/actions/reference/security/oidc).

## Release Procedure

1. Update all package versions and exact internal dependencies atomically.
2. Run the complete release checklist from a clean checkout and commit it.
3. Create an annotated tag matching the prepared version on `main`.
4. Push only that tag after explicit owner approval.
5. Review and approve the `npm-release` environment deployment.

The workflow re-runs build, typecheck, lint, tests, package consumers, release
metadata, and Tauri checks before approval. It rebuilds in the publish job,
publishes packages in dependency order, checks Registry integrity and clean
consumers, then creates the matching GitHub prerelease. A partial publish may
be retried from the same immutable tag: the release script skips only artifacts
whose locally packed integrity exactly matches npm and resumes with the first
missing package. It stops on any integrity mismatch. Never overwrite or
unpublish an accepted artifact; use a new RC after a mismatched build.

Do not store `NODE_AUTH_TOKEN`, an npm token, or a user `.npmrc` in this
repository or GitHub Actions once Trusted Publishing is configured.

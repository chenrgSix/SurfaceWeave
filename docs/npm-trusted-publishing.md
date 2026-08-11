# npm Trusted Publishing

SurfaceWeave releases should use GitHub Actions OIDC rather than a long-lived
npm automation token. The release workflow is `.github/workflows/release.yml`;
it does not run on branches or manual dispatches.

RC.2 through RC.4 successfully used this path for all ten packages. The latest
published provenance ties RC.4 to `refs/tags/v0.1.0-rc.4`, commit
`58e28953b82619af3e60d83cd2f9d9e913802952`, and the protected release
workflow. RC.5 remains an unpublished candidate until a separately approved
tag triggers that same path.

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
The publish job uses Node 24 without dependency caching, requests only
`contents: read` and `id-token: write`, and relies on the protected environment
for human approval. Public packages published from a public repository receive
npm provenance automatically; the workflow also passes `--provenance`.

Official references: [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/),
[npm provenance](https://docs.npmjs.com/generating-provenance-statements/), and
[GitHub OIDC](https://docs.github.com/en/actions/reference/security/oidc).

## Release Procedure

1. Update all package versions and exact internal dependencies atomically.
2. Run the complete release checklist from a clean checkout and commit it.
3. Create an annotated tag matching the prepared version, for example
   `git tag -a v0.1.0-rc.5 -m "SurfaceWeave 0.1.0-rc.5"`, on `main`.
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

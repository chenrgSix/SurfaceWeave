# RC Post-Publish Validation

## Decision

`@surfaceweave/*@0.1.0-rc.1` is installable and its package boundaries are
sound, but it must not be promoted as the stable release. Publish a new
`0.1.0-rc.2` after resolving the blockers below; do not overwrite or unpublish
the immutable RC.

Validated on 2026-08-07 against npm's official Registry and release commit
`de83e18d45bd7b9dff7966a6971fa80f2a8ed7e7`.

## Published Artifacts

All ten packages report version `0.1.0-rc.1`, MIT, the canonical repository,
the expected exports, exact internal RC dependencies, and declared peers. Each
tarball contains the canonical `LICENSE`; downloaded bytes match both Registry
SHA-512 integrity and SHA-1 shasum. Every package's `gitHead` matches the
release commit.

| Package                     | Files | SHA-512 integrity                                                                          |
| --------------------------- | ----: | ------------------------------------------------------------------------------------------ |
| `@surfaceweave/protocol`    |     6 | `j3F8YlibtlDj5eTGNTDb97aIuWtu0up8zQCqCnAm90MNBV73Q5222TjKFoUM1uNVkKoPbrNIAUi/mI/aga/Ucg==` |
| `@surfaceweave/core`        |    59 | `owkarVZ6dhzxWkgLCeVvsfjPqp5929whnlLw2OZrAAvNyBgHX9sLgqBBLC4uZ3BaWCs2GoAEFv2N6U5C/XbWnw==` |
| `@surfaceweave/storage`     |    27 | `vYrRMXVlS/1Tymb51ZBT/P3RWLgkF5wu2PhruDdbqNrqdme3kdG1wlwXK+E1mJ8b0uyUpI6nIQNNxmlDRqlqXw==` |
| `@surfaceweave/preferences` |    23 | `qkNfP74Q6cb+2VHK2lWdLwulgqqZjaqE6zBF/RWyctrepnVocQcz2KYJ/SxGjbDBetC8VK5GZCeFRGUiPYu+9Q==` |
| `@surfaceweave/generator`   |    27 | `m41ZliEyVWWPmkIMfRr+UkeH5EtYtcVB4Mf+/NEwVdVRVlukZ52k1U/PfDUmhbv7s6cH16hvV5MAoK23d+lelg==` |
| `@surfaceweave/agent-tools` |    35 | `gTD+/xTrvVqUqFSeA1aEOdBlgJi10JBDpPzd4ZUFMjADcuQk7BK/ctDYGihdv9EW9ZAnXt0JXzud7zl0AzFpMA==` |
| `@surfaceweave/react`       |    27 | `bMbtGWxUKgV6yuTMWklwWObX+nvrxqH6VfT41mi5ErpFv03/nNc22EMMD6F5+RDNSkHZdcBcKrTImJ5tnMdS5Q==` |
| `@surfaceweave/react-aria`  |    20 | `gTi9FlYZPCdJRlgvN0nCKQ56GuuvrQXvYCw+khS78BwWG/V2xNtb+SE8k2OfP2HP5Qx/tRR+wXUE2hYcR4yDBw==` |
| `@surfaceweave/antd`        |    19 | `vudWUI7ubikb+vmWfT/n8cfowxO6JVsJLM6KdRS59SmcFf2noTiGbJPwRAHG5knQ2TIz2ea+SixIswti2kqZkg==` |
| `@surfaceweave/tauri`       |    23 | `Bylb8+H3lW2/ABI3DF6oUV3ZJJA0gtHsW14ZakpbVPICKSAgunWVJ67woet3IKvq4BPR7/Ht+1uzucF8xEoVLA==` |

## External Consumers

Fresh projects outside the repository installed only official Registry
packages with an empty user config. Their lockfiles contain no workspace,
`file:`, link, repository-source, or non-official Registry resolution.

| Scenario                             | Result                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Protocol and framework-agnostic Core | Pass: imports, runtime smoke, and blocked internal subpath                            |
| Default React Pack                   | Pass: typecheck and Vite build, 48.37 kB JS                                           |
| React Aria Pack only                 | Pass: typecheck and Vite build, 341.58 kB JS; AntD absent                             |
| Ant Design Pack only                 | Pass: typecheck and Vite build, 1,052.63 kB JS; other Pack absent                     |
| Tauri adapter                        | Pass: typecheck and Vite build, 13.46 kB JS                                           |
| README Tool-to-UI API                | Pass: public imports, registration, Surface creation, Host request, and scalar result |
| Tea Tool-to-UI array result          | **Fail:** result Surface validation rejects a duplicated node id                      |

The Ant Design-only chunk warning is the library's isolated cost, not Pack
leakage. The demo still intentionally imports all selectable Packs.

## Clean Checkout

A new clone of public `main` contained no `dist/` directories and passed under
Node `22.23.1` and pnpm `10.34.4`: frozen install, cold build, typecheck, lint,
109 tests, release metadata audit, ten tarballs/seven clean consumers,
`cargo check`, and `pnpm build:tauri --no-bundle`. GitHub's public CI badge is
passing.

## Findings

### Blockers

1. `generateResultSurface` gives an object-field `Accordion` and its nested
   array child the same node id (for example
   `tea-search--result-1--result.teas`). `resolveInvocation` consequently
   throws `INVALID_SURFACE`. RC.2 must assign distinct wrapper/child ids and add
   Generator plus end-to-end Tool Runtime regression tests for nested arrays.
2. npm metadata points to the correct commit, but the repository has no
   `v0.1.0-rc.1` tag and no GitHub Release. The manual token publication also
   has no GitHub Actions provenance. Record the old RC without rewriting it;
   require an annotated tag, protected environment, OIDC, and provenance for
   RC.2.
3. The npm Trusted Publisher and protected `npm-release` GitHub Environment
   must be configured for all ten packages before the new release workflow can
   publish.

### Should Fix

- Both npm `next` and `latest` currently resolve to the prerelease. Keep
  consumers on explicit `@next`; reserve `latest` for a stable version when one
  exists.
- Revoke the temporary granular npm token after Trusted Publishing is proven.
- Push the post-publish validation and release-gate commits before cutting
  RC.2; do not run the workflow from unreviewed local state.

### Later

- Optional Pack lazy loading and demo chunk splitting.
- Windows/Linux Tauri packaging validation.
- Vue and Flutter renderer implementations. These remain renderer candidates,
  not RC.2 scope.

## Proposed RC.2 Scope

Fix only nested result node identity, add the two regression levels, bump all
ten packages and exact internal dependencies atomically to `0.1.0-rc.2`, run
all local and Registry gates, then release through Trusted Publishing. Do not
add product features, workflow behavior, or new renderers.

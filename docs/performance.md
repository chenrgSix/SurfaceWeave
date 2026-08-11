# Performance

SurfaceWeave treats performance as a measured compatibility property. The
benchmark suite exercises the same public Core and React APIs used by hosts; it
does not replace correctness, package, or release gates.

## Commands

Run benchmarks with Node 22 and the repository-pinned pnpm version:

```bash
pnpm benchmark
pnpm benchmark:smoke
pnpm benchmark:core -- --json
pnpm benchmark:react -- --json
```

The Core benchmark covers traversal, defensive cloning, validation, data
updates, listener fan-out, and a deeply nested tree. The React benchmark uses
jsdom to measure Store-to-commit latency, record render fan-out, and isolate
Component Pack resolution. `--sizes=50,500,2000` and `--listeners=0,1,5`
override the default Core matrix.

`benchmark:smoke` is a short wiring and correctness check run by CI. Wall-clock
results remain informational because shared CI runners are noisy. Render-count
and semantic assertions may be used as hard gates.

## RC.5 baseline

Recorded on 2026-08-11 with Node 22.23.1 on macOS arm64, using the recommended
Surface resource policy. Times are milliseconds per operation after warm-up.

### Core

| Nodes | Metric                   |     p50 |     p95 |
| ----: | ------------------------ | ------: | ------: |
|    50 | validate Surface         |   2.801 |   6.484 |
|    50 | update data, 0 listeners |   2.921 |   7.372 |
|   500 | validate Surface         |  25.917 |  27.462 |
|   500 | update data, 0 listeners |  26.549 |  27.664 |
| 2,000 | validate Surface         | 104.267 | 105.933 |
| 2,000 | update data, 0 listeners | 110.672 | 114.066 |
| 2,000 | update data, 1 listener  | 114.102 | 159.447 |
| 2,000 | update data, 5 listeners | 122.037 | 145.236 |

At 2,000 nodes, traversal was 0.013 ms p50 and cloning was 2.011 ms p50.
Validation therefore dominates the Core update path in this baseline. The
depth-64 fixture raises `maxJsonDepth` to 256 explicitly because each tree
level also introduces JSON object and array nesting.

### React with jsdom

| Nodes | Initial mount and unmount p50 | Update through commit p50 | Update p95 | Nodes rendered |
| ----: | ----------------------------: | ------------------------: | ---------: | -------------: |
|    50 |                         6.744 |                     5.768 |      6.975 |             50 |
|   500 |                        30.367 |                    50.681 |     76.858 |            500 |
| 2,000 |                       113.009 |                   171.309 |    197.881 |          2,000 |

A one-path update renders the root, target, and every sibling in RC.5. The
optimization target is one target component per mounted view, zero unrelated
sibling renders, a 2,000-node Core update p50 no higher than 15 ms and p95 no
higher than 20 ms on the reference machine, and at least a 5x improvement over
this baseline. A real Chromium benchmark is required before making browser
frame-budget claims; jsdom is only the deterministic local diagnostic layer.

## Compatibility constraints

Performance work must preserve Wire Protocol 1.0, the single global
`baseRevision`, atomic commits, deterministic events, listener isolation,
resource policy enforcement, and Core's framework independence. Existing
custom `SurfaceStore` implementations must keep compiling and receive a
compatible fallback path when optional optimized observation capabilities are
not present.

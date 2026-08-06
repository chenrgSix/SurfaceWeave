# npm Compatibility Matrix

| Package                     | Runtime boundary              | Required peers or host                                    | Verified environment                                                   |
| --------------------------- | ----------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `@surfaceweave/protocol`    | JSON/docs only                | None                                                      | Node JSON import; language-neutral Schema                              |
| `@surfaceweave/core`        | Framework-agnostic ESM        | None                                                      | Node 22, strict CSP, no DOM lib                                        |
| `@surfaceweave/storage`     | Framework-agnostic ESM        | Browser only for `LocalStorageAdapter`                    | Node 22 and browser build                                              |
| `@surfaceweave/preferences` | Framework-agnostic ESM        | Core and Storage                                          | Node 22                                                                |
| `@surfaceweave/generator`   | Framework-agnostic ESM        | Core                                                      | Node 22                                                                |
| `@surfaceweave/agent-tools` | Framework-agnostic ESM        | Core, Generator, Preferences, Storage                     | Node 22                                                                |
| `@surfaceweave/react`       | React binding                 | React `>=18.2 <20`                                        | React 19.2, Vite 8                                                     |
| `@surfaceweave/react-aria`  | Optional React Pack           | React/DOM `>=18.2 <20`, React Aria Components `>=1.20 <2` | React 19.2, RAC 1.20, Vite 8                                           |
| `@surfaceweave/antd`        | Optional React Pack           | React/DOM `>=18.2 <20`, Ant Design `>=6.5.3 <7`           | React 19.2, AntD 6.5, Vite 8                                           |
| `@surfaceweave/tauri`       | Optional Tauri 2 host adapter | Tauri API `^2.8`, Store plugin `^2.4`                     | Clean TypeScript/Vite consumer, Cargo check, macOS Tauri release build |

TypeScript 6.0 is the verified declaration consumer. Windows/Linux Tauri
packaging, CommonJS, React 20, Ant Design 7, React Aria 2, and older TypeScript
versions are not claimed by this RC.

## Pack Isolation Evidence

Each Vite build used tarballs in a clean project where unselected Packs were not
installed:

| Consumer      | Installed Pack                   | Minified JS |
| ------------- | -------------------------------- | ----------: |
| React default | none beyond the default renderer |    48.59 kB |
| React Aria    | React Aria only                  |   341.81 kB |
| Ant Design    | Ant Design only                  | 1,052.84 kB |

Default and React Aria remain below Vite's 500 kB warning threshold. Ant Design
alone exceeds it; the other Packs are physically absent, so this is AntD cost,
not cross-Pack leakage. The tea demo intentionally imports three selectable
Packs and therefore remains larger. Runtime Pack downloading is not part of
this release.

export const releaseVersion = "0.1.0-rc.3";
export const npmRegistry = "https://registry.npmjs.org/";
export const repositoryUrl =
  "git+https://github.com/chenrgSix/SurfaceWeave.git";

export const releasePackages = [
  { name: "@surfaceweave/protocol", directory: "protocol", kind: "protocol" },
  {
    name: "@surfaceweave/core",
    directory: "packages/core",
    kind: "typescript",
  },
  {
    name: "@surfaceweave/storage",
    directory: "packages/storage",
    kind: "typescript",
  },
  {
    name: "@surfaceweave/preferences",
    directory: "packages/preferences",
    kind: "typescript",
  },
  {
    name: "@surfaceweave/generator",
    directory: "packages/generator",
    kind: "typescript",
  },
  {
    name: "@surfaceweave/agent-tools",
    directory: "packages/agent-tools",
    kind: "typescript",
  },
  {
    name: "@surfaceweave/react",
    directory: "packages/renderer-react",
    kind: "typescript",
  },
  {
    name: "@surfaceweave/react-aria",
    directory: "packages/component-pack-react-aria",
    kind: "typescript",
  },
  {
    name: "@surfaceweave/antd",
    directory: "packages/component-pack-antd",
    kind: "typescript",
  },
  {
    name: "@surfaceweave/tauri",
    directory: "packages/tauri",
    kind: "typescript",
  },
];

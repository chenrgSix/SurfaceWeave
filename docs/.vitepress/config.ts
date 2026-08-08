import { defineConfig } from "vitepress";

export default defineConfig({
  title: "SurfaceWeave",
  description: "A protocol-first runtime for agent-generated, tool-driven UI.",
  lang: "en-US",
  base: "/SurfaceWeave/",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", href: "/SurfaceWeave/surfaceweave-mark.svg" }],
    ["meta", { name: "theme-color", content: "#6d5dfc" }],
    [
      "meta",
      {
        property: "og:image",
        content:
          "https://chenrgsix.github.io/SurfaceWeave/assets/tea-purchase-demo.jpg",
      },
    ],
  ],
  sitemap: {
    hostname: "https://chenrgsix.github.io/SurfaceWeave/",
  },
  themeConfig: {
    logo: "/surfaceweave-mark.svg",
    siteTitle: "SurfaceWeave",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Architecture", link: "/dynamic-ui-architecture" },
      {
        text: "0.1.0-rc.2",
        items: [
          { text: "Release summary", link: "/rc2-release-candidate-summary" },
          { text: "Compatibility matrix", link: "/npm-compatibility-matrix" },
        ],
      },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Get started",
          items: [
            { text: "Introduction", link: "/guide/getting-started" },
            { text: "Tool-to-UI runtime", link: "/guide/tool-to-ui" },
            { text: "React renderer", link: "/guide/react-renderer" },
            {
              text: "Generic Renderer Driver",
              link: "/guide/generic-renderer-driver",
            },
          ],
        },
        {
          text: "Integrations",
          items: [
            { text: "Component Packs", link: "/guide/component-packs" },
            {
              text: "Preferences and storage",
              link: "/guide/preferences-storage",
            },
            { text: "Tauri", link: "/guide/tauri" },
          ],
        },
        {
          text: "References",
          items: [
            { text: "Public API", link: "/public-api" },
            {
              text: "Wire protocol",
              link: "https://github.com/chenrgSix/SurfaceWeave/blob/main/protocol/component-pack-protocol.md",
            },
            { text: "Architecture", link: "/dynamic-ui-architecture" },
            {
              text: "Security policy",
              link: "https://github.com/chenrgSix/SurfaceWeave/blob/main/SECURITY.md",
            },
          ],
        },
      ],
    },
    outline: { level: [2, 3] },
    search: { provider: "local" },
    socialLinks: [
      { icon: "github", link: "https://github.com/chenrgSix/SurfaceWeave" },
    ],
    editLink: {
      pattern: "https://github.com/chenrgSix/SurfaceWeave/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 SurfaceWeave contributors",
    },
  },
});

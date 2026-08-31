import {
  standardComponentManifests,
  type ComponentManifest,
  type JsonObject,
} from "@surfaceweave/core";

export const PAGE_ID = "live-application";
const enumProp = (...values: string[]) => ({ type: "string", enum: values });
const text = (maxLength = 300) => ({ type: "string", maxLength });
/** Semantic design tokens. Only the trusted React binding maps these to CSS. */
export const paletteVariables = {
  background: "--page",
  surface: "--panel",
  soft: "--soft",
  text: "--ink",
  muted: "--subtle",
  border: "--line",
  accent: "--accent",
  accentSoft: "--accent-soft",
  navigation: "--nav",
  positive: "--good",
} as const;
export const pageManifests: ComponentManifest[] = [
  {
    semanticType: "StudioApplication",
    description:
      "Application shell with any validated hex palette and four navigation edges. Palette overrides preset theme colors.",
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        theme: enumProp("light", "midnight", "mint", "paper"),
        navigation: enumProp("side", "left", "right", "top", "bottom"),
        density: enumProp("comfortable", "compact"),
        palette: {
          type: "object",
          additionalProperties: false,
          properties: Object.fromEntries(
            Object.keys(paletteVariables).map((key) => [
              key,
              { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
            ]),
          ),
        },
      },
    },
  },
  {
    semanticType: "StudioHeader",
    description: "Application heading: plain text, never markup.",
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: { title: text(100), eyebrow: text(100) },
    },
  },
  {
    semanticType: "StudioCard",
    description:
      "New informational card with optional title, description, badge and semantic child layout. Generated text is display content, not business evidence.",
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: { title: text(100), description: text(600), badge: text(60) },
    },
  },
  {
    semanticType: "StudioStat",
    description:
      "New display-only metric. Value and label are model-authored presentation, not live business data.",
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: { label: text(100), value: text(100), detail: text(300) },
    },
  },
  ...[
    "StudioNavigation",
    "StudioBody",
    "StudioContent",
    "StudioOverview",
    "StudioMetrics",
    "StudioRecovery",
    "StudioMirror",
    "StudioActivity",
  ].map((semanticType): ComponentManifest => ({
    semanticType,
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  })),
];
export const pageContentManifests = standardComponentManifests.filter(
  (manifest) =>
    ["Text", "Badge", "Section", "Stack", "Grid"].includes(
      manifest.semanticType,
    ),
);
export const pageComponentNames = [
  ...pageManifests,
  ...pageContentManifests,
].map((manifest) => manifest.semanticType);

/** Defense in depth: even a caller bypassing the SDK cannot turn a token into CSS code. */
export function paletteStyle(palette: unknown): Record<string, string> {
  if (!palette || typeof palette !== "object" || Array.isArray(palette))
    return {};
  return Object.fromEntries(
    Object.entries(paletteVariables).flatMap(([key, variable]) => {
      const value = (palette as JsonObject)[key];
      return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
        ? [[variable, value]]
        : [];
    }),
  );
}

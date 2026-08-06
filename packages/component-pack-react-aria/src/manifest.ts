import { cloneValue, standardComponentManifests } from "@package-first/core";
import type { ComponentPackManifest } from "@package-first/core";

/** Serializable and safe to pass through JSON without React runtime values. */
export const reactAriaComponentPackManifest: ComponentPackManifest = {
  protocolVersion: "1.0",
  id: "react-aria",
  version: "1.0.0",
  rendererKind: "react",
  priority: 20,
  capabilities: ["web"],
  components: cloneValue(standardComponentManifests),
  agentGuidance: {
    summary:
      "Use standard semantic components; this pack supplies accessible React Aria behavior.",
    usage: [
      "Prefer visible labels and concise descriptions.",
      "Use ChoiceField for both single and multiple selection.",
    ],
    avoid: ["Do not emit renderer-specific presentation or event details."],
  },
};

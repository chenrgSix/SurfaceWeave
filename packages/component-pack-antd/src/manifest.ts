import { cloneValue, standardComponentManifests } from "@package-first/core";
import type { ComponentPackManifest } from "@package-first/core";

/** Serializable protocol declaration; Ant Design runtime values live elsewhere. */
export const antDesignComponentPackManifest: ComponentPackManifest = {
  protocolVersion: "1.0",
  id: "antd",
  version: "1.0.0",
  rendererKind: "react",
  priority: 15,
  capabilities: ["web"],
  components: cloneValue(standardComponentManifests),
  agentGuidance: {
    summary:
      "Use the standard semantic catalog; this pack provides enterprise-oriented rendering.",
    usage: [
      "Use DataTable for structured row data.",
      "Use Dialog only for explicit confirmation intent.",
    ],
    avoid: ["Do not emit renderer-specific presentation or event details."],
  },
};

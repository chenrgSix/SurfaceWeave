import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { standardComponentManifests } from "../src/index.js";

const schemaPath = fileURLToPath(
  new URL(
    "../../../protocol/schemas/dynamic-ui-wire.schema.json",
    import.meta.url,
  ),
);
const wireSchema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
const layoutSchema = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../protocol/schemas/semantic-layout-1.0.schema.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as object;
const capabilitySchema = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../protocol/schemas/surface-client-capabilities-1.0.schema.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as object;

describe("language-independent wire schema", () => {
  it("validates manifests and Surfaces without TypeScript types", () => {
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    ajv.addSchema(wireSchema);
    const manifestValidator = ajv.getSchema(
      "urn:surfaceweave:schema:dynamic-ui-wire:1.0#/$defs/componentPackManifest",
    );
    const surfaceValidator = ajv.getSchema(
      "urn:surfaceweave:schema:dynamic-ui-wire:1.0#/$defs/surface",
    );
    expect(manifestValidator).toBeTypeOf("function");
    expect(surfaceValidator).toBeTypeOf("function");

    expect(
      manifestValidator?.({
        protocolVersion: "1.0",
        id: "fake",
        version: "1.0.0",
        rendererKind: "fake",
        components: [standardComponentManifests[0]],
      }),
    ).toBe(true);
    expect(
      surfaceValidator?.({
        id: "surface",
        revision: 0,
        intent: "form",
        tree: {
          id: "name",
          component: "TextInput",
          props: { label: "Name" },
          binding: { path: "name", valueType: "string" },
        },
        data: { name: "Ada" },
        context: {},
      }),
    ).toBe(true);
  });

  it("rejects framework props while preserving inert code-like text", () => {
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    ajv.addSchema(wireSchema);
    const validate = ajv.getSchema(
      "urn:surfaceweave:schema:dynamic-ui-wire:1.0#/$defs/surface",
    );
    expect(
      validate?.({
        id: "technical-copy",
        revision: 0,
        intent: "browse",
        tree: {
          id: "docs",
          component: "Text",
          props: {
            code: "A => B; function(example); import(module); <script>",
          },
        },
        data: {},
        context: {},
      }),
    ).toBe(true);
    expect(
      validate?.({
        id: "unsafe",
        revision: 0,
        intent: "form",
        tree: {
          id: "name",
          component: "TextInput",
          props: { className: "vendor", label: "ordinary text" },
        },
        data: {},
        context: {},
      }),
    ).toBe(false);
  });

  it("fully validates preference events instead of accepting partial envelopes", () => {
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    ajv.addSchema(wireSchema);
    const validate = ajv.getSchema(
      "urn:surfaceweave:schema:dynamic-ui-wire:1.0#/$defs/uiEvent",
    );
    const event = {
      type: "preference.saved",
      sequence: 1,
      preference: {
        id: "collapse-remark",
        scope: "global",
        targetStableId: "purchase.remark",
        operation: {
          type: "setProps",
          target: "purchase.remark",
          props: { collapsed: true },
        },
      },
    };

    expect(validate?.(event)).toBe(true);
    expect(validate?.({ type: "preference.saved", sequence: 1 })).toBe(false);
  });

  it("publishes a strict standalone cross-language LayoutSpec", () => {
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    const validate = ajv.compile(layoutSchema);

    expect(
      validate({
        direction: "column",
        columns: 2,
        gap: 16,
        align: "stretch",
        modes: { compact: { columns: 1 } },
      }),
    ).toBe(true);
    expect(validate({ columns: 13 })).toBe(false);
    expect(validate({ className: "vendor-grid" })).toBe(false);
  });

  it("validates the optional JSON-only client capability handshake", () => {
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    ajv.addSchema(wireSchema);
    const validate = ajv.compile(capabilitySchema);
    expect(
      validate({
        wireProtocolVersion: "1.0",
        rendererKind: "fake",
        terminalCapabilities: ["terminal"],
        runtimeCapabilities: ["operations", "action-state"],
        acceptedPackVersions: { fake: ["1.0.0"] },
        components: [],
        packs: [],
        resourcePolicy: { enabled: false },
      }),
    ).toBe(true);
    expect(
      validate({
        wireProtocolVersion: "1.0",
        rendererKind: "react",
        terminalCapabilities: [],
        runtimeCapabilities: [],
        acceptedPackVersions: {},
        components: [],
        packs: [],
        resourcePolicy: { enabled: false },
        reactComponent: "Button",
      }),
    ).toBe(false);
  });
});

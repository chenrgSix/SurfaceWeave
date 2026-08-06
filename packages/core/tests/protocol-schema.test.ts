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
});

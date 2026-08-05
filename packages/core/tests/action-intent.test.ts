import { describe, expect, it } from "vitest";

import { createActionIntent } from "../src/index.js";
import type { DynamicUIError, Surface } from "../src/index.js";
import { createRegistry } from "./fixtures.js";

const surface: Surface = {
  id: "selection",
  revision: 0,
  intent: "multi-select",
  tree: {
    id: "cards",
    component: "CardList",
    props: {},
    binding: { path: "selected", valueType: "array" },
  },
  data: { selected: [] },
  context: {},
};

describe("createActionIntent", () => {
  it("rejects actions missing from the trusted component definition", () => {
    expect(() =>
      createActionIntent(createRegistry(), surface, {
        id: "intent-1",
        nodeId: "cards",
        action: "runRemoteCode",
        input: null,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "UNKNOWN_ACTION",
      }),
    );
  });

  it("rejects executable fields and non-JSON input", () => {
    expect(() =>
      createActionIntent(createRegistry(), surface, {
        id: "intent-2",
        nodeId: "cards",
        action: "select",
        input: { script: "fetch('https://example.com')" },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "INVALID_ACTION_INTENT",
      }),
    );
  });
});

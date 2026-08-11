import { describe, expect, it } from "vitest";

import {
  buildSurfaceIndex,
  findAffectedBindingNodeIds,
} from "../src/surface-index.js";
import type { Surface } from "../src/index.js";

describe("Surface index", () => {
  it("indexes ids, stable ids, duplicate bindings, and path prefixes", () => {
    const surface: Surface = {
      id: "indexed",
      revision: 0,
      intent: "form",
      tree: {
        id: "root",
        stableId: "stable.root",
        component: "Form",
        props: {},
        binding: { path: "profile", valueType: "object" },
        children: [
          {
            id: "name-primary",
            stableId: "stable.name-primary",
            component: "TextInput",
            props: {},
            binding: { path: "profile.name", valueType: "string" },
          },
          {
            id: "name-secondary",
            stableId: "stable.name-secondary",
            component: "TextInput",
            props: {},
            binding: { path: "profile.name", valueType: "string" },
          },
          {
            id: "unrelated",
            component: "TextInput",
            props: {},
            binding: { path: "settings.theme", valueType: "string" },
          },
        ],
      },
      data: {
        profile: { name: "Ada" },
        settings: { theme: "light" },
      },
      context: {},
    };

    const index = buildSurfaceIndex(surface);

    expect(index.nodesById.get("name-primary")?.stableId).toBe(
      "stable.name-primary",
    );
    expect(index.nodesByStableId.get("stable.root")?.id).toBe("root");
    expect(
      index.bindingsByPath
        .get("profile.name")
        ?.map((binding) => binding.nodeId),
    ).toEqual(["name-primary", "name-secondary"]);
    expect(findAffectedBindingNodeIds(index, ["profile.name"])).toEqual([
      "root",
      "name-primary",
      "name-secondary",
    ]);
    expect(findAffectedBindingNodeIds(index, ["settings"])).toEqual([
      "unrelated",
    ]);
  });
});

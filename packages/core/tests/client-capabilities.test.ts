import {
  createStandardComponentRegistry,
  createSurfaceClientCapabilities,
  inspectSurfaceComponentCatalog,
  standardComponentManifests,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

function registryFixture() {
  const registry = createStandardComponentRegistry();
  const text = standardComponentManifests.find(
    (component) => component.semanticType === "Text",
  )!;
  const action = standardComponentManifests.find(
    (component) => component.semanticType === "Action",
  )!;
  registry.registerPack({
    protocolVersion: "1.0",
    id: "web-basic",
    version: "1.0.0",
    rendererKind: "react",
    capabilities: ["web"],
    components: [action, text],
  });
  registry.registerPack({
    protocolVersion: "1.0",
    id: "mobile-material",
    version: "2.0.0",
    rendererKind: "flutter",
    capabilities: ["mobile"],
    components: [text],
  });
  return registry;
}

describe("Surface client capabilities", () => {
  it("creates a deterministic deep-cloned JSON-only host snapshot", () => {
    const registry = registryFixture();
    const options = {
      rendererKind: "react",
      enabledPackIds: ["mobile-material", "web-basic"],
      terminalCapabilities: ["web"],
      supportedPackVersions: { "web-basic": ["1.0.0"] },
      runtimeCapabilities: ["tool-invocation", "operations"] as const,
      resourcePolicy: {
        enabled: true,
        limits: { maxNodes: 500 },
      },
    };
    const first = createSurfaceClientCapabilities(registry, options);
    const second = createSurfaceClientCapabilities(registry, options);

    expect(first).toEqual(second);
    expect(first.packs.map((pack) => pack.id)).toEqual(["web-basic"]);
    expect(first.runtimeCapabilities).toEqual([
      "operations",
      "tool-invocation",
    ]);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(JSON.stringify(first)).not.toMatch(
      /ReactNode|Provider|HTMLElement|onClick|function\s*\(/,
    );

    first.packs[0]!.id = "tampered";
    first.components[0]!.type = "Tampered";
    expect(registry.listPacks()[0]!.id).toBe("mobile-material");
    expect(
      createSurfaceClientCapabilities(registry, options).packs[0]!.id,
    ).toBe("web-basic");
  });

  it("excludes disabled versions and prevents queries from widening policy", () => {
    const registry = registryFixture();
    const capabilities = createSurfaceClientCapabilities(registry, {
      rendererKind: "react",
      enabledPackIds: ["web-basic"],
      terminalCapabilities: ["web"],
      supportedPackVersions: { "web-basic": ["9.0.0"] },
    });
    expect(capabilities.packs).toEqual([]);

    const trusted = createSurfaceClientCapabilities(registry, {
      rendererKind: "react",
      enabledPackIds: ["web-basic"],
      terminalCapabilities: ["web"],
    });
    expect(
      inspectSurfaceComponentCatalog(trusted, {
        rendererKind: "flutter",
        terminalCapabilities: ["mobile"],
      }),
    ).toMatchObject({ packs: [], components: [] });
    expect(
      inspectSurfaceComponentCatalog(trusted, {
        terminalCapabilities: ["web", "remote-admin"],
      }).terminalCapabilities,
    ).toEqual(["web"]);
  });
});

import { createStandardComponentRegistry } from "@surfaceweave/core";
import { describe, expect, it } from "vitest";

import {
  createDefaultReactComponentPack,
  createStandardReactComponentRegistry,
} from "../src/index.js";

describe("ReactComponentRegistry", () => {
  it("caches equivalent resolutions and returns isolated diagnostics", () => {
    const trusted = createStandardComponentRegistry();
    const registry = createStandardReactComponentRegistry(trusted);
    const originalListPacks = trusted.listPacks.bind(trusted);
    let listPackCalls = 0;
    trusted.listPacks = () => {
      listPackCalls += 1;
      return originalListPacks();
    };

    const first = registry.resolve("TextInput", {
      capabilities: ["keyboard", "pointer"],
      packPriorities: { default: 1 },
    });
    const callsAfterFirstResolution = listPackCalls;
    first.resolution.fallbackChain.push("mutated");
    first.resolution.diagnostics.push({
      code: "FALLBACK_APPLIED",
      message: "mutated",
    });

    const second = registry.resolve("TextInput", {
      capabilities: ["pointer", "keyboard"],
      packPriorities: { default: 1 },
    });

    expect(listPackCalls).toBe(callsAfterFirstResolution);
    expect(second.resolution.fallbackChain).toEqual(["TextInput"]);
    expect(second.resolution.diagnostics).toEqual([]);
  });

  it("invalidates cached resolutions after a pack is registered", () => {
    const trusted = createStandardComponentRegistry();
    const registry = createStandardReactComponentRegistry(trusted);
    const originalListPacks = trusted.listPacks.bind(trusted);
    let listPackCalls = 0;
    trusted.listPacks = () => {
      listPackCalls += 1;
      return originalListPacks();
    };

    registry.resolve("TextInput");
    const callsBeforeRegistration = listPackCalls;
    const alternate = createDefaultReactComponentPack();
    registry.registerPack({
      ...alternate,
      manifest: {
        ...alternate.manifest,
        id: "alternate",
        priority: 10,
      },
    });

    expect(registry.resolve("TextInput").resolution.packId).toBe("alternate");
    expect(listPackCalls).toBeGreaterThan(callsBeforeRegistration);
  });
});

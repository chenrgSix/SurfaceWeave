import { describe, expect, it } from "vitest";

import { TauriCapabilityProvider } from "../src/index.js";

describe("TauriCapabilityProvider", () => {
  it("describes terminal features without claiming authorization", () => {
    const provider = new TauriCapabilityProvider({
      platform: "macos",
      desktop: true,
      filePicker: false,
      notifications: false,
      localStorage: true,
      nativeCommands: true,
    });

    const capabilities = provider.getCapabilities();

    expect(capabilities).toMatchObject({ desktop: true, nativeCommands: true });
    expect(capabilities).not.toHaveProperty("authorized");
    expect(capabilities).not.toHaveProperty("permissions");
    capabilities.nativeCommands = false;
    expect(provider.getCapabilities().nativeCommands).toBe(true);
  });
});

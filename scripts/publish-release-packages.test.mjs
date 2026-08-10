import { describe, expect, it } from "vitest";

import { comparePublishedArtifact } from "./publish-release-packages.mjs";

describe("release publish recovery", () => {
  it("publishes a missing version", () => {
    expect(
      comparePublishedArtifact("@surfaceweave/core", "0.1.0-rc.4", "sha512-a"),
    ).toBe("missing");
  });

  it("safely skips an identical immutable artifact", () => {
    expect(
      comparePublishedArtifact(
        "@surfaceweave/core",
        "0.1.0-rc.4",
        "sha512-a",
        "sha512-a",
      ),
    ).toBe("identical");
  });

  it("rejects an existing version with different integrity", () => {
    expect(() =>
      comparePublishedArtifact(
        "@surfaceweave/core",
        "0.1.0-rc.4",
        "sha512-local",
        "sha512-registry",
      ),
    ).toThrow(/different integrity/);
  });
});

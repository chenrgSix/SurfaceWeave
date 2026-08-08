import type {
  SurfaceRendererDriver,
  SurfaceViewHandle,
  SurfaceViewReference,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

interface FakeTarget {
  renderedSurfaceId?: string;
}

class FakeRendererDriver implements SurfaceRendererDriver<FakeTarget> {
  mount(
    target: FakeTarget,
    reference: SurfaceViewReference,
  ): SurfaceViewHandle {
    target.renderedSurfaceId = reference.surfaceId;
    return {
      update(nextReference) {
        target.renderedSurfaceId = nextReference.surfaceId;
      },
      unmount() {
        delete target.renderedSurfaceId;
      },
    };
  }
}

describe("SurfaceRendererDriver", () => {
  it("supports a framework-agnostic target", () => {
    const target: FakeTarget = {};
    const handle = new FakeRendererDriver().mount(target, {
      surfaceId: "chat",
      mode: "compact",
    });

    expect(target.renderedSurfaceId).toBe("chat");
    handle.update({ surfaceId: "workspace", mode: "workspace" });
    expect(target.renderedSurfaceId).toBe("workspace");
    handle.unmount();
    expect(target.renderedSurfaceId).toBeUndefined();
  });
});

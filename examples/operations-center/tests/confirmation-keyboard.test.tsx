// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { App } from "../src/App.js";

it("returns to editing with Escape without sending a host request", async () => {
  // jsdom lacks native dialog presentation; retain its actual DOM and events.
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const showModal = vi.fn();
  const close = vi.fn();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: showModal },
    close: { configurable: true, value: close },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const click = async (text: string) => {
    const button = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === text,
    );
    expect(button).toBeDefined();
    await act(() => button!.click());
  };
  try {
    await act(() => root.render(<App />));
    await click("让 Agent 生成处置台");
    await act(() =>
      container
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click(),
    );
    await click("核对并提交计划");
    expect(showModal).toHaveBeenCalledOnce();
    expect(container.querySelector("dialog")?.textContent).toContain(
      "最后一步，由你确认",
    );
    await act(() =>
      container.querySelector("dialog")!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(container.querySelector("dialog")).toBeNull();
    expect(close).toHaveBeenCalledOnce();
    expect(container.querySelector(".runtime-summary")?.textContent).toContain(
      "Invocation editing",
    );
    expect(container.querySelector(".runtime-summary")?.textContent).toContain(
      "Host requests 0",
    );
    await click("核对并提交计划");
    expect(showModal).toHaveBeenCalledTimes(2);
  } finally {
    await act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    vi.unstubAllGlobals();
  }
});

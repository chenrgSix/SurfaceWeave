// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { Studio } from "../src/Studio.js";

it("applies chat templates to the live application DOM and synchronizes input across restructured views", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  async function click(text: string) {
    const button = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === text,
    );
    expect(button).toBeDefined();
    await act(() => button!.click());
  }
  try {
    await act(() => root.render(<Studio />));
    // Narrow layouts hide the text visually; each menu action must keep its name.
    expect(
      [...container.querySelectorAll(".live-nav button")].map((button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual(["业务总览", "恢复工作台", "协作视图", "运行事件"]);
    const select =
      container.querySelector<HTMLSelectElement>(".live-app select")!;
    await act(() => {
      select.value = "relay";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("午夜紫");
    await click("菜单到顶部");
    expect(
      container.querySelector(".live-app")?.getAttribute("data-theme"),
    ).toBe("midnight");
    expect(
      container.querySelector(".live-body")?.firstElementChild?.tagName,
    ).toBe("NAV");
    await click("表单变决策卡");
    expect(
      container.querySelector(".studio")?.getAttribute("data-mobile-tab"),
    ).toBe("preview");
    await click("表单变决策卡");
    // Replies without a change stay visible in chat on a phone.
    expect(
      container.querySelector(".studio")?.getAttribute("data-mobile-tab"),
    ).toBe("chat");
    await click("打开双视图");
    expect(
      container.querySelectorAll('.live-app input[type="radio"]'),
    ).toHaveLength(6);
    expect(
      [
        ...container.querySelectorAll<HTMLInputElement>(
          '.live-app input[type="radio"]:checked',
        ),
      ].map((input) => input.value),
    ).toEqual(["relay", "relay"]);
    await act(() =>
      container
        .querySelector<HTMLInputElement>('.is-mirror input[value="air"]')!
        .click(),
    );
    expect(
      [
        ...container.querySelectorAll<HTMLInputElement>(
          '.live-app input[type="radio"]:checked',
        ),
      ].map((input) => input.value),
    ).toEqual(["air", "air"]);
    await click("撤销上一条");
    expect(
      container.querySelectorAll('.live-app input[type="radio"]'),
    ).toHaveLength(3);
    expect(
      container.querySelector<HTMLInputElement>(".live-app input:checked")
        ?.value,
    ).toBe("air");
    await click("恢复页面布局");
    expect(
      container.querySelector(".live-app")?.getAttribute("data-theme"),
    ).toBe("light");
    expect(
      container.querySelector(".live-app")?.firstElementChild?.tagName,
    ).toBe("NAV");
    expect(
      container.querySelector<HTMLInputElement>(
        '.live-app input[type="radio"]:checked',
      )?.value,
    ).toBe("air");
    await click("新会话");
    expect(
      container.querySelector(".studio")?.getAttribute("data-mobile-tab"),
    ).toBe("chat");
  } finally {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

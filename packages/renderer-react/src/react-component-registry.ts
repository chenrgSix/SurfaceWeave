import { DynamicUIError } from "@package-first/core";
import type { ComponentRegistry } from "@package-first/core";

import type { ReactRendererComponent } from "./types.js";

/** Maps Core-approved component names to local React implementations. */
export class ReactComponentRegistry {
  readonly #components = new Map<string, ReactRendererComponent>();
  readonly #trustedComponents: ComponentRegistry;

  constructor(trustedComponents: ComponentRegistry) {
    this.#trustedComponents = trustedComponents;
  }

  register(type: string, component: ReactRendererComponent): void {
    this.#trustedComponents.require(type);
    if (this.#components.has(type)) {
      throw new DynamicUIError(
        "INVALID_SURFACE",
        `React renderer for component "${type}" is already registered`,
      );
    }
    this.#components.set(type, component);
  }

  has(type: string): boolean {
    return this.#components.has(type);
  }

  require(type: string): ReactRendererComponent {
    this.#trustedComponents.require(type);
    const component = this.#components.get(type);
    if (component === undefined) {
      throw new DynamicUIError(
        "UNKNOWN_COMPONENT",
        `No React renderer is registered for trusted component "${type}"`,
      );
    }
    return component;
  }
}

import {
  ComponentPackResolver,
  DynamicUIError,
  cloneValue,
  parseComponentPackManifest,
} from "@surfaceweave/core";
import type {
  ComponentRegistry,
  ComponentResolutionRequest,
} from "@surfaceweave/core";

import type {
  ReactComponentPack,
  ReactComponentResolution,
  ReactRendererComponent,
} from "./types.js";

export interface ReactComponentPackValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validates manifest/binding completeness without exposing React to Core. */
export function validateReactComponentPack(
  pack: ReactComponentPack,
  trustedComponents?: ComponentRegistry,
): ReactComponentPackValidationResult {
  const errors: string[] = [];
  let manifest;
  try {
    manifest = parseComponentPackManifest(pack.manifest, {
      knownComponents: trustedComponents?.list() ?? [],
    });
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Invalid manifest"],
    };
  }
  if (manifest.rendererKind !== "react") {
    errors.push(
      `React component pack "${manifest.id}" declares rendererKind "${manifest.rendererKind}"`,
    );
  }
  const semanticTypes = new Set(
    manifest.components.map((component) => component.semanticType),
  );
  for (const semanticType of semanticTypes) {
    if (pack.bindings[semanticType] === undefined) {
      errors.push(`Missing React binding for "${semanticType}"`);
    }
  }
  for (const semanticType of Object.keys(pack.bindings)) {
    if (!semanticTypes.has(semanticType)) {
      errors.push(
        `React binding "${semanticType}" is absent from the manifest`,
      );
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Resolves semantic nodes against locally registered React component packs. */
export class ReactComponentRegistry {
  readonly #legacyComponents = new Map<string, ReactRendererComponent>();
  readonly #packs = new Map<string, ReactComponentPack>();
  readonly #trustedComponents: ComponentRegistry;
  readonly #resolver: ComponentPackResolver;

  constructor(trustedComponents: ComponentRegistry) {
    this.#trustedComponents = trustedComponents;
    this.#resolver = new ComponentPackResolver(trustedComponents);
  }

  /** @deprecated Register a Component Pack instead of an isolated React binding. */
  register(type: string, component: ReactRendererComponent): void {
    this.#trustedComponents.require(type);
    if (this.#legacyComponents.has(type)) {
      throw new DynamicUIError(
        "INVALID_SURFACE",
        `React renderer for component "${type}" is already registered`,
      );
    }
    this.#legacyComponents.set(type, component);
  }

  registerPack(pack: ReactComponentPack): void {
    const validation = validateReactComponentPack(
      pack,
      this.#trustedComponents,
    );
    if (!validation.valid) {
      throw new DynamicUIError(
        "INVALID_COMPONENT_PACK",
        `React component pack is invalid: ${validation.errors.join("; ")}`,
      );
    }
    if (this.#packs.has(pack.manifest.id)) {
      throw new DynamicUIError(
        "INVALID_COMPONENT_PACK",
        `React component pack "${pack.manifest.id}" is already registered`,
      );
    }
    this.#trustedComponents.registerPack(pack.manifest);
    this.#packs.set(pack.manifest.id, {
      ...pack,
      manifest: cloneValue(pack.manifest),
      bindings: { ...pack.bindings },
    });
  }

  has(type: string): boolean {
    if (this.#legacyComponents.has(type)) return true;
    try {
      this.resolve(type);
      return true;
    } catch {
      return false;
    }
  }

  require(type: string): ReactRendererComponent {
    return this.resolve(type).component;
  }

  resolve(
    type: string,
    options: Omit<
      ComponentResolutionRequest,
      "semanticType" | "rendererKind"
    > = {},
  ): ReactComponentResolution {
    this.#trustedComponents.require(type);
    const legacy = this.#legacyComponents.get(type);
    if (legacy !== undefined) {
      return {
        component: legacy,
        resolution: {
          requestedSemanticType: type,
          resolvedSemanticType: type,
          rendererKind: "react",
          packId: "legacy",
          packVersion: "0.0.0",
          fallbackChain: [type],
          diagnostics: [],
        },
      };
    }
    const resolution = this.#resolver.resolve({
      semanticType: type,
      rendererKind: "react",
      availablePackIds:
        options.availablePackIds ?? [...this.#packs.keys()].sort(),
      ...options,
    });
    const pack = this.#packs.get(resolution.packId);
    const component = pack?.bindings[resolution.resolvedSemanticType];
    if (pack === undefined || component === undefined) {
      throw new DynamicUIError(
        "COMPONENT_RESOLUTION_FAILED",
        `Resolved React pack "${resolution.packId}" has no binding for "${resolution.resolvedSemanticType}"`,
      );
    }
    return {
      component,
      ...(pack.Provider === undefined ? {} : { Provider: pack.Provider }),
      resolution,
    };
  }

  listPacks(): ReactComponentPack["manifest"][] {
    return [...this.#packs.values()]
      .map((pack) => cloneValue(pack.manifest))
      .sort((left, right) => left.id.localeCompare(right.id));
  }
}

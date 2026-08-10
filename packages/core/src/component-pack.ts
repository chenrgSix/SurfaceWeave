import { assertJsonValue, assertSafeDeclaration, cloneValue } from "./data.js";
import { DynamicUIError } from "./errors.js";
import {
  assertMatchesJsonSchema,
  assertValidJsonSchema,
} from "./json-schema.js";
import type {
  AgentGuidance,
  ComponentActionDefinition,
  ComponentDefinition,
  ComponentExtensionSchema,
  ComponentManifest,
  ComponentPackDiagnostic,
  ComponentPackManifest,
  ComponentRegistry,
  ComponentResolution,
  ComponentResolutionRequest,
  JsonSchema,
  JsonValue,
} from "./types.js";
import { semanticLayoutFeatures } from "./layout.js";

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const semanticTypePattern = /^[A-Za-z][A-Za-z0-9._-]*$/;
const semverPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const extensionNamespacePattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;

export interface ComponentPackValidationOptions {
  knownComponents?: ComponentDefinition[];
}

export interface ComponentPackValidationResult {
  valid: boolean;
  errors: string[];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new DynamicUIError(
      "INVALID_COMPONENT_PACK",
      `${label} must be a plain object`,
    );
  }
  return value as Record<string, unknown>;
}

function allowedKeys(
  object: Record<string, unknown>,
  keys: string[],
  label: string,
): void {
  const allowed = new Set(keys);
  const extra = Object.keys(object).find((key) => !allowed.has(key));
  if (extra !== undefined) {
    throw new DynamicUIError(
      "INVALID_COMPONENT_PACK",
      `${label}.${extra} is not supported`,
    );
  }
}

function requiredString(
  value: unknown,
  label: string,
  pattern?: RegExp,
): string {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    (pattern !== undefined && !pattern.test(value))
  ) {
    throw new DynamicUIError(
      "INVALID_COMPONENT_PACK",
      `${label} is not a valid identifier`,
    );
  }
  return value;
}

function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new DynamicUIError(
      "INVALID_COMPONENT_PACK",
      `${label} must be an array`,
    );
  }
  const items = value.map((item, index) =>
    requiredString(item, `${label}[${index}]`, identifierPattern),
  );
  if (new Set(items).size !== items.length) {
    throw new DynamicUIError(
      "INVALID_COMPONENT_PACK",
      `${label} must contain unique values`,
    );
  }
  return items;
}

function jsonSchema(value: unknown, label: string): JsonSchema {
  if (typeof value !== "boolean") {
    assertJsonValue(value, label);
    record(value, label);
  }
  const schema = cloneValue(value) as JsonSchema;
  assertValidJsonSchema(schema, label);
  return schema;
}

function actionDefinition(
  value: unknown,
  label: string,
): string | ComponentActionDefinition {
  if (typeof value === "string") {
    return requiredString(value, label, identifierPattern);
  }
  const object = record(value, label);
  allowedKeys(
    object,
    ["name", "sideEffect", "requiresConfirmation", "inputSchema"],
    label,
  );
  const result: ComponentActionDefinition = {
    name: requiredString(object.name, `${label}.name`, identifierPattern),
  };
  for (const key of ["sideEffect", "requiresConfirmation"] as const) {
    if (object[key] !== undefined) {
      if (typeof object[key] !== "boolean") {
        throw new DynamicUIError(
          "INVALID_COMPONENT_PACK",
          `${label}.${key} must be boolean`,
        );
      }
      result[key] = object[key];
    }
  }
  if (object.inputSchema !== undefined) {
    result.inputSchema = jsonSchema(object.inputSchema, `${label}.inputSchema`);
  }
  return result;
}

function guidance(value: unknown, label: string): AgentGuidance {
  const object = record(value, label);
  allowedKeys(object, ["summary", "usage", "avoid"], label);
  const result: AgentGuidance = {
    summary: requiredString(object.summary, `${label}.summary`),
  };
  for (const key of ["usage", "avoid"] as const) {
    if (object[key] !== undefined) {
      if (!Array.isArray(object[key])) {
        throw new DynamicUIError(
          "INVALID_COMPONENT_PACK",
          `${label}.${key} must be an array`,
        );
      }
      result[key] = object[key].map((item, index) =>
        requiredString(item, `${label}.${key}[${index}]`),
      );
    }
  }
  return result;
}

function extensionSchemas(
  value: unknown,
  label: string,
): Record<string, ComponentExtensionSchema> {
  const object = record(value, label);
  return Object.fromEntries(
    Object.entries(object).map(([namespace, extension]) => {
      requiredString(
        namespace,
        `${label} namespace`,
        extensionNamespacePattern,
      );
      const extensionObject = record(extension, `${label}.${namespace}`);
      allowedKeys(
        extensionObject,
        ["version", "schema"],
        `${label}.${namespace}`,
      );
      return [
        namespace,
        {
          version: requiredString(
            extensionObject.version,
            `${label}.${namespace}.version`,
            semverPattern,
          ),
          schema: jsonSchema(
            extensionObject.schema,
            `${label}.${namespace}.schema`,
          ),
        },
      ];
    }),
  );
}

function componentManifest(value: unknown, label: string): ComponentManifest {
  const object = record(value, label);
  allowedKeys(
    object,
    [
      "semanticType",
      "description",
      "propsSchema",
      "actionSchema",
      "binding",
      "actions",
      "capabilities",
      "layoutCapabilities",
      "fallback",
      "extensions",
    ],
    label,
  );
  const component: ComponentManifest = {
    semanticType: requiredString(
      object.semanticType,
      `${label}.semanticType`,
      semanticTypePattern,
    ),
    propsSchema: jsonSchema(object.propsSchema, `${label}.propsSchema`),
  };
  if (object.description !== undefined) {
    component.description = requiredString(
      object.description,
      `${label}.description`,
    );
  }
  if (object.actionSchema !== undefined) {
    component.actionSchema = jsonSchema(
      object.actionSchema,
      `${label}.actionSchema`,
    );
  }
  if (object.binding !== undefined) {
    const binding = record(object.binding, `${label}.binding`);
    allowedKeys(binding, ["valueTypes", "semantics"], `${label}.binding`);
    if (!Array.isArray(binding.valueTypes) || binding.valueTypes.length === 0) {
      throw new DynamicUIError(
        "INVALID_COMPONENT_PACK",
        `${label}.binding.valueTypes must be a non-empty array`,
      );
    }
    const acceptedTypes = [
      "string",
      "number",
      "boolean",
      "object",
      "array",
      "unknown",
    ];
    const valueTypes = binding.valueTypes.map((item, index) => {
      if (typeof item !== "string" || !acceptedTypes.includes(item)) {
        throw new DynamicUIError(
          "INVALID_COMPONENT_PACK",
          `${label}.binding.valueTypes[${index}] is invalid`,
        );
      }
      return item as NonNullable<
        ComponentManifest["binding"]
      >["valueTypes"][number];
    });
    component.binding = { valueTypes };
    if (binding.semantics !== undefined) {
      component.binding.semantics = stringList(
        binding.semantics,
        `${label}.binding.semantics`,
      );
    }
  }
  if (object.actions !== undefined) {
    if (!Array.isArray(object.actions)) {
      throw new DynamicUIError(
        "INVALID_COMPONENT_PACK",
        `${label}.actions must be an array`,
      );
    }
    component.actions = object.actions.map((action, index) =>
      actionDefinition(action, `${label}.actions[${index}]`),
    );
    const actionNames = component.actions.map((action) =>
      typeof action === "string" ? action : action.name,
    );
    if (new Set(actionNames).size !== actionNames.length) {
      throw new DynamicUIError(
        "INVALID_COMPONENT_PACK",
        `${label}.actions must have unique names`,
      );
    }
  }
  if (object.capabilities !== undefined) {
    component.capabilities = stringList(
      object.capabilities,
      `${label}.capabilities`,
    );
  }
  if (object.layoutCapabilities !== undefined) {
    const capabilities = stringList(
      object.layoutCapabilities,
      `${label}.layoutCapabilities`,
    );
    const unsupported = capabilities.find(
      (capability) =>
        !(semanticLayoutFeatures as readonly string[]).includes(capability),
    );
    if (unsupported !== undefined) {
      throw new DynamicUIError(
        "INVALID_COMPONENT_PACK",
        `${label}.layoutCapabilities contains unsupported feature "${unsupported}"`,
      );
    }
    component.layoutCapabilities = capabilities as NonNullable<
      ComponentManifest["layoutCapabilities"]
    >;
  }
  if (object.fallback !== undefined) {
    component.fallback = requiredString(
      object.fallback,
      `${label}.fallback`,
      semanticTypePattern,
    );
  }
  if (object.extensions !== undefined) {
    component.extensions = extensionSchemas(
      object.extensions,
      `${label}.extensions`,
    );
  }
  return component;
}

function definitionFromManifest(
  component: ComponentManifest,
): ComponentDefinition {
  const definition: ComponentDefinition = {
    type: component.semanticType,
    propsSchema: cloneValue(component.propsSchema),
  };
  for (const key of [
    "description",
    "actionSchema",
    "binding",
    "actions",
    "capabilities",
    "layoutCapabilities",
    "fallback",
    "extensions",
  ] as const) {
    if (component[key] !== undefined) {
      Object.assign(definition, { [key]: cloneValue(component[key]) });
    }
  }
  return definition;
}

export function componentManifestToDefinition(
  component: ComponentManifest,
): ComponentDefinition {
  return definitionFromManifest(component);
}

function assertFallbacks(
  components: ComponentManifest[],
  knownComponents: ComponentDefinition[],
): void {
  const definitions = new Map<string, ComponentDefinition>();
  for (const definition of knownComponents) {
    definitions.set(definition.type, definition);
  }
  for (const component of components) {
    definitions.set(component.semanticType, definitionFromManifest(component));
  }
  for (const component of components) {
    if (
      component.fallback !== undefined &&
      !definitions.has(component.fallback)
    ) {
      throw new DynamicUIError(
        "INVALID_COMPONENT_PACK",
        `Fallback "${component.fallback}" for "${component.semanticType}" is not declared`,
      );
    }
    const seen = new Set<string>();
    let current: string | undefined = component.semanticType;
    while (current !== undefined) {
      if (seen.has(current)) {
        throw new DynamicUIError(
          "FALLBACK_CYCLE",
          `Fallback cycle detected at "${current}"`,
        );
      }
      seen.add(current);
      current = definitions.get(current)?.fallback;
    }
  }
}

/** Parses and validates a data-only Component Pack Manifest. */
export function parseComponentPackManifest(
  value: unknown,
  options: ComponentPackValidationOptions = {},
): ComponentPackManifest {
  assertSafeDeclaration(value, "componentPack");
  const object = record(value, "componentPack");
  allowedKeys(
    object,
    [
      "protocolVersion",
      "id",
      "version",
      "rendererKind",
      "priority",
      "capabilities",
      "components",
      "agentGuidance",
    ],
    "componentPack",
  );
  if (object.protocolVersion !== "1.0") {
    throw new DynamicUIError(
      "INVALID_COMPONENT_PACK",
      "componentPack.protocolVersion must be 1.0",
    );
  }
  if (!Array.isArray(object.components) || object.components.length === 0) {
    throw new DynamicUIError(
      "INVALID_COMPONENT_PACK",
      "componentPack.components must be a non-empty array",
    );
  }
  const manifest: ComponentPackManifest = {
    protocolVersion: "1.0",
    id: requiredString(object.id, "componentPack.id", identifierPattern),
    version: requiredString(
      object.version,
      "componentPack.version",
      semverPattern,
    ),
    rendererKind: requiredString(
      object.rendererKind,
      "componentPack.rendererKind",
      identifierPattern,
    ),
    components: object.components.map((component, index) =>
      componentManifest(component, `componentPack.components[${index}]`),
    ),
  };
  if (
    new Set(manifest.components.map((item) => item.semanticType)).size !==
    manifest.components.length
  ) {
    throw new DynamicUIError(
      "INVALID_COMPONENT_PACK",
      "componentPack semanticType values must be unique",
    );
  }
  if (object.priority !== undefined) {
    if (!Number.isInteger(object.priority)) {
      throw new DynamicUIError(
        "INVALID_COMPONENT_PACK",
        "componentPack.priority must be an integer",
      );
    }
    manifest.priority = object.priority as number;
  }
  if (object.capabilities !== undefined) {
    manifest.capabilities = stringList(
      object.capabilities,
      "componentPack.capabilities",
    );
  }
  if (object.agentGuidance !== undefined) {
    manifest.agentGuidance = guidance(
      object.agentGuidance,
      "componentPack.agentGuidance",
    );
  }
  assertFallbacks(manifest.components, options.knownComponents ?? []);
  return cloneValue(manifest);
}

/** Non-throwing conformance entry point suitable for package author tooling. */
export function validateComponentPack(
  value: unknown,
  options: ComponentPackValidationOptions = {},
): ComponentPackValidationResult {
  try {
    parseComponentPackManifest(value, options);
    return { valid: true, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [
        error instanceof Error ? error.message : "Invalid component pack",
      ],
    };
  }
}

export function assertComponentExtension(
  definition: ComponentDefinition,
  namespace: string,
  version: string,
  value: JsonValue,
): void {
  const extension = definition.extensions?.[namespace];
  if (extension === undefined) {
    throw new DynamicUIError(
      "INVALID_EXTENSION",
      `Extension "${namespace}" is not registered for "${definition.type}"`,
    );
  }
  if (extension.version !== version) {
    throw new DynamicUIError(
      "INVALID_EXTENSION",
      `Extension "${namespace}" requires version ${extension.version}, received ${version}`,
    );
  }
  assertSafeDeclaration(value, `extensions.${namespace}.value`);
  assertMatchesJsonSchema(
    extension.schema,
    value,
    `extensions.${namespace}.value`,
    "INVALID_EXTENSION",
  );
}

function supportsCapabilities(
  required: string[] | undefined,
  available: Set<string>,
): boolean {
  return (required ?? []).every((capability) => available.has(capability));
}

/** Framework-neutral deterministic resolver over registered pack manifests. */
export class ComponentPackResolver {
  readonly #registry: ComponentRegistry;

  constructor(registry: ComponentRegistry) {
    this.#registry = registry;
  }

  resolve(request: ComponentResolutionRequest): ComponentResolution {
    const diagnostics: ComponentPackDiagnostic[] = [];
    const available = new Set(request.capabilities ?? []);
    const fallbackChain: string[] = [];
    const seen = new Set<string>();
    let semanticType = request.semanticType;

    while (true) {
      if (seen.has(semanticType)) {
        throw new DynamicUIError(
          "FALLBACK_CYCLE",
          `Fallback cycle detected while resolving "${request.semanticType}"`,
          { fallbackChain },
        );
      }
      seen.add(semanticType);
      fallbackChain.push(semanticType);
      const definition = this.#registry.require(semanticType);
      const rendererPacks = this.#registry
        .listPacks()
        .filter(
          (pack) =>
            pack.rendererKind === request.rendererKind &&
            (request.availablePackIds === undefined ||
              request.availablePackIds.includes(pack.id)),
        );
      const exactPacks = rendererPacks.filter((pack) =>
        pack.components.some(
          (component) => component.semanticType === semanticType,
        ),
      );
      const compatible = exactPacks.filter((pack) => {
        const component = pack.components.find(
          (item) => item.semanticType === semanticType,
        );
        const supportedVersions = request.supportedPackVersions?.[pack.id];
        const versionAccepted =
          supportedVersions === undefined ||
          supportedVersions.includes(pack.version);
        const packAccepted = supportsCapabilities(pack.capabilities, available);
        const componentAccepted = supportsCapabilities(
          component?.capabilities,
          available,
        );
        if (!versionAccepted) {
          diagnostics.push({
            code: "PACK_VERSION_INCOMPATIBLE",
            message: `Pack "${pack.id}" version "${pack.version}" is not accepted by this host`,
            packId: pack.id,
            semanticType,
          });
        } else if (!packAccepted) {
          diagnostics.push({
            code: "PACK_CAPABILITY_MISMATCH",
            message: `Pack "${pack.id}" requires unavailable capabilities`,
            packId: pack.id,
            semanticType,
          });
        } else if (!componentAccepted) {
          diagnostics.push({
            code: "COMPONENT_CAPABILITY_MISMATCH",
            message: `Component "${semanticType}" in pack "${pack.id}" requires unavailable capabilities`,
            packId: pack.id,
            semanticType,
          });
        }
        return versionAccepted && packAccepted && componentAccepted;
      });
      const preferred =
        request.preferredPack === undefined
          ? undefined
          : compatible.find((pack) => pack.id === request.preferredPack);
      if (request.preferredPack !== undefined && preferred === undefined) {
        diagnostics.push({
          code: "PREFERRED_PACK_UNAVAILABLE",
          message: `Preferred pack "${request.preferredPack}" cannot render "${semanticType}"`,
          packId: request.preferredPack,
          semanticType,
        });
      }
      const selected =
        preferred ??
        [...compatible].sort((left, right) => {
          const leftPriority =
            request.packPriorities?.[left.id] ?? left.priority ?? 0;
          const rightPriority =
            request.packPriorities?.[right.id] ?? right.priority ?? 0;
          return (
            rightPriority - leftPriority ||
            left.id.localeCompare(right.id) ||
            left.version.localeCompare(right.version)
          );
        })[0];
      if (selected !== undefined) {
        return {
          requestedSemanticType: request.semanticType,
          resolvedSemanticType: semanticType,
          rendererKind: request.rendererKind,
          packId: selected.id,
          packVersion: selected.version,
          fallbackChain,
          diagnostics,
        };
      }
      if (definition.fallback === undefined) {
        throw new DynamicUIError(
          "COMPONENT_RESOLUTION_FAILED",
          `No compatible ${request.rendererKind} pack can render "${semanticType}"`,
          { diagnostics, fallbackChain },
        );
      }
      diagnostics.push({
        code: "FALLBACK_APPLIED",
        message: `Component "${semanticType}" fell back to "${definition.fallback}"`,
        semanticType,
      });
      semanticType = definition.fallback;
    }
  }
}

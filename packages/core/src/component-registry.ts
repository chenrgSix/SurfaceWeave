import { assertSafeDeclaration, cloneValue } from "./data.js";
import { DynamicUIError } from "./errors.js";
import {
  componentManifestToDefinition,
  parseComponentPackManifest,
} from "./component-pack.js";
import {
  assertValidJsonSchema,
  compileJsonSchemaValidator,
} from "./json-schema.js";
import type { CompiledJsonSchemaValidator } from "./json-schema.js";
import type {
  ComponentActionDefinition,
  ComponentDefinition,
  ComponentPackManifest,
  ComponentRegistry,
  DataBinding,
  UINode,
} from "./types.js";

interface RegisteredComponent {
  definition: ComponentDefinition;
  propsValidator?: CompiledJsonSchemaValidator;
  extensionValidators: Map<string, CompiledJsonSchemaValidator>;
}

function actionName(action: string | ComponentActionDefinition): string {
  return typeof action === "string" ? action : action.name;
}

function assertIdentifier(value: string, label: string): void {
  if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(value)) {
    throw new DynamicUIError(
      "INVALID_SURFACE",
      `${label} must be a stable identifier, received "${value}"`,
    );
  }
}

function bindingIsAccepted(
  definition: ComponentDefinition,
  binding: DataBinding,
): boolean {
  if (definition.binding === undefined) {
    return false;
  }
  const typeAccepted =
    definition.binding.valueTypes.includes("unknown") ||
    definition.binding.valueTypes.includes(binding.valueType);
  const semantics = definition.binding.semantics;
  const semanticAccepted =
    semantics === undefined ||
    binding.semantic === undefined ||
    semantics.includes(binding.semantic);
  return typeAccepted && semanticAccepted;
}

/** In-memory allow-list used at every component and action trust boundary. */
export class InMemoryComponentRegistry implements ComponentRegistry {
  readonly #definitions = new Map<string, RegisteredComponent>();
  readonly #packs = new Map<string, ComponentPackManifest>();

  register(definition: ComponentDefinition): void {
    assertSafeDeclaration(definition, "componentDefinition");
    assertIdentifier(definition.type, "Component type");
    if (this.#definitions.has(definition.type)) {
      throw new DynamicUIError(
        "INVALID_SURFACE",
        `Component "${definition.type}" is already registered`,
      );
    }
    const names = new Set<string>();
    for (const action of definition.actions ?? []) {
      const name = actionName(action);
      assertIdentifier(name, "Action name");
      if (names.has(name)) {
        throw new DynamicUIError(
          "INVALID_SURFACE",
          `Component "${definition.type}" contains duplicate action "${name}"`,
        );
      }
      names.add(name);
      if (typeof action === "object" && action.inputSchema !== undefined) {
        assertValidJsonSchema(
          action.inputSchema,
          `Action schema for ${definition.type}.${name}`,
        );
      }
    }
    const propsValidator =
      definition.propsSchema === undefined
        ? undefined
        : compileJsonSchemaValidator(
            definition.propsSchema,
            `Props schema for ${definition.type}`,
          );
    if (definition.actionSchema !== undefined) {
      assertValidJsonSchema(
        definition.actionSchema,
        `Action schema for ${definition.type}`,
      );
    }
    if (
      definition.fallback !== undefined &&
      !this.#definitions.has(definition.fallback)
    ) {
      throw new DynamicUIError(
        "INVALID_COMPONENT_PACK",
        `Fallback "${definition.fallback}" for "${definition.type}" is not registered`,
      );
    }
    const extensionValidators = new Map<string, CompiledJsonSchemaValidator>();
    for (const [namespace, extension] of Object.entries(
      definition.extensions ?? {},
    )) {
      extensionValidators.set(
        namespace,
        compileJsonSchemaValidator(
          extension.schema,
          `Extension schema for ${definition.type}.${namespace}`,
        ),
      );
    }
    this.#definitions.set(definition.type, {
      definition: cloneValue(definition),
      ...(propsValidator === undefined ? {} : { propsValidator }),
      extensionValidators,
    });
  }

  registerPack(input: ComponentPackManifest): void {
    const manifest = parseComponentPackManifest(input, {
      knownComponents: this.list(),
    });
    const existingPack = this.#packs.get(manifest.id);
    if (existingPack !== undefined) {
      if (canonicalValue(existingPack) === canonicalValue(manifest)) {
        return;
      }
      throw new DynamicUIError(
        "INVALID_COMPONENT_PACK",
        `Component pack "${manifest.id}" conflicts with an existing version`,
      );
    }
    for (const component of manifest.components) {
      const definition = componentManifestToDefinition(component);
      const existing = this.#definitions.get(definition.type)?.definition;
      if (existing === undefined) {
        this.register(definition);
        continue;
      }
      if (semanticSignature(existing) !== semanticSignature(definition)) {
        throw new DynamicUIError(
          "INVALID_COMPONENT_PACK",
          `Component pack "${manifest.id}" conflicts with semantic definition "${definition.type}"`,
        );
      }
    }
    this.#packs.set(manifest.id, cloneValue(manifest));
  }

  has(type: string): boolean {
    return this.#definitions.has(type);
  }

  get(type: string): ComponentDefinition | undefined {
    const registered = this.#definitions.get(type);
    return registered === undefined
      ? undefined
      : cloneValue(registered.definition);
  }

  require(type: string): ComponentDefinition {
    const definition = this.get(type);
    if (definition === undefined) {
      throw new DynamicUIError(
        "UNKNOWN_COMPONENT",
        `Component "${type}" is not registered`,
        { component: type },
      );
    }
    return definition;
  }

  list(): ComponentDefinition[] {
    return [...this.#definitions.values()]
      .map((registered) => registered.definition)
      .sort((left, right) => left.type.localeCompare(right.type))
      .map((definition) => cloneValue(definition));
  }

  listPacks(): ComponentPackManifest[] {
    return [...this.#packs.values()]
      .sort(
        (left, right) =>
          left.id.localeCompare(right.id) ||
          left.version.localeCompare(right.version),
      )
      .map((manifest) => cloneValue(manifest));
  }

  assertNode(node: UINode): void {
    const registered = this.#definitions.get(node.component);
    if (registered === undefined) {
      throw new DynamicUIError(
        "UNKNOWN_COMPONENT",
        `Component "${node.component}" is not registered`,
        { component: node.component },
      );
    }
    const { definition, propsValidator, extensionValidators } = registered;
    if (propsValidator !== undefined) {
      propsValidator.assert(
        node.props,
        `Props for component "${node.component}"`,
      );
    }
    for (const [namespace, extension] of Object.entries(
      node.extensions ?? {},
    )) {
      const schema = definition.extensions?.[namespace];
      if (schema === undefined) {
        throw new DynamicUIError(
          "INVALID_EXTENSION",
          `Extension "${namespace}" is not registered for "${definition.type}"`,
        );
      }
      if (schema.version !== extension.version) {
        throw new DynamicUIError(
          "INVALID_EXTENSION",
          `Extension "${namespace}" requires version ${schema.version}, received ${extension.version}`,
        );
      }
      assertSafeDeclaration(extension.value, `extensions.${namespace}.value`);
      extensionValidators
        .get(namespace)
        ?.assert(
          extension.value,
          `extensions.${namespace}.value`,
          "INVALID_EXTENSION",
        );
    }
    if (
      node.binding !== undefined &&
      !bindingIsAccepted(definition, node.binding)
    ) {
      throw new DynamicUIError(
        "INVALID_SURFACE",
        `Component "${node.component}" does not accept binding "${node.binding.path}"`,
        { component: node.component, binding: node.binding },
      );
    }
  }

  assertAction(component: string, action: string): void {
    const definition = this.require(component);
    if (
      !(definition.actions ?? []).some((item) => actionName(item) === action)
    ) {
      throw new DynamicUIError(
        "UNKNOWN_ACTION",
        `Action "${action}" is not registered for component "${component}"`,
        { component, action },
      );
    }
  }
}

function canonicalValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalValue).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalValue(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function semanticSignature(definition: ComponentDefinition): string {
  return canonicalValue({
    type: definition.type,
    propsSchema: definition.propsSchema ?? true,
    actionSchema: definition.actionSchema,
    binding: definition.binding,
    actions: definition.actions,
    fallback: definition.fallback,
    extensions: definition.extensions,
  });
}

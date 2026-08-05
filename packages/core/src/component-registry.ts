import { cloneValue } from "./data.js";
import { DynamicUIError } from "./errors.js";
import type {
  ComponentActionDefinition,
  ComponentDefinition,
  ComponentRegistry,
  DataBinding,
  UINode,
} from "./types.js";

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
  readonly #definitions = new Map<string, ComponentDefinition>();

  register(definition: ComponentDefinition): void {
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
    }
    this.#definitions.set(definition.type, cloneValue(definition));
  }

  has(type: string): boolean {
    return this.#definitions.has(type);
  }

  get(type: string): ComponentDefinition | undefined {
    const definition = this.#definitions.get(type);
    return definition === undefined ? undefined : cloneValue(definition);
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
      .sort((left, right) => left.type.localeCompare(right.type))
      .map((definition) => cloneValue(definition));
  }

  assertNode(node: UINode): void {
    const definition = this.require(node.component);
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

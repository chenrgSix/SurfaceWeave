import { assertJsonValue, cloneValue } from "./data.js";
import { DynamicUIError } from "./errors.js";
import { assertValidJsonSchema } from "./json-schema.js";
import type { ToolDefinition, ToolRegistry } from "./types.js";

function assertIdentifier(value: string, label: string): void {
  if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(value)) {
    throw new DynamicUIError(
      "INVALID_TOOL_DEFINITION",
      `${label} must be a stable identifier`,
    );
  }
}

/** Validates and clones a Tool Definition at the SDK trust boundary. */
export function parseToolDefinition(input: ToolDefinition): ToolDefinition {
  assertJsonValue(input, "toolDefinition");
  assertIdentifier(input.id, "Tool id");
  if (input.version.trim() === "") {
    throw new DynamicUIError(
      "INVALID_TOOL_DEFINITION",
      "Tool version cannot be empty",
    );
  }
  assertValidJsonSchema(input.inputSchema, `Input schema for ${input.id}`);
  if (input.outputSchema !== undefined) {
    assertValidJsonSchema(input.outputSchema, `Output schema for ${input.id}`);
  }
  const annotations = input.annotations;
  if (
    annotations?.sideEffect === true &&
    annotations.confirmation === "never"
  ) {
    throw new DynamicUIError(
      "INVALID_TOOL_DEFINITION",
      `Side-effecting tool "${input.id}" cannot disable confirmation`,
    );
  }
  const paths = annotations?.sensitiveInputPaths ?? [];
  if (
    paths.some((path) => path.trim() === "") ||
    new Set(paths).size !== paths.length
  ) {
    throw new DynamicUIError(
      "INVALID_TOOL_DEFINITION",
      `Tool "${input.id}" has invalid sensitiveInputPaths`,
    );
  }
  return cloneValue(input);
}

/** Deterministic allow-list of developer-registered business tools. */
export class InMemoryToolRegistry implements ToolRegistry {
  readonly #definitions = new Map<string, ToolDefinition>();

  register(input: ToolDefinition): void {
    const definition = parseToolDefinition(input);
    if (this.#definitions.has(definition.id)) {
      throw new DynamicUIError(
        "TOOL_EXISTS",
        `Tool "${definition.id}" is already registered`,
      );
    }
    this.#definitions.set(definition.id, definition);
  }

  unregister(toolId: string): boolean {
    return this.#definitions.delete(toolId);
  }

  get(toolId: string): ToolDefinition | undefined {
    const definition = this.#definitions.get(toolId);
    return definition === undefined ? undefined : cloneValue(definition);
  }

  require(toolId: string, version?: string): ToolDefinition {
    const definition = this.get(toolId);
    if (definition === undefined) {
      throw new DynamicUIError(
        "TOOL_NOT_FOUND",
        `Tool "${toolId}" is not registered`,
      );
    }
    if (version !== undefined && definition.version !== version) {
      throw new DynamicUIError(
        "TOOL_VERSION_CONFLICT",
        `Tool "${toolId}" is at version ${definition.version}, not ${version}`,
        { expected: version, actual: definition.version },
      );
    }
    return definition;
  }

  list(): ToolDefinition[] {
    return [...this.#definitions.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((definition) => cloneValue(definition));
  }
}

import { cloneValue } from "@package-first/core";
import type { ComponentRegistry, JsonObject } from "@package-first/core";

import { generateSurface } from "./generator.js";
import { normalizeToolSchema } from "./tool-schema.js";
import type {
  DeveloperSoftHints,
  FieldMetadata,
  GenerateToolSurfaceInput,
  GeneratedSurface,
} from "./types.js";

function fieldMetadata(value: JsonObject): FieldMetadata {
  const result: FieldMetadata = {};
  if (typeof value.label === "string") result.label = value.label;
  if (typeof value.description === "string")
    result.description = value.description;
  if (typeof value.component === "string") result.component = value.component;
  if (typeof value.order === "number") result.order = value.order;
  if (typeof value.hidden === "boolean") result.hidden = value.hidden;
  if (typeof value.collapsed === "boolean") result.collapsed = value.collapsed;
  if (
    typeof value.props === "object" &&
    value.props !== null &&
    !Array.isArray(value.props)
  ) {
    result.props = cloneValue(value.props);
  }
  return result;
}

function softHints(
  input: GenerateToolSurfaceInput,
): DeveloperSoftHints | undefined {
  const hints = input.definition.uiHints?.softHints;
  const semantic = input.definition.uiHints?.semanticHints;
  if (hints === undefined && semantic === undefined) return undefined;
  const fields: Record<string, FieldMetadata> = {};
  for (const [path, value] of Object.entries(hints?.fields ?? {})) {
    fields[path] = fieldMetadata(value);
  }
  for (const [path, value] of Object.entries(semantic ?? {})) {
    fields[path] = {
      ...fields[path],
      ...(value.component === undefined ? {} : { component: value.component }),
      ...(value.purpose === undefined ? {} : { description: value.purpose }),
      props: {
        ...(fields[path]?.props ?? {}),
        ...(value.group === undefined ? {} : { group: value.group }),
        ...(value.importance === undefined
          ? {}
          : { importance: value.importance }),
      },
    };
  }
  return {
    ...(hints?.title === undefined ? {} : { title: hints.title }),
    ...(hints?.description === undefined
      ? {}
      : { description: hints.description }),
    ...(hints?.rootComponent === undefined
      ? {}
      : { rootComponent: hints.rootComponent }),
    ...(Object.keys(fields).length === 0 ? {} : { fields }),
  };
}

/** Generates a deterministic editable Surface from a registered Tool Definition. */
export function generateToolSurface(
  input: GenerateToolSurfaceInput,
  registry: ComponentRegistry,
): GeneratedSurface {
  const schema = normalizeToolSchema(input.definition.inputSchema);
  const hardConstraints = input.definition.uiHints?.hardConstraints;
  const generatedSoftHints = softHints(input);
  const developer =
    hardConstraints === undefined && generatedSoftHints === undefined
      ? undefined
      : {
          ...(hardConstraints === undefined ? {} : { hardConstraints }),
          ...(generatedSoftHints === undefined
            ? {}
            : { softHints: generatedSoftHints }),
        };
  return generateSurface(
    {
      surfaceId: input.surfaceId,
      schema,
      data: cloneValue(input.initialValues ?? {}) as JsonObject,
      intent: "form",
      ...(developer === undefined ? {} : { developer }),
      schemaRef: {
        id: input.definition.id,
        version: input.definition.version,
      },
      context: {
        ...(input.context ?? {}),
        source: "tool.input",
        toolId: input.definition.id,
        toolVersion: input.definition.version,
      },
      ...(input.presentation === undefined
        ? {}
        : { presentation: input.presentation }),
    },
    registry,
  );
}

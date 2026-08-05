import {
  DynamicUIError,
  cloneValue,
  readDataPath,
  validateSurface,
  writeDataPath,
} from "@package-first/core";
import type {
  BindingValueType,
  ComponentRegistry,
  JsonValue,
  Surface,
  UINode,
} from "@package-first/core";

import type {
  FieldMetadata,
  GenerateSurfaceInput,
  GeneratedSurface,
  GeneratorMetadata,
  SimpleJsonSchema,
} from "./types.js";

function stableNodeId(surfaceId: string, path: string): string {
  const normalized = path.replace(/[^A-Za-z0-9._-]/g, "-").replace(/\.+/g, "-");
  return `${surfaceId}--${normalized || "root"}`;
}

function labelFor(
  name: string,
  schema: SimpleJsonSchema,
  metadata?: FieldMetadata,
): string {
  if (metadata?.label !== undefined) {
    return metadata.label;
  }
  if (schema.title !== undefined) {
    return schema.title;
  }
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function bindingType(schema: SimpleJsonSchema): BindingValueType {
  if (schema.type === "integer") {
    return "number";
  }
  return schema.type;
}

function requireComponent(
  registry: ComponentRegistry,
  requested: string | undefined,
  defaults: string[],
): string {
  if (requested !== undefined) {
    registry.require(requested);
    return requested;
  }
  const available = defaults.find((component) => registry.has(component));
  if (available === undefined) {
    throw new DynamicUIError(
      "UNKNOWN_COMPONENT",
      `None of the required components are registered: ${defaults.join(", ")}`,
    );
  }
  return available;
}

function componentForField(
  schema: SimpleJsonSchema,
  metadata: FieldMetadata | undefined,
  registry: ComponentRegistry,
): string {
  if (metadata?.component !== undefined) {
    return requireComponent(registry, metadata.component, []);
  }
  if (schema.enum !== undefined) {
    return requireComponent(registry, undefined, ["Select"]);
  }
  switch (schema.type) {
    case "string":
      return requireComponent(registry, undefined, ["TextInput"]);
    case "number":
    case "integer":
      return requireComponent(registry, undefined, ["NumberInput"]);
    case "boolean":
      return requireComponent(registry, undefined, ["Checkbox"]);
    case "array":
      return requireComponent(registry, undefined, ["Select"]);
    case "object":
      return requireComponent(registry, undefined, ["Accordion", "Stack"]);
  }
}

function jsonValue(value: unknown, path: string): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => jsonValue(item, `${path}[${index}]`));
  }
  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        jsonValue(item, `${path}.${key}`),
      ]),
    );
  }
  throw new DynamicUIError(
    "INVALID_SURFACE",
    `${path} contains a value that cannot be represented as JSON`,
  );
}

function sortedProperties(
  schema: SimpleJsonSchema,
  parentPath: string,
  metadata: GeneratorMetadata | undefined,
): Array<[string, SimpleJsonSchema]> {
  return Object.entries(schema.properties ?? {}).sort(([left], [right]) => {
    const leftPath = parentPath === "" ? left : `${parentPath}.${left}`;
    const rightPath = parentPath === "" ? right : `${parentPath}.${right}`;
    const leftOrder = metadata?.fields?.[leftPath]?.order ?? 0;
    const rightOrder = metadata?.fields?.[rightPath]?.order ?? 0;
    return leftOrder - rightOrder || left.localeCompare(right);
  });
}

function createFieldNode(
  surfaceId: string,
  name: string,
  path: string,
  schema: SimpleJsonSchema,
  required: boolean,
  metadata: GeneratorMetadata | undefined,
  registry: ComponentRegistry,
): UINode | undefined {
  const field = metadata?.fields?.[path];
  if (field?.hidden === true) {
    return undefined;
  }
  const component = componentForField(schema, field, registry);
  const props: Record<string, JsonValue> = {
    label: labelFor(name, schema, field),
    ...cloneValue(field?.props ?? {}),
  };
  if (schema.description !== undefined || field?.description !== undefined) {
    props.description = field?.description ?? schema.description ?? "";
  }
  if (schema.enum !== undefined) {
    props.options = cloneValue(schema.enum);
  }
  if (field?.collapsed !== undefined) {
    props.collapsed = field.collapsed;
  }
  const node: UINode = {
    id: stableNodeId(surfaceId, path),
    stableId: path,
    component,
    props,
  };
  if (schema.type === "object") {
    node.children = sortedProperties(schema, path, metadata)
      .map(([childName, childSchema]) =>
        createFieldNode(
          surfaceId,
          childName,
          `${path}.${childName}`,
          childSchema,
          schema.required?.includes(childName) ?? false,
          metadata,
          registry,
        ),
      )
      .filter((child): child is UINode => child !== undefined);
  } else {
    node.binding = {
      path,
      valueType: bindingType(schema),
      required,
    };
  }
  return node;
}

function applySchemaDefaults(
  schema: SimpleJsonSchema,
  data: Record<string, unknown>,
  path = "",
): void {
  if (
    schema.default !== undefined &&
    path !== "" &&
    readDataPath(data, path) === undefined
  ) {
    writeDataPath(data, path, schema.default);
  }
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    applySchemaDefaults(property, data, path === "" ? name : `${path}.${name}`);
  }
}

function generateForm(
  input: GenerateSurfaceInput,
  registry: ComponentRegistry,
): UINode {
  if (input.schema.type !== "object") {
    throw new DynamicUIError(
      "INVALID_SURFACE",
      "The form intent requires an object schema",
    );
  }
  const rootComponent = requireComponent(
    registry,
    input.metadata?.rootComponent,
    ["Form"],
  );
  return {
    id: stableNodeId(input.surfaceId, "root"),
    stableId: `${input.surfaceId}.root`,
    component: rootComponent,
    props: {
      title: input.metadata?.title ?? input.schema.title ?? input.surfaceId,
      ...(input.metadata?.description === undefined
        ? {}
        : { description: input.metadata.description }),
    },
    children: sortedProperties(input.schema, "", input.metadata)
      .map(([name, schema]) =>
        createFieldNode(
          input.surfaceId,
          name,
          name,
          schema,
          input.schema.required?.includes(name) ?? false,
          input.metadata,
          registry,
        ),
      )
      .filter((child): child is UINode => child !== undefined),
  };
}

function firstArrayPath(schema: SimpleJsonSchema): string | undefined {
  return Object.entries(schema.properties ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .find(([, property]) => property.type === "array")?.[0];
}

function generateCollection(
  input: GenerateSurfaceInput,
  registry: ComponentRegistry,
): UINode {
  const itemsPath =
    input.metadata?.itemsPath ?? firstArrayPath(input.schema) ?? "items";
  const isSelection =
    input.intent === "single-select" || input.intent === "multi-select";
  const selectionPath = input.metadata?.selectionPath ?? "selection";
  const component = requireComponent(
    registry,
    input.metadata?.rootComponent,
    input.intent === "browse" ? ["CardList", "Table"] : ["CardList", "Select"],
  );
  const items = jsonValue(
    readDataPath(input.data, itemsPath) ?? [],
    `data.${itemsPath}`,
  );
  return {
    id: stableNodeId(input.surfaceId, "collection"),
    stableId: `${input.surfaceId}.collection`,
    component,
    props: {
      title: input.metadata?.title ?? input.schema.title ?? input.surfaceId,
      items,
      multiple: input.intent === "multi-select",
      ...(input.metadata?.itemComponent === undefined
        ? {}
        : { itemComponent: input.metadata.itemComponent }),
    },
    binding: {
      path: isSelection ? selectionPath : itemsPath,
      valueType:
        input.intent === "multi-select" || input.intent === "browse"
          ? "array"
          : "unknown",
      semantic: isSelection ? "selection" : "collection",
    },
  };
}

function generateConfirm(
  input: GenerateSurfaceInput,
  registry: ComponentRegistry,
): UINode {
  const component = requireComponent(registry, input.metadata?.rootComponent, [
    "Confirm",
  ]);
  return {
    id: stableNodeId(input.surfaceId, "confirm"),
    stableId: `${input.surfaceId}.confirm`,
    component,
    props: {
      title: input.metadata?.title ?? input.schema.title ?? "Confirm",
      message:
        input.metadata?.description ??
        input.schema.description ??
        "Please confirm this action.",
      summary: jsonValue(input.data, "data"),
    },
  };
}

/** Generates a stable Surface without consulting time, randomness, or external state. */
export function generateSurface(
  input: GenerateSurfaceInput,
  registry: ComponentRegistry,
): GeneratedSurface {
  if (input.surfaceId.trim() === "") {
    throw new DynamicUIError("INVALID_SURFACE", "surfaceId cannot be empty");
  }
  if (input.metadata?.itemComponent !== undefined) {
    registry.require(input.metadata.itemComponent);
  }
  const data = cloneValue(input.data);
  applySchemaDefaults(input.schema, data);
  const tree =
    input.intent === "form"
      ? generateForm({ ...input, data }, registry)
      : input.intent === "confirm"
        ? generateConfirm({ ...input, data }, registry)
        : generateCollection({ ...input, data }, registry);
  const surface: Surface = {
    id: input.surfaceId,
    revision: 0,
    intent: input.intent,
    tree,
    data,
    context: cloneValue(input.context ?? {}),
  };
  if (input.schemaRef !== undefined) {
    surface.schemaRef = cloneValue(input.schemaRef);
  }
  validateSurface(surface, registry);
  const generated = cloneValue(surface) as Partial<Surface>;
  delete generated.revision;
  return generated as GeneratedSurface;
}

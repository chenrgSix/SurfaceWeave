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
  DeveloperHardConstraints,
  FieldHardConstraint,
  JsonObject,
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

function componentIsAllowed(
  component: string,
  constraints: DeveloperHardConstraints | undefined,
): boolean {
  return (
    constraints?.allowedComponents === undefined ||
    constraints.allowedComponents.includes(component)
  );
}

function chooseComponent(
  registry: ComponentRegistry,
  hardComponent: string | undefined,
  softComponent: string | undefined,
  defaults: string[],
  constraints: DeveloperHardConstraints | undefined,
): string {
  if (hardComponent !== undefined) {
    registry.require(hardComponent);
    if (!componentIsAllowed(hardComponent, constraints)) {
      throw new DynamicUIError(
        "INVALID_SURFACE",
        `Hard component "${hardComponent}" is outside allowedComponents`,
      );
    }
    return hardComponent;
  }
  if (
    softComponent !== undefined &&
    registry.has(softComponent) &&
    componentIsAllowed(softComponent, constraints)
  ) {
    return softComponent;
  }
  const available = defaults.find(
    (component) =>
      registry.has(component) && componentIsAllowed(component, constraints),
  );
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
  hardConstraint: FieldHardConstraint | undefined,
  constraints: DeveloperHardConstraints | undefined,
): string {
  if (schema.enum !== undefined) {
    return chooseComponent(
      registry,
      hardConstraint?.component,
      metadata?.component,
      ["ChoiceField"],
      constraints,
    );
  }
  let defaults: string[];
  switch (schema.type) {
    case "string":
      defaults = ["TextInput"];
      break;
    case "number":
    case "integer":
      defaults = ["NumberInput"];
      break;
    case "boolean":
      defaults = ["Checkbox"];
      break;
    case "array":
      defaults = ["ChoiceField"];
      break;
    case "object":
      defaults = ["Accordion", "Stack"];
  }
  return chooseComponent(
    registry,
    hardConstraint?.component,
    metadata?.component,
    defaults,
    constraints,
  );
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
  constraints: DeveloperHardConstraints | undefined,
  registry: ComponentRegistry,
): UINode | undefined {
  const field = metadata?.fields?.[path];
  const hardConstraint = constraints?.fields?.[path];
  if (
    hardConstraint?.visible === false ||
    (hardConstraint?.visible !== true && field?.hidden === true)
  ) {
    return undefined;
  }
  const component = componentForField(
    schema,
    field,
    registry,
    hardConstraint,
    constraints,
  );
  const props: Record<string, JsonValue> = {
    label: labelFor(name, schema, field),
    ...cloneValue(field?.props ?? {}),
  };
  if (schema.description !== undefined || field?.description !== undefined) {
    props.description = field?.description ?? schema.description ?? "";
  }
  if (schema.enum !== undefined) {
    props.options = cloneValue(schema.enum.filter((value) => value !== null));
  }
  if (schema.type !== "object") {
    if (schema.readOnly === true) props.readOnly = true;
    if (required) props.required = true;
    if (schema.format !== undefined) props.format = schema.format;
    if (schema.minimum !== undefined) props.minimum = schema.minimum;
    if (schema.maximum !== undefined) props.maximum = schema.maximum;
    if (schema.multipleOf !== undefined) props.step = schema.multipleOf;
    if (schema.minLength !== undefined) props.minLength = schema.minLength;
    if (schema.maxLength !== undefined) props.maxLength = schema.maxLength;
    if (schema.pattern !== undefined) props.pattern = schema.pattern;
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
          constraints,
          registry,
        ),
      )
      .filter((child): child is UINode => child !== undefined);
  } else {
    node.binding = {
      path,
      valueType: bindingType(schema),
      required,
      ...(schema.readOnly === true ? { semantic: "readOnly" } : {}),
    };
  }
  return node;
}

function applySchemaDefaults(
  schema: SimpleJsonSchema,
  data: JsonObject,
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
  const metadata = input.developer?.softHints ?? input.metadata;
  const constraints = input.developer?.hardConstraints;
  const rootComponent = chooseComponent(
    registry,
    constraints?.rootComponent,
    metadata?.rootComponent,
    ["Form"],
    constraints,
  );
  return {
    id: stableNodeId(input.surfaceId, "root"),
    stableId: `${input.surfaceId}.root`,
    component: rootComponent,
    props: {
      title: metadata?.title ?? input.schema.title ?? input.surfaceId,
      ...(metadata?.description === undefined
        ? {}
        : { description: metadata.description }),
    },
    children: sortedProperties(input.schema, "", metadata)
      .map(([name, schema]) =>
        createFieldNode(
          input.surfaceId,
          name,
          name,
          schema,
          input.schema.required?.includes(name) ?? false,
          metadata,
          constraints,
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
  const metadata = input.developer?.softHints ?? input.metadata;
  const constraints = input.developer?.hardConstraints;
  const itemsPath =
    metadata?.itemsPath ?? firstArrayPath(input.schema) ?? "items";
  const isSelection =
    input.intent === "single-select" || input.intent === "multi-select";
  const selectionPath = metadata?.selectionPath ?? "selection";
  const component = chooseComponent(
    registry,
    constraints?.rootComponent,
    metadata?.rootComponent,
    input.intent === "browse" ? ["DataTable", "Card"] : ["Card", "ChoiceField"],
    constraints,
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
      title: metadata?.title ?? input.schema.title ?? input.surfaceId,
      items,
      ...(isSelection ? { multiple: input.intent === "multi-select" } : {}),
      ...(component !== "Card" ||
      metadata?.itemComponent === undefined ||
      !registry.has(metadata.itemComponent) ||
      !componentIsAllowed(metadata.itemComponent, constraints)
        ? {}
        : { itemComponent: metadata.itemComponent }),
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
  const metadata = input.developer?.softHints ?? input.metadata;
  const constraints = input.developer?.hardConstraints;
  const component = chooseComponent(
    registry,
    constraints?.rootComponent,
    metadata?.rootComponent,
    ["Dialog"],
    constraints,
  );
  return {
    id: stableNodeId(input.surfaceId, "confirm"),
    stableId: `${input.surfaceId}.confirm`,
    component,
    props: {
      title: metadata?.title ?? input.schema.title ?? "Confirm",
      message:
        metadata?.description ??
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
  if (input.presentation !== undefined) {
    surface.presentation = cloneValue(input.presentation);
  }
  validateSurface(surface, registry);
  const generated = cloneValue(surface) as Partial<Surface>;
  delete generated.revision;
  return generated as GeneratedSurface;
}

import type {
  DataBinding,
  DeveloperHardConstraints,
  JsonValue,
  SchemaFieldAliases,
  SurfaceContext,
  UIConstraintAspect,
  UINode,
  UIOperation,
  UIIntent,
} from "@package-first/core";
import type {
  DeveloperUIConfiguration,
  FieldMetadata,
  GeneratorMetadata,
  SimpleJsonSchema,
} from "@package-first/generator";

import type {
  ApplyOperationsToolInput,
  CreateSurfaceToolInput,
  InspectSurfaceToolInput,
  ReplaceSurfaceToolInput,
} from "./types.js";

export class ToolInputError extends Error {
  readonly code = "INVALID_TOOL_ARGUMENTS";
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new ToolInputError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function allowedKeys(
  value: Record<string, unknown>,
  keys: string[],
  path: string,
): void {
  const allowed = new Set(keys);
  const extra = Object.keys(value).find((key) => !allowed.has(key));
  if (extra !== undefined) {
    throw new ToolInputError(`${path}.${extra} is not supported`);
  }
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ToolInputError(`${path} must be a non-empty string`);
  }
  return value;
}

function integerValue(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ToolInputError(`${path} must be a non-negative integer`);
  }
  return value;
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new ToolInputError(`${path} must be a boolean`);
  }
  return value;
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
  const object = record(value, path);
  return Object.fromEntries(
    Object.entries(object).map(([key, item]) => [
      key,
      jsonValue(item, `${path}.${key}`),
    ]),
  );
}

function jsonRecord(value: unknown, path: string): Record<string, JsonValue> {
  return jsonValue(value, path) as Record<string, JsonValue>;
}

function intentValue(value: unknown, path: string): UIIntent {
  const intents: UIIntent[] = [
    "form",
    "browse",
    "single-select",
    "multi-select",
    "confirm",
  ];
  if (!intents.includes(value as UIIntent)) {
    throw new ToolInputError(`${path} is not a supported UI intent`);
  }
  return value as UIIntent;
}

function schemaValue(value: unknown, path: string): SimpleJsonSchema {
  const object = record(value, path);
  allowedKeys(
    object,
    [
      "type",
      "title",
      "description",
      "properties",
      "required",
      "items",
      "enum",
      "default",
      "format",
    ],
    path,
  );
  const types = ["object", "array", "string", "number", "integer", "boolean"];
  if (!types.includes(object.type as string)) {
    throw new ToolInputError(`${path}.type is not supported`);
  }
  const schema: SimpleJsonSchema = {
    type: object.type as SimpleJsonSchema["type"],
  };
  for (const key of ["title", "description", "format"] as const) {
    if (object[key] !== undefined) {
      schema[key] = stringValue(object[key], `${path}.${key}`);
    }
  }
  if (object.properties !== undefined) {
    const properties = record(object.properties, `${path}.properties`);
    schema.properties = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        schemaValue(property, `${path}.properties.${key}`),
      ]),
    );
  }
  if (object.required !== undefined) {
    if (!Array.isArray(object.required)) {
      throw new ToolInputError(`${path}.required must be an array`);
    }
    schema.required = object.required.map((item, index) =>
      stringValue(item, `${path}.required[${index}]`),
    );
  }
  if (object.items !== undefined) {
    schema.items = schemaValue(object.items, `${path}.items`);
  }
  if (object.enum !== undefined) {
    if (!Array.isArray(object.enum)) {
      throw new ToolInputError(`${path}.enum must be an array`);
    }
    schema.enum = object.enum.map((item, index) =>
      jsonValue(item, `${path}.enum[${index}]`),
    );
  }
  if (object.default !== undefined) {
    schema.default = jsonValue(object.default, `${path}.default`);
  }
  return schema;
}

function fieldMetadataValue(value: unknown, path: string): FieldMetadata {
  const object = record(value, path);
  allowedKeys(
    object,
    [
      "label",
      "description",
      "component",
      "props",
      "order",
      "hidden",
      "collapsed",
    ],
    path,
  );
  const field: FieldMetadata = {};
  for (const key of ["label", "description", "component"] as const) {
    if (object[key] !== undefined) {
      field[key] = stringValue(object[key], `${path}.${key}`);
    }
  }
  if (object.props !== undefined) {
    field.props = jsonRecord(object.props, `${path}.props`);
  }
  if (object.order !== undefined) {
    if (typeof object.order !== "number" || !Number.isFinite(object.order)) {
      throw new ToolInputError(`${path}.order must be a finite number`);
    }
    field.order = object.order;
  }
  for (const key of ["hidden", "collapsed"] as const) {
    if (object[key] !== undefined) {
      field[key] = booleanValue(object[key], `${path}.${key}`);
    }
  }
  return field;
}

function metadataValue(value: unknown, path: string): GeneratorMetadata {
  const object = record(value, path);
  allowedKeys(
    object,
    [
      "title",
      "description",
      "rootComponent",
      "itemsPath",
      "selectionPath",
      "itemComponent",
      "fields",
    ],
    path,
  );
  const metadata: GeneratorMetadata = {};
  for (const key of [
    "title",
    "description",
    "rootComponent",
    "itemsPath",
    "selectionPath",
    "itemComponent",
  ] as const) {
    if (object[key] !== undefined) {
      metadata[key] = stringValue(object[key], `${path}.${key}`);
    }
  }
  if (object.fields !== undefined) {
    const fields = record(object.fields, `${path}.fields`);
    metadata.fields = Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [
        key,
        fieldMetadataValue(field, `${path}.fields.${key}`),
      ]),
    );
  }
  return metadata;
}

function hardConstraintsValue(
  value: unknown,
  path: string,
): DeveloperHardConstraints {
  const object = record(value, path);
  allowedKeys(object, ["rootComponent", "allowedComponents", "fields"], path);
  const constraints: DeveloperHardConstraints = {};
  if (object.rootComponent !== undefined) {
    constraints.rootComponent = stringValue(
      object.rootComponent,
      `${path}.rootComponent`,
    );
  }
  if (object.allowedComponents !== undefined) {
    if (!Array.isArray(object.allowedComponents)) {
      throw new ToolInputError(`${path}.allowedComponents must be an array`);
    }
    constraints.allowedComponents = object.allowedComponents.map(
      (component, index) =>
        stringValue(component, `${path}.allowedComponents[${index}]`),
    );
  }
  if (object.fields !== undefined) {
    const fields = record(object.fields, `${path}.fields`);
    const aspects: UIConstraintAspect[] = [
      "component",
      "props",
      "layout",
      "visibility",
      "position",
    ];
    constraints.fields = Object.fromEntries(
      Object.entries(fields).map(([stableId, rawConstraint]) => {
        const fieldPath = `${path}.fields.${stableId}`;
        const field = record(rawConstraint, fieldPath);
        allowedKeys(field, ["component", "visible", "locked"], fieldPath);
        const constraint: NonNullable<
          DeveloperHardConstraints["fields"]
        >[string] = {};
        if (field.component !== undefined) {
          constraint.component = stringValue(
            field.component,
            `${fieldPath}.component`,
          );
        }
        if (field.visible !== undefined) {
          constraint.visible = booleanValue(
            field.visible,
            `${fieldPath}.visible`,
          );
        }
        if (field.locked !== undefined) {
          if (!Array.isArray(field.locked)) {
            throw new ToolInputError(`${fieldPath}.locked must be an array`);
          }
          constraint.locked = field.locked.map((aspect, index) => {
            if (!aspects.includes(aspect as UIConstraintAspect)) {
              throw new ToolInputError(
                `${fieldPath}.locked[${index}] is not supported`,
              );
            }
            return aspect as UIConstraintAspect;
          });
        }
        return [stableId, constraint];
      }),
    );
  }
  return constraints;
}

function developerValue(
  value: unknown,
  path: string,
): DeveloperUIConfiguration {
  const object = record(value, path);
  allowedKeys(object, ["hardConstraints", "softHints"], path);
  const developer: DeveloperUIConfiguration = {};
  if (object.hardConstraints !== undefined) {
    developer.hardConstraints = hardConstraintsValue(
      object.hardConstraints,
      `${path}.hardConstraints`,
    );
  }
  if (object.softHints !== undefined) {
    developer.softHints = metadataValue(object.softHints, `${path}.softHints`);
  }
  return developer;
}

function fieldAliasesValue(value: unknown, path: string): SchemaFieldAliases {
  const aliases = record(value, path);
  return Object.fromEntries(
    Object.entries(aliases).map(([previousStableId, rawTargets]) => {
      const aliasPath = `${path}.${previousStableId}`;
      if (Array.isArray(rawTargets)) {
        if (rawTargets.length === 0) {
          throw new ToolInputError(`${aliasPath} must not be empty`);
        }
        return [
          previousStableId,
          rawTargets.map((target, index) =>
            stringValue(target, `${aliasPath}[${index}]`),
          ),
        ];
      }
      return [previousStableId, stringValue(rawTargets, aliasPath)];
    }),
  );
}

function bindingValue(value: unknown, path: string): DataBinding {
  const object = record(value, path);
  allowedKeys(object, ["path", "valueType", "semantic", "required"], path);
  const valueTypes = [
    "string",
    "number",
    "boolean",
    "object",
    "array",
    "unknown",
  ];
  if (!valueTypes.includes(object.valueType as string)) {
    throw new ToolInputError(`${path}.valueType is not supported`);
  }
  const binding: DataBinding = {
    path: stringValue(object.path, `${path}.path`),
    valueType: object.valueType as DataBinding["valueType"],
  };
  if (object.semantic !== undefined) {
    binding.semantic = stringValue(object.semantic, `${path}.semantic`);
  }
  if (object.required !== undefined) {
    binding.required = booleanValue(object.required, `${path}.required`);
  }
  return binding;
}

function nodeValue(value: unknown, path: string): UINode {
  const object = record(value, path);
  allowedKeys(
    object,
    [
      "id",
      "stableId",
      "component",
      "props",
      "binding",
      "children",
      "layout",
      "visible",
    ],
    path,
  );
  const node: UINode = {
    id: stringValue(object.id, `${path}.id`),
    component: stringValue(object.component, `${path}.component`),
    props: jsonRecord(object.props, `${path}.props`),
  };
  if (object.stableId !== undefined) {
    node.stableId = stringValue(object.stableId, `${path}.stableId`);
  }
  if (object.binding !== undefined) {
    node.binding = bindingValue(object.binding, `${path}.binding`);
  }
  if (object.children !== undefined) {
    if (!Array.isArray(object.children)) {
      throw new ToolInputError(`${path}.children must be an array`);
    }
    node.children = object.children.map((child, index) =>
      nodeValue(child, `${path}.children[${index}]`),
    );
  }
  if (object.layout !== undefined) {
    node.layout = jsonRecord(object.layout, `${path}.layout`);
  }
  if (object.visible !== undefined) {
    node.visible = booleanValue(object.visible, `${path}.visible`);
  }
  return node;
}

function operationValue(value: unknown, path: string): UIOperation {
  const object = record(value, path);
  const type = stringValue(object.type, `${path}.type`);
  switch (type) {
    case "moveNode": {
      allowedKeys(object, ["type", "target", "parent", "position"], path);
      const position = object.position;
      if (
        position !== "first" &&
        position !== "last" &&
        (typeof position !== "number" ||
          !Number.isInteger(position) ||
          position < 0)
      ) {
        throw new ToolInputError(`${path}.position is invalid`);
      }
      const operation: UIOperation = {
        type,
        target: stringValue(object.target, `${path}.target`),
        position,
      };
      if (object.parent !== undefined) {
        operation.parent = stringValue(object.parent, `${path}.parent`);
      }
      return operation;
    }
    case "replaceComponent": {
      allowedKeys(
        object,
        ["type", "target", "component", "props", "binding"],
        path,
      );
      const operation: UIOperation = {
        type,
        target: stringValue(object.target, `${path}.target`),
        component: stringValue(object.component, `${path}.component`),
      };
      if (object.props !== undefined) {
        operation.props = jsonRecord(object.props, `${path}.props`);
      }
      if (object.binding !== undefined) {
        operation.binding = bindingValue(object.binding, `${path}.binding`);
      }
      return operation;
    }
    case "setProps": {
      allowedKeys(object, ["type", "target", "props", "replace"], path);
      const operation: UIOperation = {
        type,
        target: stringValue(object.target, `${path}.target`),
        props: jsonRecord(object.props, `${path}.props`),
      };
      if (object.replace !== undefined) {
        operation.replace = booleanValue(object.replace, `${path}.replace`);
      }
      return operation;
    }
    case "setLayout":
      allowedKeys(object, ["type", "target", "layout"], path);
      return {
        type,
        target: stringValue(object.target, `${path}.target`),
        layout: jsonRecord(object.layout, `${path}.layout`),
      };
    case "setVisibility":
      allowedKeys(object, ["type", "target", "visible"], path);
      return {
        type,
        target: stringValue(object.target, `${path}.target`),
        visible: booleanValue(object.visible, `${path}.visible`),
      };
    case "groupNodes": {
      allowedKeys(object, ["type", "targets", "group"], path);
      if (!Array.isArray(object.targets)) {
        throw new ToolInputError(`${path}.targets must be an array`);
      }
      const group = record(object.group, `${path}.group`);
      allowedKeys(
        group,
        ["id", "stableId", "component", "props", "layout", "visible"],
        `${path}.group`,
      );
      const groupDefinition: Extract<
        UIOperation,
        { type: "groupNodes" }
      >["group"] = {
        id: stringValue(group.id, `${path}.group.id`),
        component: stringValue(group.component, `${path}.group.component`),
      };
      if (group.stableId !== undefined) {
        groupDefinition.stableId = stringValue(
          group.stableId,
          `${path}.group.stableId`,
        );
      }
      if (group.props !== undefined) {
        groupDefinition.props = jsonRecord(group.props, `${path}.group.props`);
      }
      if (group.layout !== undefined) {
        groupDefinition.layout = jsonRecord(
          group.layout,
          `${path}.group.layout`,
        );
      }
      if (group.visible !== undefined) {
        groupDefinition.visible = booleanValue(
          group.visible,
          `${path}.group.visible`,
        );
      }
      return {
        type,
        targets: object.targets.map((target, index) =>
          stringValue(target, `${path}.targets[${index}]`),
        ),
        group: groupDefinition,
      };
    }
    default:
      throw new ToolInputError(`${path}.type "${type}" is not supported`);
  }
}

function schemaRefValue(value: unknown, path: string) {
  const object = record(value, path);
  allowedKeys(object, ["id", "version"], path);
  const schemaRef: { id: string; version?: string } = {
    id: stringValue(object.id, `${path}.id`),
  };
  if (object.version !== undefined) {
    schemaRef.version = stringValue(object.version, `${path}.version`);
  }
  return schemaRef;
}

export function parseCreateSurface(value: unknown): CreateSurfaceToolInput {
  const object = record(value, "arguments");
  allowedKeys(
    object,
    [
      "surfaceId",
      "schema",
      "data",
      "intent",
      "developer",
      "metadata",
      "schemaRef",
      "toolId",
      "fieldAliases",
      "context",
    ],
    "arguments",
  );
  const input: CreateSurfaceToolInput = {
    surfaceId: stringValue(object.surfaceId, "arguments.surfaceId"),
    schema: schemaValue(object.schema, "arguments.schema"),
    data: jsonRecord(object.data, "arguments.data"),
    intent: intentValue(object.intent, "arguments.intent"),
  };
  if (object.developer !== undefined) {
    input.developer = developerValue(object.developer, "arguments.developer");
  }
  if (object.metadata !== undefined) {
    input.metadata = metadataValue(object.metadata, "arguments.metadata");
  }
  if (object.schemaRef !== undefined) {
    input.schemaRef = schemaRefValue(object.schemaRef, "arguments.schemaRef");
  }
  if (object.toolId !== undefined) {
    input.toolId = stringValue(object.toolId, "arguments.toolId");
  }
  if (object.fieldAliases !== undefined) {
    input.fieldAliases = fieldAliasesValue(
      object.fieldAliases,
      "arguments.fieldAliases",
    );
  }
  if (object.context !== undefined) {
    input.context = jsonRecord(
      object.context,
      "arguments.context",
    ) as SurfaceContext;
  }
  return input;
}

export function parseInspectSurface(value: unknown): InspectSurfaceToolInput {
  const object = record(value, "arguments");
  allowedKeys(object, ["surfaceId"], "arguments");
  return { surfaceId: stringValue(object.surfaceId, "arguments.surfaceId") };
}

export function parseApplyOperations(value: unknown): ApplyOperationsToolInput {
  const object = record(value, "arguments");
  allowedKeys(
    object,
    ["surfaceId", "baseRevision", "reason", "operations"],
    "arguments",
  );
  if (!Array.isArray(object.operations) || object.operations.length === 0) {
    throw new ToolInputError("arguments.operations must be a non-empty array");
  }
  return {
    surfaceId: stringValue(object.surfaceId, "arguments.surfaceId"),
    baseRevision: integerValue(object.baseRevision, "arguments.baseRevision"),
    reason: stringValue(object.reason, "arguments.reason"),
    operations: object.operations.map((operation, index) =>
      operationValue(operation, `arguments.operations[${index}]`),
    ),
  };
}

export function parseReplaceSurface(value: unknown): ReplaceSurfaceToolInput {
  const object = record(value, "arguments");
  allowedKeys(object, ["surfaceId", "baseRevision", "surface"], "arguments");
  const replacement = record(object.surface, "arguments.surface");
  allowedKeys(
    replacement,
    ["intent", "schemaRef", "tree", "data", "context"],
    "arguments.surface",
  );
  const surface: ReplaceSurfaceToolInput["surface"] = {
    intent: intentValue(replacement.intent, "arguments.surface.intent"),
    tree: nodeValue(replacement.tree, "arguments.surface.tree"),
    data: jsonRecord(replacement.data, "arguments.surface.data"),
    context: jsonRecord(
      replacement.context,
      "arguments.surface.context",
    ) as SurfaceContext,
  };
  if (replacement.schemaRef !== undefined) {
    surface.schemaRef = schemaRefValue(
      replacement.schemaRef,
      "arguments.surface.schemaRef",
    );
  }
  return {
    surfaceId: stringValue(object.surfaceId, "arguments.surfaceId"),
    baseRevision: integerValue(object.baseRevision, "arguments.baseRevision"),
    surface,
  };
}

import { componentManifestToDefinition } from "./component-pack.js";
import { InMemoryComponentRegistry } from "./component-registry.js";
import type {
  ComponentDefinition,
  ComponentManifest,
  JsonObject,
  JsonSchema,
} from "./types.js";

const stringSchema: JsonSchema = { type: "string" };
const booleanSchema: JsonSchema = { type: "boolean" };
const numberSchema: JsonSchema = { type: "number" };
const arraySchema: JsonSchema = { type: "array" };
const anySchema: JsonSchema = {};

function propsSchema(
  properties: Record<string, JsonSchema> = {},
  required: string[] = [],
): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties: properties as JsonObject,
    ...(required.length === 0 ? {} : { required }),
  };
}

function actionSchema(actions: string[]): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["action", "input"],
    properties: {
      action: { type: "string", enum: actions },
      input: anySchema,
    },
  };
}

const fieldProps = {
  label: stringSchema,
  description: stringSchema,
  collapsed: booleanSchema,
};

/** Canonical semantic declarations. They contain no renderer binding. */
export const standardComponentManifests: ComponentManifest[] = [
  {
    semanticType: "Text",
    propsSchema: propsSchema({ text: stringSchema }),
    binding: { valueTypes: ["string", "number", "unknown"] },
  },
  {
    semanticType: "Image",
    propsSchema: propsSchema({ src: stringSchema, alt: stringSchema }),
  },
  {
    semanticType: "Badge",
    propsSchema: propsSchema({ text: stringSchema }),
    binding: { valueTypes: ["string", "number", "unknown"] },
  },
  { semanticType: "Stack", propsSchema: propsSchema() },
  { semanticType: "Grid", propsSchema: propsSchema() },
  {
    semanticType: "Accordion",
    propsSchema: propsSchema({
      label: stringSchema,
      title: stringSchema,
      collapsed: booleanSchema,
    }),
  },
  {
    semanticType: "Form",
    propsSchema: propsSchema({
      title: stringSchema,
      description: stringSchema,
      submitLabel: stringSchema,
    }),
    actions: [{ name: "submit", sideEffect: true }],
    actionSchema: actionSchema(["submit"]),
  },
  {
    semanticType: "TextInput",
    propsSchema: propsSchema(fieldProps),
    binding: { valueTypes: ["string", "unknown"] },
  },
  {
    semanticType: "NumberInput",
    propsSchema: propsSchema({
      ...fieldProps,
      minimum: numberSchema,
      maximum: numberSchema,
      step: numberSchema,
    }),
    binding: { valueTypes: ["number", "unknown"] },
  },
  {
    semanticType: "ChoiceField",
    propsSchema: propsSchema({
      ...fieldProps,
      title: stringSchema,
      options: arraySchema,
      multiple: booleanSchema,
    }),
    binding: { valueTypes: ["string", "number", "array", "unknown"] },
    actions: ["select"],
    actionSchema: actionSchema(["select"]),
  },
  {
    semanticType: "Checkbox",
    propsSchema: propsSchema(fieldProps),
    binding: { valueTypes: ["boolean", "unknown"] },
  },
  {
    semanticType: "DataTable",
    propsSchema: propsSchema({
      title: stringSchema,
      items: arraySchema,
      columns: arraySchema,
    }),
    binding: { valueTypes: ["array", "unknown"] },
  },
  {
    semanticType: "Card",
    propsSchema: propsSchema({
      title: stringSchema,
      label: stringSchema,
      description: stringSchema,
      items: arraySchema,
      options: arraySchema,
      item: anySchema,
      multiple: booleanSchema,
      itemComponent: stringSchema,
    }),
    binding: { valueTypes: ["array", "string", "number", "unknown"] },
    actions: ["select"],
    actionSchema: actionSchema(["select"]),
  },
  {
    semanticType: "Action",
    propsSchema: propsSchema({ label: stringSchema }),
    actions: ["press"],
    actionSchema: actionSchema(["press"]),
  },
  {
    semanticType: "Dialog",
    propsSchema: propsSchema({
      title: stringSchema,
      message: stringSchema,
      summary: anySchema,
      confirmLabel: stringSchema,
      cancelLabel: stringSchema,
    }),
    actions: ["confirm", "cancel"],
    actionSchema: actionSchema(["confirm", "cancel"]),
  },
  {
    semanticType: "EmptyState",
    propsSchema: propsSchema({ message: stringSchema }),
  },
  {
    semanticType: "ErrorState",
    propsSchema: propsSchema({ message: stringSchema }),
  },
];

const legacyComponentManifests: ComponentManifest[] = [
  {
    ...standardComponentManifests.find(
      (component) => component.semanticType === "ChoiceField",
    )!,
    semanticType: "Select",
    fallback: "ChoiceField",
  },
  {
    ...standardComponentManifests.find(
      (component) => component.semanticType === "DataTable",
    )!,
    semanticType: "Table",
    fallback: "DataTable",
  },
  {
    ...standardComponentManifests.find(
      (component) => component.semanticType === "Card",
    )!,
    semanticType: "CardList",
    fallback: "Card",
  },
  {
    ...standardComponentManifests.find(
      (component) => component.semanticType === "Action",
    )!,
    semanticType: "Button",
    fallback: "Action",
  },
  {
    ...standardComponentManifests.find(
      (component) => component.semanticType === "Dialog",
    )!,
    semanticType: "Confirm",
    fallback: "Dialog",
  },
];

/** @deprecated Prefer the serializable standardComponentManifests catalog. */
export const standardComponentDefinitions: ComponentDefinition[] = [
  ...standardComponentManifests,
  ...legacyComponentManifests,
].map(componentManifestToDefinition);

/** Creates a semantic registry; renderer packs are registered separately. */
export function createStandardComponentRegistry(): InMemoryComponentRegistry {
  const registry = new InMemoryComponentRegistry();
  for (const definition of standardComponentDefinitions) {
    registry.register(definition);
  }
  return registry;
}

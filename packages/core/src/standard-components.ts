import { InMemoryComponentRegistry } from "./component-registry.js";
import type { ComponentDefinition } from "./types.js";

/** Minimal trusted catalog shared by the generator and first-party renderer. */
export const standardComponentDefinitions: ComponentDefinition[] = [
  { type: "Text", binding: { valueTypes: ["string", "number", "unknown"] } },
  { type: "Image" },
  { type: "Badge", binding: { valueTypes: ["string", "number", "unknown"] } },
  { type: "Stack" },
  { type: "Grid" },
  { type: "Accordion" },
  { type: "Form", actions: [{ name: "submit", sideEffect: true }] },
  {
    type: "TextInput",
    binding: { valueTypes: ["string", "unknown"] },
  },
  { type: "NumberInput", binding: { valueTypes: ["number", "unknown"] } },
  {
    type: "Select",
    binding: { valueTypes: ["string", "number", "array", "unknown"] },
  },
  { type: "Checkbox", binding: { valueTypes: ["boolean", "unknown"] } },
  { type: "Table", binding: { valueTypes: ["array", "unknown"] } },
  {
    type: "CardList",
    binding: { valueTypes: ["array", "string", "number", "unknown"] },
    actions: ["select"],
  },
  { type: "Button", actions: ["press"] },
  { type: "Confirm", actions: ["confirm", "cancel"] },
  { type: "EmptyState" },
  { type: "ErrorState" },
];

/** Creates a new registry so hosts can add their own trusted components. */
export function createStandardComponentRegistry(): InMemoryComponentRegistry {
  const registry = new InMemoryComponentRegistry();
  for (const definition of standardComponentDefinitions) {
    registry.register(definition);
  }
  return registry;
}

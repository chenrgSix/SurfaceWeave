import { createStandardComponentRegistry, type Surface } from "../src/index.js";

export function createRegistry() {
  return createStandardComponentRegistry();
}

export function createFormSurface(): Omit<Surface, "revision"> {
  return {
    id: "purchase",
    intent: "form",
    tree: {
      id: "purchase-root",
      component: "Form",
      props: { title: "Purchase" },
      children: [
        {
          id: "name-node",
          stableId: "purchase.name",
          component: "TextInput",
          props: { label: "Name" },
          binding: {
            path: "purchase.name",
            valueType: "string",
            semantic: "customer-name",
          },
        },
        {
          id: "remark-node",
          stableId: "purchase.remark",
          component: "TextInput",
          props: { label: "Remark" },
          binding: {
            path: "purchase.remark",
            valueType: "string",
            semantic: "remark",
          },
        },
      ],
    },
    data: {
      purchase: {
        name: "Ada",
        remark: "Keep dry",
      },
    },
    context: { source: "test" },
  };
}

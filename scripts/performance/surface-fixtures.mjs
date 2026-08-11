export function createFlatFormSurface(
  nodeCount,
  surfaceId = `flat-${nodeCount}`,
) {
  if (!Number.isInteger(nodeCount) || nodeCount < 2) {
    throw new Error("nodeCount must include a root and at least one field");
  }
  const fields = {};
  const children = [];
  for (let index = 0; index < nodeCount - 1; index += 1) {
    const field = `field${index}`;
    fields[field] = "value";
    children.push({
      id: `${surfaceId}.${field}`,
      stableId: `${surfaceId}.${field}`,
      component: "TextInput",
      props: { label: `Field ${index}` },
      binding: { path: `fields.${field}`, valueType: "string" },
    });
  }
  return {
    id: surfaceId,
    intent: "form",
    tree: {
      id: `${surfaceId}.root`,
      component: "Form",
      props: { title: `Benchmark ${nodeCount}` },
      children,
    },
    data: { fields },
    context: { source: "performance-benchmark" },
  };
}

export function createDeepFormSurface(depth = 64, surfaceId = `deep-${depth}`) {
  if (!Number.isInteger(depth) || depth < 2) {
    throw new Error("depth must be at least two");
  }
  let node = {
    id: `${surfaceId}.field`,
    stableId: `${surfaceId}.field`,
    component: "TextInput",
    props: { label: "Deep field" },
    binding: { path: "deep.value", valueType: "string" },
  };
  for (let level = depth - 1; level > 1; level -= 1) {
    node = {
      id: `${surfaceId}.stack-${level}`,
      component: "Stack",
      props: {},
      children: [node],
    };
  }
  return {
    id: surfaceId,
    intent: "form",
    tree: {
      id: `${surfaceId}.root`,
      component: "Form",
      props: { title: `Depth ${depth}` },
      children: [node],
    },
    data: { deep: { value: "value" } },
    context: { source: "performance-benchmark" },
  };
}

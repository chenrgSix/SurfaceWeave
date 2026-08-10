import { assertSafeDeclaration } from "./data.js";
import { DynamicUIError } from "./errors.js";
import type {
  JsonValue,
  SemanticLayout,
  SemanticLayoutDiagnostic,
  SemanticLayoutFeature,
  SemanticLayoutResolution,
  SemanticLayoutValues,
  SurfaceViewMode,
} from "./types.js";

export const semanticLayoutFeatures: SemanticLayoutFeature[] = [
  "direction",
  "columns",
  "gap",
  "align",
  "justify",
  "span",
];

const featureSet = new Set<string>(semanticLayoutFeatures);
const alignments = new Set(["start", "center", "end", "stretch"]);
const justifications = new Set(["start", "center", "end", "between"]);

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
    ? (value as Record<string, unknown>)
    : undefined;
}

function diagnostic(
  diagnostics: SemanticLayoutDiagnostic[],
  code: SemanticLayoutDiagnostic["code"],
  path: string,
  message: string,
): void {
  diagnostics.push({ code, path, message });
}

function readValues(
  value: unknown,
  path: string,
  diagnostics: SemanticLayoutDiagnostic[],
): SemanticLayoutValues {
  const object = plainRecord(value);
  if (object === undefined) {
    diagnostic(
      diagnostics,
      "INVALID_LAYOUT_VALUE",
      path,
      `${path} must be a plain object`,
    );
    return {};
  }

  const result: SemanticLayoutValues = {};
  for (const [key, item] of Object.entries(object)) {
    if (!featureSet.has(key)) {
      diagnostic(
        diagnostics,
        "UNKNOWN_LAYOUT_PROPERTY",
        `${path}.${key}`,
        `Layout property "${key}" is not part of LayoutSpec 1.0`,
      );
      continue;
    }
    switch (key as SemanticLayoutFeature) {
      case "direction":
        if (item === "row" || item === "column") result.direction = item;
        else
          diagnostic(
            diagnostics,
            "INVALID_LAYOUT_VALUE",
            `${path}.direction`,
            "direction must be row or column",
          );
        break;
      case "columns":
        if (
          Number.isInteger(item) &&
          (item as number) >= 1 &&
          (item as number) <= 12
        )
          result.columns = item as number;
        else
          diagnostic(
            diagnostics,
            "INVALID_LAYOUT_VALUE",
            `${path}.columns`,
            "columns must be an integer from 1 to 12",
          );
        break;
      case "gap":
        if (
          typeof item === "number" &&
          Number.isFinite(item) &&
          item >= 0 &&
          item <= 64
        )
          result.gap = item;
        else
          diagnostic(
            diagnostics,
            "INVALID_LAYOUT_VALUE",
            `${path}.gap`,
            "gap must be a finite number from 0 to 64",
          );
        break;
      case "align":
        if (typeof item === "string" && alignments.has(item))
          result.align = item as NonNullable<SemanticLayoutValues["align"]>;
        else
          diagnostic(
            diagnostics,
            "INVALID_LAYOUT_VALUE",
            `${path}.align`,
            "align must be start, center, end, or stretch",
          );
        break;
      case "justify":
        if (typeof item === "string" && justifications.has(item))
          result.justify = item as NonNullable<SemanticLayoutValues["justify"]>;
        else
          diagnostic(
            diagnostics,
            "INVALID_LAYOUT_VALUE",
            `${path}.justify`,
            "justify must be start, center, end, or between",
          );
        break;
      case "span":
        if (
          Number.isInteger(item) &&
          (item as number) >= 1 &&
          (item as number) <= 12
        )
          result.span = item as number;
        else
          diagnostic(
            diagnostics,
            "INVALID_LAYOUT_VALUE",
            `${path}.span`,
            "span must be an integer from 1 to 12",
          );
    }
  }
  return result;
}

function inspectLayout(value: unknown): {
  layout: SemanticLayout;
  diagnostics: SemanticLayoutDiagnostic[];
} {
  assertSafeDeclaration(value, "layout", "INVALID_SURFACE");
  const diagnostics: SemanticLayoutDiagnostic[] = [];
  const object = plainRecord(value);
  if (object === undefined) {
    return {
      layout: {},
      diagnostics: [
        {
          code: "INVALID_LAYOUT_VALUE",
          path: "layout",
          message: "layout must be a plain object",
        },
      ],
    };
  }

  const values = readValues(
    Object.fromEntries(
      Object.entries(object).filter(([key]) => key !== "modes"),
    ),
    "layout",
    diagnostics,
  );
  const layout: SemanticLayout = { ...values };
  if (object.modes !== undefined) {
    const modes = plainRecord(object.modes);
    if (modes === undefined) {
      diagnostic(
        diagnostics,
        "INVALID_LAYOUT_VALUE",
        "layout.modes",
        "layout.modes must be a plain object",
      );
    } else {
      const overrides: NonNullable<SemanticLayout["modes"]> = {};
      for (const [mode, override] of Object.entries(modes)) {
        if (mode !== "compact" && mode !== "workspace") {
          diagnostic(
            diagnostics,
            "UNKNOWN_LAYOUT_PROPERTY",
            `layout.modes.${mode}`,
            `Layout mode "${mode}" is not supported`,
          );
          continue;
        }
        overrides[mode] = readValues(
          override,
          `layout.modes.${mode}`,
          diagnostics,
        );
      }
      layout.modes = overrides;
    }
  }
  return { layout, diagnostics };
}

/** Strictly parses a portable LayoutSpec 1.0 declaration. */
export function parseSemanticLayout(value: unknown): SemanticLayout {
  const inspected = inspectLayout(value);
  if (inspected.diagnostics.length > 0) {
    throw new DynamicUIError(
      "INVALID_SURFACE",
      inspected.diagnostics.map((item) => item.message).join("; "),
      { diagnostics: inspected.diagnostics },
    );
  }
  return inspected.layout;
}

/** Converts a typed semantic layout into a JSON-compatible node declaration. */
export function serializeSemanticLayout(
  value: SemanticLayout,
): Record<string, JsonValue> {
  const layout = parseSemanticLayout(value);
  const result: Record<string, JsonValue> = {};
  for (const feature of semanticLayoutFeatures) {
    const item = layout[feature];
    if (item !== undefined) result[feature] = item;
  }
  if (layout.modes !== undefined) {
    const modes: Record<string, JsonValue> = {};
    for (const mode of ["compact", "workspace"] as const) {
      const override = layout.modes[mode];
      if (override === undefined) continue;
      modes[mode] = Object.fromEntries(
        semanticLayoutFeatures.flatMap((feature) =>
          override[feature] === undefined
            ? []
            : [[feature, override[feature] as JsonValue]],
        ),
      );
    }
    result.modes = modes;
  }
  return result;
}

/**
 * Resolves mode overrides and filters unsupported features without throwing for
 * legacy declarations. Unknown or invalid values are reported and ignored.
 */
export function resolveSemanticLayout(
  value: unknown,
  mode: SurfaceViewMode,
  supportedFeatures: readonly SemanticLayoutFeature[] = semanticLayoutFeatures,
): SemanticLayoutResolution {
  const inspected = inspectLayout(value ?? {});
  const selected = {
    ...inspected.layout,
    ...(inspected.layout.modes?.[mode] ?? {}),
  };
  delete (selected as SemanticLayout).modes;

  const supported = new Set(supportedFeatures);
  const layout: SemanticLayoutValues = {};
  for (const feature of semanticLayoutFeatures) {
    const item = selected[feature];
    if (item === undefined) continue;
    if (!supported.has(feature)) {
      diagnostic(
        inspected.diagnostics,
        "UNSUPPORTED_LAYOUT_FEATURE",
        `layout.${feature}`,
        `Layout feature "${feature}" is not supported and was ignored`,
      );
      continue;
    }
    Object.assign(layout, { [feature]: item });
  }
  if (
    mode === "compact" &&
    layout.columns !== undefined &&
    layout.columns !== 1
  ) {
    layout.columns = 1;
    diagnostic(
      inspected.diagnostics,
      "COMPACT_LAYOUT_FALLBACK",
      "layout.columns",
      "Compact mode safely reduced the layout to one column",
    );
  }
  return { layout, diagnostics: inspected.diagnostics };
}

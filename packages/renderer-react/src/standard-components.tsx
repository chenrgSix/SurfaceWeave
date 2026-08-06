import { cloneValue, standardComponentManifests } from "@surfaceweave/core";
import type { JsonValue } from "@surfaceweave/core";
import type { CSSProperties, ChangeEvent, ReactNode } from "react";

import { ReactComponentRegistry } from "./react-component-registry.js";
import type { ReactComponentPack, RendererComponentProps } from "./types.js";

function stringProp(
  props: Record<string, JsonValue>,
  key: string,
  fallback = "",
): string {
  return typeof props[key] === "string" ? props[key] : fallback;
}

function labelForItem(item: JsonValue, index: number): string {
  if (typeof item === "string" || typeof item === "number") {
    return String(item);
  }
  if (typeof item === "object" && item !== null && !Array.isArray(item)) {
    const label = item.name ?? item.label ?? item.title ?? item.id;
    if (typeof label === "string" || typeof label === "number") {
      return String(label);
    }
  }
  return `Item ${index + 1}`;
}

function valueForItem(item: JsonValue, index: number): JsonValue {
  if (typeof item === "object" && item !== null && !Array.isArray(item)) {
    return item.id ?? item.value ?? index;
  }
  return item;
}

function TextComponent({ node, value }: RendererComponentProps) {
  return (
    <span>
      {value === undefined ? stringProp(node.props, "text") : String(value)}
    </span>
  );
}

function ImageComponent({ node }: RendererComponentProps) {
  const source = stringProp(node.props, "src");
  const safeSource =
    source.startsWith("data:image/") || source.startsWith("blob:")
      ? source
      : undefined;
  return safeSource === undefined ? (
    <span
      role="img"
      aria-label={stringProp(node.props, "alt", "Image unavailable")}
    />
  ) : (
    <img src={safeSource} alt={stringProp(node.props, "alt")} />
  );
}

function BadgeComponent({ node, value }: RendererComponentProps) {
  return (
    <span data-component="Badge">
      {value === undefined ? stringProp(node.props, "text") : String(value)}
    </span>
  );
}

function StackComponent({ children }: RendererComponentProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {children}
    </div>
  );
}

function GridComponent({ children, mode }: RendererComponentProps) {
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns:
          mode === "compact"
            ? "minmax(0, 1fr)"
            : "repeat(auto-fit, minmax(220px, 1fr))",
      }}
    >
      {children}
    </div>
  );
}

function AccordionComponent({ node, children }: RendererComponentProps) {
  return (
    <details open={node.props.collapsed !== true}>
      <summary>
        {stringProp(node.props, "label", stringProp(node.props, "title"))}
      </summary>
      {children}
    </details>
  );
}

function Field({
  node,
  children,
}: {
  node: RendererComponentProps["node"];
  children: ReactNode;
}) {
  const label = stringProp(node.props, "label", node.stableId ?? node.id);
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInputComponent({
  node,
  value,
  onValueChange,
}: RendererComponentProps) {
  const field = (
    <Field node={node}>
      <input
        aria-label={stringProp(node.props, "label", node.stableId ?? node.id)}
        readOnly={node.props.readOnly === true}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      />
    </Field>
  );
  return node.props.collapsed === true ? (
    <details>
      <summary>
        {stringProp(node.props, "label", node.stableId ?? node.id)}
      </summary>
      {field}
    </details>
  ) : (
    field
  );
}

function NumberInputComponent({
  node,
  value,
  onValueChange,
}: RendererComponentProps) {
  return (
    <Field node={node}>
      <input
        type="number"
        aria-label={stringProp(node.props, "label", node.stableId ?? node.id)}
        readOnly={node.props.readOnly === true}
        value={typeof value === "number" ? value : ""}
        onChange={(event) =>
          onValueChange(
            event.currentTarget.value === ""
              ? null
              : event.currentTarget.valueAsNumber,
          )
        }
      />
    </Field>
  );
}

function CheckboxComponent({
  node,
  value,
  onValueChange,
}: RendererComponentProps) {
  return (
    <label>
      <input
        type="checkbox"
        checked={value === true}
        disabled={node.props.readOnly === true}
        onChange={(event) => onValueChange(event.currentTarget.checked)}
      />
      {stringProp(node.props, "label", node.stableId ?? node.id)}
    </label>
  );
}

function SelectComponent({
  node,
  value,
  onValueChange,
  onAction,
}: RendererComponentProps) {
  const options = Array.isArray(node.props.options) ? node.props.options : [];
  const multiple = node.props.multiple === true;
  function change(event: ChangeEvent<HTMLSelectElement>) {
    const nextValue = multiple
      ? [...event.currentTarget.selectedOptions].map((option) => option.value)
      : event.currentTarget.value;
    onValueChange(nextValue);
    onAction("select", { value: nextValue });
  }
  return (
    <Field node={node}>
      <select
        aria-label={stringProp(node.props, "label", node.stableId ?? node.id)}
        disabled={node.props.readOnly === true}
        multiple={multiple}
        value={
          multiple
            ? Array.isArray(value)
              ? value.map(String)
              : []
            : typeof value === "string" || typeof value === "number"
              ? String(value)
              : ""
        }
        onChange={change}
      >
        {!multiple && <option value="">Select…</option>}
        {options.map((option, index) => {
          const optionValue = valueForItem(option, index);
          return (
            <option key={String(optionValue)} value={String(optionValue)}>
              {labelForItem(option, index)}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

function FormComponent({ node, children, onAction }: RendererComponentProps) {
  const invocationId = stringProp(node.props, "invocationId");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onAction(
          stringProp(node.props, "submitAction", "submit"),
          invocationId === "" ? null : { invocationId },
        );
      }}
    >
      <h2>{stringProp(node.props, "title")}</h2>
      <fieldset disabled={node.props.submitting === true}>
        <div style={{ display: "grid", gap: 12 }}>{children}</div>
        <button type="submit">
          {node.props.submitting === true
            ? "Submitting…"
            : stringProp(node.props, "submitLabel", "Submit")}
        </button>
      </fieldset>
    </form>
  );
}

function CardListComponent({
  node,
  value,
  onValueChange,
  onAction,
}: RendererComponentProps) {
  const items = Array.isArray(node.props.items) ? node.props.items : [];
  const multiple = node.props.multiple === true;
  const selected = new Set(
    Array.isArray(value) ? value.map(String) : [String(value ?? "")],
  );
  return (
    <section aria-label={stringProp(node.props, "title", "Items")}>
      <h2>{stringProp(node.props, "title")}</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item, index) => {
          const itemValue = valueForItem(item, index);
          const key = String(itemValue);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected.has(key)}
              onClick={() => {
                const next: JsonValue = multiple
                  ? selected.has(key)
                    ? [...selected].filter(
                        (selectedValue) => selectedValue !== key,
                      )
                    : [...selected, key]
                  : itemValue;
                onValueChange(next);
                onAction("select", { value: next });
              }}
            >
              {labelForItem(item, index)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TableComponent({ node }: RendererComponentProps) {
  const items = Array.isArray(node.props.items) ? node.props.items : [];
  return (
    <ul>
      {items.map((item, index) => (
        <li key={String(valueForItem(item, index))}>
          {labelForItem(item, index)}
        </li>
      ))}
    </ul>
  );
}

function ButtonComponent({ node, onAction }: RendererComponentProps) {
  const invocationId = stringProp(node.props, "invocationId");
  return (
    <button
      type="button"
      disabled={node.props.disabled === true}
      onClick={() =>
        onAction(
          stringProp(node.props, "action", "press"),
          invocationId === "" ? null : { invocationId },
        )
      }
    >
      {stringProp(node.props, "label", "Continue")}
    </button>
  );
}

function ConfirmComponent({ node, onAction }: RendererComponentProps) {
  const invocationId = stringProp(node.props, "invocationId");
  return (
    <section>
      <h2>{stringProp(node.props, "title", "Confirm")}</h2>
      <p>{stringProp(node.props, "message")}</p>
      <button
        type="button"
        onClick={() =>
          onAction(
            stringProp(node.props, "confirmAction", "confirm"),
            invocationId === "" ? null : { invocationId, confirmed: true },
          )
        }
      >
        Confirm
      </button>
      <button
        type="button"
        onClick={() =>
          onAction(
            stringProp(node.props, "cancelAction", "cancel"),
            invocationId === "" ? null : { invocationId },
          )
        }
      >
        Cancel
      </button>
    </section>
  );
}

function EmptyStateComponent({ node }: RendererComponentProps) {
  return <p>{stringProp(node.props, "message", "No data")}</p>;
}

function ErrorStateComponent({ node }: RendererComponentProps) {
  return (
    <p role="alert">{stringProp(node.props, "message", "Unable to render")}</p>
  );
}

export function registerStandardReactComponents(
  registry: ReactComponentRegistry,
): void {
  registry.registerPack(createDefaultReactComponentPack());
}

/** Built-in React runtime binding for the canonical semantic catalog. */
export function createDefaultReactComponentPack(): ReactComponentPack {
  return {
    manifest: {
      protocolVersion: "1.0",
      id: "default",
      version: "1.0.0",
      rendererKind: "react",
      priority: 0,
      components: cloneValue(standardComponentManifests),
      agentGuidance: {
        summary:
          "Portable baseline rendering for the standard semantic UI catalog.",
      },
    },
    bindings: {
      Text: TextComponent,
      Image: ImageComponent,
      Badge: BadgeComponent,
      Stack: StackComponent,
      Grid: GridComponent,
      Accordion: AccordionComponent,
      Form: FormComponent,
      TextInput: TextInputComponent,
      NumberInput: NumberInputComponent,
      ChoiceField: SelectComponent,
      Checkbox: CheckboxComponent,
      DataTable: TableComponent,
      Card: CardListComponent,
      Action: ButtonComponent,
      Dialog: ConfirmComponent,
      EmptyState: EmptyStateComponent,
      ErrorState: ErrorStateComponent,
    },
  };
}

export function createStandardReactComponentRegistry(
  trustedRegistry: ConstructorParameters<typeof ReactComponentRegistry>[0],
): ReactComponentRegistry {
  const registry = new ReactComponentRegistry(trustedRegistry);
  registerStandardReactComponents(registry);
  return registry;
}

export function safeLayoutStyle(
  layout: Record<string, JsonValue> | undefined,
): CSSProperties {
  if (layout === undefined) {
    return {};
  }
  const style: CSSProperties = {};
  if (typeof layout.gap === "number" && layout.gap >= 0 && layout.gap <= 64) {
    style.gap = layout.gap;
  }
  if (layout.direction === "row" || layout.direction === "column") {
    style.flexDirection = layout.direction;
  }
  if (
    typeof layout.columns === "number" &&
    Number.isInteger(layout.columns) &&
    layout.columns >= 1 &&
    layout.columns <= 12
  ) {
    style.gridTemplateColumns = `repeat(${layout.columns}, minmax(0, 1fr))`;
  }
  return style;
}

import type { JsonValue } from "@surfaceweave/core";
import type { RendererComponentProps } from "@surfaceweave/react";
import {
  Button,
  Cell,
  Checkbox,
  CheckboxGroup,
  Column,
  Dialog,
  Form,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  NumberField,
  Radio,
  RadioGroup,
  Row,
  Table,
  TableBody,
  TableHeader,
  TextField,
} from "react-aria-components";

function stringProp(
  props: Record<string, JsonValue>,
  key: string,
  fallback = "",
): string {
  return typeof props[key] === "string" ? props[key] : fallback;
}

function numberProp(
  props: Record<string, JsonValue>,
  key: string,
): number | undefined {
  return typeof props[key] === "number" ? props[key] : undefined;
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

function optionsFor(node: RendererComponentProps["node"]): JsonValue[] {
  if (Array.isArray(node.props.options)) return node.props.options;
  if (Array.isArray(node.props.items)) return node.props.items;
  return [];
}

function fieldLabel(node: RendererComponentProps["node"]): string {
  return stringProp(node.props, "label", node.stableId ?? node.id);
}

export function AriaText({ node, value }: RendererComponentProps) {
  return (
    <span className="pf-aria-text">
      {value === undefined ? stringProp(node.props, "text") : String(value)}
    </span>
  );
}

export function AriaImage({ node }: RendererComponentProps) {
  const source = stringProp(node.props, "src");
  const safeSource =
    source.startsWith("data:image/") || source.startsWith("blob:")
      ? source
      : undefined;
  return safeSource === undefined ? (
    <span role="img" aria-label={stringProp(node.props, "alt", "Image")} />
  ) : (
    <img src={safeSource} alt={stringProp(node.props, "alt")} />
  );
}

export function AriaBadge({ node, value }: RendererComponentProps) {
  return (
    <span className="pf-aria-badge">
      {value === undefined ? stringProp(node.props, "text") : String(value)}
    </span>
  );
}

export function AriaStack({ children }: RendererComponentProps) {
  return <div className="pf-aria-stack">{children}</div>;
}

export function AriaGrid({ children }: RendererComponentProps) {
  return <div className="pf-aria-grid">{children}</div>;
}

export function AriaAccordion({ node, children }: RendererComponentProps) {
  return (
    <details
      open={node.props.collapsed !== true}
      className="pf-aria-disclosure"
    >
      <summary>
        {stringProp(node.props, "label", stringProp(node.props, "title"))}
      </summary>
      {children}
    </details>
  );
}

export function AriaTextInput({
  node,
  value,
  onValueChange,
}: RendererComponentProps) {
  const field = (
    <TextField
      className="pf-aria-field"
      isReadOnly={node.props.readOnly === true}
      value={typeof value === "string" ? value : ""}
      onChange={onValueChange}
    >
      <Label>{fieldLabel(node)}</Label>
      <Input />
      {typeof node.props.description === "string" && (
        <small>{node.props.description}</small>
      )}
    </TextField>
  );
  return node.props.collapsed === true ? (
    <details className="pf-aria-disclosure">
      <summary>{fieldLabel(node)}</summary>
      {field}
    </details>
  ) : (
    field
  );
}

export function AriaNumberInput({
  node,
  value,
  onValueChange,
}: RendererComponentProps) {
  return (
    <NumberField
      className="pf-aria-field"
      isReadOnly={node.props.readOnly === true}
      {...(typeof value === "number" ? { value } : {})}
      {...(numberProp(node.props, "minimum") === undefined
        ? {}
        : { minValue: numberProp(node.props, "minimum") as number })}
      {...(numberProp(node.props, "maximum") === undefined
        ? {}
        : { maxValue: numberProp(node.props, "maximum") as number })}
      {...(numberProp(node.props, "step") === undefined
        ? {}
        : { step: numberProp(node.props, "step") as number })}
      onChange={(next) => onValueChange(Number.isFinite(next) ? next : null)}
    >
      <Label>{fieldLabel(node)}</Label>
      <div className="pf-aria-number-control">
        <Button slot="decrement">−</Button>
        <Input />
        <Button slot="increment">+</Button>
      </div>
    </NumberField>
  );
}

export function AriaCheckbox({
  node,
  value,
  onValueChange,
}: RendererComponentProps) {
  return (
    <Checkbox
      className="pf-aria-checkbox"
      isReadOnly={node.props.readOnly === true}
      isSelected={value === true}
      onChange={onValueChange}
    >
      <span aria-hidden="true" className="pf-aria-checkbox-box" />
      {fieldLabel(node)}
    </Checkbox>
  );
}

export function AriaChoiceField({
  node,
  value,
  onValueChange,
  onAction,
}: RendererComponentProps) {
  const options = optionsFor(node);
  if (node.props.multiple === true) {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <CheckboxGroup
        className="pf-aria-choice"
        isReadOnly={node.props.readOnly === true}
        value={selected}
        onChange={(next) => {
          onValueChange(next);
          onAction("select", { value: next });
        }}
      >
        <Label>{fieldLabel(node)}</Label>
        {options.map((option, index) => {
          const key = String(valueForItem(option, index));
          return (
            <Checkbox key={key} value={key} className="pf-aria-choice-item">
              <span aria-hidden="true" className="pf-aria-checkbox-box" />
              {labelForItem(option, index)}
            </Checkbox>
          );
        })}
      </CheckboxGroup>
    );
  }
  return (
    <RadioGroup
      className="pf-aria-choice"
      isReadOnly={node.props.readOnly === true}
      value={
        typeof value === "string" || typeof value === "number"
          ? String(value)
          : ""
      }
      onChange={(nextKey) => {
        const optionIndex = options.findIndex(
          (option, index) => String(valueForItem(option, index)) === nextKey,
        );
        const next =
          optionIndex < 0
            ? nextKey
            : valueForItem(options[optionIndex] as JsonValue, optionIndex);
        onValueChange(next);
        onAction("select", { value: next });
      }}
    >
      <Label>{fieldLabel(node)}</Label>
      {options.map((option, index) => {
        const key = String(valueForItem(option, index));
        return (
          <Radio key={key} value={key} className="pf-aria-choice-item">
            <span aria-hidden="true" className="pf-aria-radio-dot" />
            {labelForItem(option, index)}
          </Radio>
        );
      })}
    </RadioGroup>
  );
}

export function AriaForm({ node, children, onAction }: RendererComponentProps) {
  const invocationId = stringProp(node.props, "invocationId");
  return (
    <Form
      className="pf-aria-form"
      onSubmit={(event) => {
        event.preventDefault();
        onAction(
          stringProp(node.props, "submitAction", "submit"),
          invocationId === "" ? null : { invocationId },
        );
      }}
    >
      <Heading slot="title">{stringProp(node.props, "title")}</Heading>
      {children}
      <Button type="submit" isDisabled={node.props.submitting === true}>
        {node.props.submitting === true
          ? "Submitting…"
          : stringProp(node.props, "submitLabel", "Submit")}
      </Button>
    </Form>
  );
}

function selectionKeys(value: JsonValue | undefined): Set<string> {
  return new Set(
    Array.isArray(value) ? value.map(String) : [String(value ?? "")],
  );
}

export function AriaCard({
  node,
  value,
  onValueChange,
  onAction,
}: RendererComponentProps) {
  const items = optionsFor(node);
  const multiple = node.props.multiple === true;
  return (
    <section className="pf-aria-card-collection">
      <Heading>{stringProp(node.props, "title", fieldLabel(node))}</Heading>
      <ListBox
        aria-label={stringProp(node.props, "title", fieldLabel(node))}
        className="pf-aria-card-list"
        selectionMode={multiple ? "multiple" : "single"}
        selectedKeys={selectionKeys(value)}
        onSelectionChange={(selection) => {
          const keys =
            selection === "all"
              ? items.map((item, index) => String(valueForItem(item, index)))
              : [...selection].map(String);
          const next: JsonValue = multiple ? keys : (keys[0] ?? "");
          onValueChange(next);
          onAction("select", { value: next });
        }}
      >
        {items.map((item, index) => {
          const key = String(valueForItem(item, index));
          return (
            <ListBoxItem
              id={key}
              key={key}
              textValue={labelForItem(item, index)}
              className="pf-aria-card"
            >
              {labelForItem(item, index)}
            </ListBoxItem>
          );
        })}
      </ListBox>
    </section>
  );
}

function objectItem(item: JsonValue): Record<string, JsonValue> | undefined {
  return typeof item === "object" && item !== null && !Array.isArray(item)
    ? item
    : undefined;
}

export function AriaDataTable({ node }: RendererComponentProps) {
  const items = Array.isArray(node.props.items) ? node.props.items : [];
  const declaredColumns = Array.isArray(node.props.columns)
    ? node.props.columns.filter(
        (column): column is string => typeof column === "string",
      )
    : [];
  const columns =
    declaredColumns.length > 0
      ? declaredColumns
      : [
          ...new Set(
            items.flatMap((item) => Object.keys(objectItem(item) ?? {})),
          ),
        ];
  const title = stringProp(node.props, "title", "Data");
  return (
    <Table aria-label={title} className="pf-aria-table">
      <TableHeader>
        {columns.map((column, index) => (
          <Column id={column} key={column} isRowHeader={index === 0}>
            {column}
          </Column>
        ))}
      </TableHeader>
      <TableBody>
        {items.map((item, rowIndex) => {
          const object = objectItem(item);
          const id = String(object?.id ?? rowIndex);
          return (
            <Row id={id} key={id}>
              {columns.map((column) => (
                <Cell key={column}>{String(object?.[column] ?? "")}</Cell>
              ))}
            </Row>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function AriaAction({ node, onAction }: RendererComponentProps) {
  const invocationId = stringProp(node.props, "invocationId");
  return (
    <Button
      className="pf-aria-action"
      isDisabled={node.props.disabled === true}
      onPress={() =>
        onAction(
          stringProp(node.props, "action", "press"),
          invocationId === "" ? null : { invocationId },
        )
      }
    >
      {stringProp(node.props, "label", "Continue")}
    </Button>
  );
}

export function AriaDialog({ node, onAction }: RendererComponentProps) {
  const invocationId = stringProp(node.props, "invocationId");
  return (
    <ModalOverlay isOpen isDismissable={false} className="pf-aria-overlay">
      <Modal className="pf-aria-modal">
        <Dialog role="alertdialog" className="pf-aria-dialog">
          <Heading slot="title">
            {stringProp(node.props, "title", "Confirm")}
          </Heading>
          <p>{stringProp(node.props, "message")}</p>
          <div className="pf-aria-dialog-actions">
            <Button
              onPress={() =>
                onAction(
                  stringProp(node.props, "confirmAction", "confirm"),
                  invocationId === ""
                    ? null
                    : { invocationId, confirmed: true },
                )
              }
            >
              {stringProp(node.props, "confirmLabel", "Confirm")}
            </Button>
            <Button
              onPress={() =>
                onAction(
                  stringProp(node.props, "cancelAction", "cancel"),
                  invocationId === "" ? null : { invocationId },
                )
              }
            >
              {stringProp(node.props, "cancelLabel", "Cancel")}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export function AriaEmptyState({ node }: RendererComponentProps) {
  return <p>{stringProp(node.props, "message", "No data")}</p>;
}

export function AriaErrorState({ node }: RendererComponentProps) {
  return (
    <p role="alert">{stringProp(node.props, "message", "Unable to render")}</p>
  );
}

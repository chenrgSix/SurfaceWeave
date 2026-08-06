import type { JsonValue } from "@package-first/core";
import type { RendererComponentProps } from "@package-first/renderer-react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";

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

function valueForItem(item: JsonValue, index: number): string | number {
  if (typeof item === "object" && item !== null && !Array.isArray(item)) {
    const value = item.id ?? item.value;
    return typeof value === "string" || typeof value === "number"
      ? value
      : index;
  }
  return typeof item === "string" || typeof item === "number" ? item : index;
}

function optionsFor(node: RendererComponentProps["node"]): JsonValue[] {
  if (Array.isArray(node.props.options)) return node.props.options;
  if (Array.isArray(node.props.items)) return node.props.items;
  return [];
}

function fieldLabel(node: RendererComponentProps["node"]): string {
  return stringProp(node.props, "label", node.stableId ?? node.id);
}

export function AntText({ node, value }: RendererComponentProps) {
  return (
    <Typography.Text>
      {value === undefined ? stringProp(node.props, "text") : String(value)}
    </Typography.Text>
  );
}

export function AntImage({ node }: RendererComponentProps) {
  const source = stringProp(node.props, "src");
  const safeSource =
    source.startsWith("data:image/") || source.startsWith("blob:")
      ? source
      : undefined;
  return safeSource === undefined ? (
    <span role="img" aria-label={stringProp(node.props, "alt", "Image")} />
  ) : (
    <Image
      src={safeSource}
      alt={stringProp(node.props, "alt")}
      preview={false}
    />
  );
}

export function AntBadge({ node, value }: RendererComponentProps) {
  return (
    <Tag>
      {value === undefined ? stringProp(node.props, "text") : String(value)}
    </Tag>
  );
}

export function AntStack({ children }: RendererComponentProps) {
  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      {children}
    </Space>
  );
}

export function AntGrid({ children }: RendererComponentProps) {
  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      }}
    >
      {children}
    </div>
  );
}

export function AntAccordion({ node, children }: RendererComponentProps) {
  const label = stringProp(
    node.props,
    "label",
    stringProp(node.props, "title"),
  );
  return (
    <Collapse
      defaultActiveKey={node.props.collapsed === true ? [] : [node.id]}
      items={[{ key: node.id, label, children }]}
    />
  );
}

export function AntTextInput({
  node,
  value,
  onValueChange,
}: RendererComponentProps) {
  const control = (
    <Form.Item
      label={fieldLabel(node)}
      extra={stringProp(node.props, "description") || undefined}
    >
      <Input
        aria-label={fieldLabel(node)}
        readOnly={node.props.readOnly === true}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      />
    </Form.Item>
  );
  return node.props.collapsed === true ? (
    <Collapse
      items={[{ key: node.id, label: fieldLabel(node), children: control }]}
    />
  ) : (
    control
  );
}

export function AntNumberInput({
  node,
  value,
  onValueChange,
}: RendererComponentProps) {
  return (
    <Form.Item
      label={fieldLabel(node)}
      extra={stringProp(node.props, "description") || undefined}
    >
      <InputNumber
        aria-label={fieldLabel(node)}
        readOnly={node.props.readOnly === true}
        style={{ width: "100%" }}
        {...(typeof value === "number" ? { value } : {})}
        {...(numberProp(node.props, "minimum") === undefined
          ? {}
          : { min: numberProp(node.props, "minimum") as number })}
        {...(numberProp(node.props, "maximum") === undefined
          ? {}
          : { max: numberProp(node.props, "maximum") as number })}
        {...(numberProp(node.props, "step") === undefined
          ? {}
          : { step: numberProp(node.props, "step") as number })}
        onChange={(next) => onValueChange(next ?? null)}
      />
    </Form.Item>
  );
}

export function AntCheckbox({
  node,
  value,
  onValueChange,
}: RendererComponentProps) {
  return (
    <Checkbox
      checked={value === true}
      disabled={node.props.readOnly === true}
      onChange={(event) => onValueChange(event.target.checked)}
    >
      {fieldLabel(node)}
    </Checkbox>
  );
}

export function AntChoiceField({
  node,
  value,
  onValueChange,
  onAction,
}: RendererComponentProps) {
  const multiple = node.props.multiple === true;
  const options = optionsFor(node).map((option, index) => ({
    label: labelForItem(option, index),
    value: valueForItem(option, index),
  }));
  return (
    <Form.Item
      label={fieldLabel(node)}
      extra={stringProp(node.props, "description") || undefined}
    >
      <Select
        aria-label={fieldLabel(node)}
        disabled={node.props.readOnly === true}
        style={{ width: "100%" }}
        {...(multiple ? { mode: "multiple" as const } : {})}
        value={
          multiple
            ? Array.isArray(value)
              ? value.filter(
                  (item): item is string | number =>
                    typeof item === "string" || typeof item === "number",
                )
              : []
            : typeof value === "string" || typeof value === "number"
              ? value
              : undefined
        }
        options={options}
        onChange={(next) => {
          const nextValue: JsonValue = next ?? (multiple ? [] : null);
          onValueChange(nextValue);
          onAction("select", { value: nextValue });
        }}
      />
    </Form.Item>
  );
}

export function AntForm({ node, children, onAction }: RendererComponentProps) {
  const invocationId = stringProp(node.props, "invocationId");
  return (
    <Form
      layout="vertical"
      disabled={node.props.submitting === true}
      onFinish={() =>
        onAction(
          stringProp(node.props, "submitAction", "submit"),
          invocationId === "" ? null : { invocationId },
        )
      }
    >
      <Typography.Title level={3}>
        {stringProp(node.props, "title")}
      </Typography.Title>
      {children}
      <Button
        type="primary"
        htmlType="submit"
        loading={node.props.submitting === true}
      >
        {stringProp(node.props, "submitLabel", "Submit")}
      </Button>
    </Form>
  );
}

export function AntCard({
  node,
  value,
  onValueChange,
  onAction,
}: RendererComponentProps) {
  const items = optionsFor(node);
  const multiple = node.props.multiple === true;
  const selected = new Set(
    Array.isArray(value) ? value.map(String) : [String(value ?? "")],
  );
  return (
    <section aria-label={stringProp(node.props, "title", "Items")}>
      <Typography.Title level={4}>
        {stringProp(node.props, "title")}
      </Typography.Title>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        {items.map((item, index) => {
          const itemValue = valueForItem(item, index);
          const key = String(itemValue);
          return (
            <Card size="small" key={key}>
              <Space orientation="vertical">
                <Typography.Text>{labelForItem(item, index)}</Typography.Text>
                <Button
                  type={selected.has(key) ? "primary" : "default"}
                  aria-pressed={selected.has(key)}
                  onClick={() => {
                    const next: JsonValue = multiple
                      ? selected.has(key)
                        ? [...selected].filter((entry) => entry !== key)
                        : [...selected, key]
                      : itemValue;
                    onValueChange(next);
                    onAction("select", { value: next });
                  }}
                >
                  {selected.has(key) ? "Selected" : "Select"}
                </Button>
              </Space>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function objectItem(item: JsonValue): Record<string, JsonValue> | undefined {
  return typeof item === "object" && item !== null && !Array.isArray(item)
    ? item
    : undefined;
}

export function AntDataTable({ node }: RendererComponentProps) {
  const items = Array.isArray(node.props.items) ? node.props.items : [];
  const rows = items.map((item, index) => ({
    key: String(objectItem(item)?.id ?? index),
    ...(objectItem(item) ?? { value: item }),
  }));
  const declaredColumns = Array.isArray(node.props.columns)
    ? node.props.columns.filter(
        (column): column is string => typeof column === "string",
      )
    : [];
  const columnNames =
    declaredColumns.length > 0
      ? declaredColumns
      : [...new Set(rows.flatMap((row) => Object.keys(row)))].filter(
          (key) => key !== "key",
        );
  const columns: TableColumnsType<Record<string, JsonValue>> = columnNames.map(
    (column) => ({
      title: column,
      dataIndex: column,
      key: column,
      render: (cell: JsonValue) => String(cell ?? ""),
    }),
  );
  return (
    <Table
      aria-label={stringProp(node.props, "title", "Data")}
      pagination={false}
      columns={columns}
      dataSource={rows}
    />
  );
}

export function AntAction({ node, onAction }: RendererComponentProps) {
  const invocationId = stringProp(node.props, "invocationId");
  return (
    <Button
      type="primary"
      disabled={node.props.disabled === true}
      onClick={() =>
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

export function AntDialog({ node, onAction }: RendererComponentProps) {
  const invocationId = stringProp(node.props, "invocationId");
  return (
    <Modal
      open
      title={stringProp(node.props, "title", "Confirm")}
      closable={false}
      maskClosable={false}
      onOk={() =>
        onAction(
          stringProp(node.props, "confirmAction", "confirm"),
          invocationId === "" ? null : { invocationId, confirmed: true },
        )
      }
      onCancel={() =>
        onAction(
          stringProp(node.props, "cancelAction", "cancel"),
          invocationId === "" ? null : { invocationId },
        )
      }
      okText={stringProp(node.props, "confirmLabel", "Confirm")}
      cancelText={stringProp(node.props, "cancelLabel", "Cancel")}
    >
      <p>{stringProp(node.props, "message")}</p>
    </Modal>
  );
}

export function AntEmptyState({ node }: RendererComponentProps) {
  return <Empty description={stringProp(node.props, "message", "No data")} />;
}

export function AntErrorState({ node }: RendererComponentProps) {
  return (
    <Alert
      type="error"
      showIcon
      message={stringProp(node.props, "message", "Unable to render")}
    />
  );
}

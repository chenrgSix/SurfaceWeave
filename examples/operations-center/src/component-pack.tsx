import { createContext, useContext, useId } from "react";
import {
  standardComponentManifests,
  type JsonObject,
} from "@surfaceweave/core";
import {
  createStandardReactComponentRegistry,
  safeLayoutStyle,
  type ReactComponentPack,
  type RendererComponentProps,
} from "@surfaceweave/react";

import type { OperationsDemo } from "./demo-runtime.js";
import { Icon } from "./icons.js";
import { routeComparisonManifest, routes } from "./scenario.js";

export const ConfirmationData = createContext<JsonObject>({});

function InputField({
  node,
  value,
  onValueChange,
  interactionDisabled,
}: RendererComponentProps) {
  const id = useId();
  const props = {
    id,
    value: String(value ?? ""),
    disabled: interactionDisabled === true,
    readOnly: node.props.readOnly === true,
    required: node.props.required === true,
    maxLength:
      typeof node.props.maxLength === "number"
        ? node.props.maxLength
        : undefined,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onValueChange(event.target.value),
  };
  return (
    <div className="sw-field">
      <label htmlFor={id}>{String(node.props.label ?? "输入")}</label>
      {node.binding?.path === "note" ? (
        <textarea {...props} rows={3} />
      ) : (
        <input {...props} />
      )}
    </div>
  );
}

function Choice({
  node,
  value,
  onValueChange,
  interactionDisabled,
}: RendererComponentProps) {
  const id = useId();
  return (
    <div className="sw-field">
      <label htmlFor={id}>{String(node.props.label ?? "运输方案")}</label>
      <select
        id={id}
        value={String(value ?? "")}
        disabled={interactionDisabled === true}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {routes.map((route) => (
          <option key={route.id} value={route.id}>
            {route.name} · {route.hours}h · {route.cost}
          </option>
        ))}
      </select>
    </div>
  );
}

function Approval({
  node,
  value,
  onValueChange,
  interactionDisabled,
}: RendererComponentProps) {
  return (
    <label className={`approval ${value === true ? "checked" : ""}`}>
      <input
        type="checkbox"
        checked={value === true}
        disabled={interactionDisabled === true}
        onChange={(event) => onValueChange(event.target.checked)}
      />
      <span>
        <strong>{String(node.props.label)}</strong>
        <small>
          <Icon name="shield" size={13} /> 宿主强制约束 · Agent 无权隐藏
        </small>
      </span>
    </label>
  );
}

function Comparison({
  value,
  onValueChange,
  mode,
  interactionDisabled,
}: RendererComponentProps) {
  const group = useId();
  return (
    <fieldset className={`route-comparison ${mode}`}>
      <legend>
        恢复方案对比 <span>业务语义组件</span>
      </legend>
      <div className="route-options">
        {routes.map((route) => (
          <label
            key={route.id}
            className={`route-option ${value === route.id ? "selected" : ""}`}
          >
            <input
              type="radio"
              name={group}
              value={route.id}
              checked={value === route.id}
              disabled={interactionDisabled === true}
              onChange={() => onValueChange(route.id)}
            />
            <div className="route-option-head">
              <Icon
                name={
                  route.id === "air"
                    ? "plane"
                    : route.id === "relay"
                      ? "box"
                      : "clock"
                }
              />
              <span>{route.tag}</span>
              <i>
                {value === route.id ? <Icon name="check" size={12} /> : null}
              </i>
            </div>
            <strong>{route.name}</strong>
            <div className="route-time">
              {route.hours}
              <small>小时恢复</small>
            </div>
            <p>{route.coverage}</p>
            <div className="route-cost">
              {route.cost}
              <small>增量费用</small>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Form({
  node,
  children,
  mode,
  onAction,
  interactionDisabled,
  actionStates,
}: RendererComponentProps) {
  const pending =
    node.props.submitting === true ||
    actionStates?.some((state) => state.status === "pending");
  return (
    <form
      className={`recovery-form ${mode}`}
      onSubmit={(event) => {
        event.preventDefault();
        onAction("tool.submit", {
          invocationId: String(node.props.invocationId),
        });
      }}
    >
      <fieldset disabled={pending || interactionDisabled === true}>
        <div
          style={safeLayoutStyle(
            { direction: "column", gap: 16, ...node.layout },
            mode,
          )}
        >
          {children}
        </div>
        <button
          className="button primary submit-plan"
          type="submit"
          disabled={pending || interactionDisabled === true}
        >
          <Icon name={pending ? "clock" : "shield"} />
          {pending ? "模拟宿主处理中…" : "核对并提交计划"}
          <Icon name="arrow" size={16} />
        </button>
        <p className="form-footnote">
          提交先生成确认快照，不会直接执行业务操作
        </p>
      </fieldset>
    </form>
  );
}

function Section({ node, children, mode }: RendererComponentProps) {
  return (
    <section className="decision-section">
      <h3>
        <Icon name="shield" size={15} />
        {String(node.props.title ?? node.props.label ?? "执行前核对")}
      </h3>
      <div
        style={safeLayoutStyle(
          { direction: "column", gap: 12, ...node.layout },
          mode,
        )}
      >
        {children}
      </div>
    </section>
  );
}

function Confirm({
  node,
  onAction,
  interactionDisabled,
}: RendererComponentProps) {
  const data = useContext(ConfirmationData);
  const route = routes.find((route) => route.id === data.route);
  return (
    <section className="confirmation-content">
      <div className="confirmation-symbol">
        <Icon name="shield" size={26} />
      </div>
      <p className="eyebrow">HUMAN IN THE LOOP</p>
      <h2>最后一步，由你确认。</h2>
      <p className="muted">
        Agent 准备了计划。只有你确认这份快照，模拟宿主才会接到执行请求。
      </p>
      <dl className="confirmation-summary">
        <div>
          <dt>恢复方案</dt>
          <dd>{route?.name ?? String(data.route)}</dd>
        </div>
        <div>
          <dt>预计恢复 / 增量费用</dt>
          <dd>
            {route?.hours}h / {route?.cost}
          </dd>
        </div>
        <div>
          <dt>执行负责人</dt>
          <dd>{String(data.owner ?? "")}</dd>
        </div>
        <div>
          <dt>人工审批</dt>
          <dd>{data.approval === true ? "已核对" : "未核对"}</dd>
        </div>
        <div>
          <dt>交接备注</dt>
          <dd>{String(data.note ?? "")}</dd>
        </div>
      </dl>
      <p className="snapshot-hint">
        <Icon name="link" size={15} />{" "}
        绑定当前输入快照；返回修改后必须重新确认。
      </p>
      <div className="confirmation-buttons">
        <button
          className="button secondary"
          disabled={interactionDisabled === true}
          onClick={() =>
            onAction("tool.edit", {
              invocationId: String(node.props.invocationId),
            })
          }
        >
          返回修改
        </button>
        <button
          className="button primary"
          disabled={interactionDisabled === true}
          onClick={() =>
            onAction("tool.submit", {
              invocationId: String(node.props.invocationId),
              confirmed: true,
            })
          }
        >
          确认执行 · 模拟 <Icon name="arrow" size={16} />
        </button>
      </div>
    </section>
  );
}

const bindings = {
  Form,
  TextInput: InputField,
  ChoiceField: Choice,
  Checkbox: Approval,
  Section,
  Dialog: Confirm,
  RouteComparison: Comparison,
};
const pack: ReactComponentPack = {
  manifest: {
    protocolVersion: "1.0",
    id: "operations",
    version: "1.0.0",
    rendererKind: "react",
    priority: 40,
    components: [
      ...standardComponentManifests.filter((manifest) =>
        Object.hasOwn(bindings, manifest.semanticType),
      ),
      routeComparisonManifest,
    ],
  },
  bindings,
};
export function createDemoReactRegistry(demo: OperationsDemo) {
  const registry = createStandardReactComponentRegistry(demo.components);
  registry.registerPack(pack);
  return registry;
}

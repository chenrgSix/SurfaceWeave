import type { ActionIntent, JsonValue, UINode } from "@package-first/core";
import type { ComponentType, ReactNode } from "react";

export type RendererMode = "compact" | "workspace";

export interface RendererComponentProps {
  node: UINode;
  value: unknown;
  mode: RendererMode;
  children?: ReactNode;
  onValueChange(value: unknown): void;
  onAction(action: string, input: JsonValue): void;
}

export type ReactRendererComponent = ComponentType<RendererComponentProps>;

export type ActionIntentHandler = (intent: ActionIntent) => void;

import type {
  ActionIntent,
  ComponentPackManifest,
  ComponentResolution,
  JsonValue,
  SurfaceViewMode,
  UINode,
} from "@surfaceweave/core";
import type { ComponentType, ReactNode } from "react";

/** React compatibility name for the framework-neutral SurfaceViewMode. */
export type RendererMode = SurfaceViewMode;

export interface RendererComponentProps {
  node: UINode;
  value: JsonValue | undefined;
  mode: RendererMode;
  children?: ReactNode;
  onValueChange(value: JsonValue): void;
  onAction(action: string, input: JsonValue): void;
}

export type ReactRendererComponent = ComponentType<RendererComponentProps>;

export interface ReactPackProviderProps {
  children?: ReactNode;
}

/** Runtime-only React binding. It is deliberately separate from the manifest. */
export interface ReactComponentPack {
  manifest: ComponentPackManifest;
  bindings: Record<string, ReactRendererComponent>;
  Provider?: ComponentType<ReactPackProviderProps>;
}

export interface ReactComponentResolution {
  component: ReactRendererComponent;
  Provider?: ComponentType<ReactPackProviderProps>;
  resolution: ComponentResolution;
}

export type ActionIntentHandler = (intent: ActionIntent) => void;

import { cloneValue } from "@package-first/core";

export type TauriPlatform =
  "windows" | "macos" | "linux" | "android" | "ios" | "unknown";

export interface TauriTerminalCapabilities {
  platform: TauriPlatform;
  desktop: boolean;
  filePicker: boolean;
  notifications: boolean;
  localStorage: boolean;
  nativeCommands: boolean;
}

/**
 * Describes rendering capabilities only. It does not grant Tauri permissions,
 * authorize actions, or reveal Rust command names.
 */
export class TauriCapabilityProvider {
  readonly #capabilities: TauriTerminalCapabilities;

  constructor(capabilities: TauriTerminalCapabilities) {
    this.#capabilities = cloneValue(capabilities);
  }

  getCapabilities(): TauriTerminalCapabilities {
    return cloneValue(this.#capabilities);
  }
}

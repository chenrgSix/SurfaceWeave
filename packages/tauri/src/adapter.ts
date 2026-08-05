import { TauriActionExecutor } from "./action-executor.js";
import type { TauriInvoke } from "./action-executor.js";
import {
  TauriCapabilityProvider,
  type TauriTerminalCapabilities,
} from "./capabilities.js";
import {
  TauriPreferenceStorage,
  type TauriPreferenceStorageOptions,
} from "./preference-storage.js";

export interface CreateTauriDynamicUIAdapterOptions extends TauriPreferenceStorageOptions {
  capabilities: TauriTerminalCapabilities;
  invoke?: TauriInvoke;
}

export interface TauriDynamicUIAdapter {
  actionExecutor: TauriActionExecutor;
  preferenceStorage: TauriPreferenceStorage;
  capabilityProvider: TauriCapabilityProvider;
}

/** Creates isolated Tauri host adapters without changing the core Runtime. */
export function createTauriDynamicUIAdapter(
  options: CreateTauriDynamicUIAdapterOptions,
): TauriDynamicUIAdapter {
  return {
    actionExecutor: new TauriActionExecutor(options.invoke),
    preferenceStorage: new TauriPreferenceStorage(options),
    capabilityProvider: new TauriCapabilityProvider(options.capabilities),
  };
}

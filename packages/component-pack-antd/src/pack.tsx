import type { ReactComponentPack } from "@package-first/renderer-react";
import { ConfigProvider } from "antd";
import type { ConfigProviderProps } from "antd";

import {
  AntAccordion,
  AntAction,
  AntBadge,
  AntCard,
  AntCheckbox,
  AntChoiceField,
  AntDataTable,
  AntDialog,
  AntEmptyState,
  AntErrorState,
  AntForm,
  AntGrid,
  AntImage,
  AntNumberInput,
  AntStack,
  AntText,
  AntTextInput,
} from "./components.js";
import { antDesignComponentPackManifest } from "./manifest.js";

export interface AntDesignComponentPackOptions {
  theme?: ConfigProviderProps["theme"];
  locale?: ConfigProviderProps["locale"];
}

/** Creates local React bindings while keeping the exported manifest data-only. */
export function createAntDesignComponentPack(
  options: AntDesignComponentPackOptions = {},
): ReactComponentPack {
  return {
    manifest: antDesignComponentPackManifest,
    Provider: ({ children }) => (
      <ConfigProvider
        {...(options.theme === undefined ? {} : { theme: options.theme })}
        {...(options.locale === undefined ? {} : { locale: options.locale })}
      >
        {children}
      </ConfigProvider>
    ),
    bindings: {
      Text: AntText,
      Image: AntImage,
      Badge: AntBadge,
      Stack: AntStack,
      Grid: AntGrid,
      Accordion: AntAccordion,
      Form: AntForm,
      TextInput: AntTextInput,
      NumberInput: AntNumberInput,
      ChoiceField: AntChoiceField,
      Checkbox: AntCheckbox,
      DataTable: AntDataTable,
      Card: AntCard,
      Action: AntAction,
      Dialog: AntDialog,
      EmptyState: AntEmptyState,
      ErrorState: AntErrorState,
    },
  };
}

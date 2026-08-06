import type { ReactComponentPack } from "@surfaceweave/react";
import { I18nProvider } from "react-aria-components";

import {
  AriaAccordion,
  AriaAction,
  AriaBadge,
  AriaCard,
  AriaCheckbox,
  AriaChoiceField,
  AriaDataTable,
  AriaDialog,
  AriaEmptyState,
  AriaErrorState,
  AriaForm,
  AriaGrid,
  AriaImage,
  AriaNumberInput,
  AriaStack,
  AriaText,
  AriaTextInput,
} from "./components.js";
import { reactAriaComponentPackManifest } from "./manifest.js";

export interface ReactAriaComponentPackOptions {
  locale?: string;
}

/** Creates local React bindings while keeping the exported manifest data-only. */
export function createReactAriaComponentPack(
  options: ReactAriaComponentPackOptions = {},
): ReactComponentPack {
  const locale = options.locale ?? "en-US";
  return {
    manifest: reactAriaComponentPackManifest,
    Provider: ({ children }) => (
      <I18nProvider locale={locale}>{children}</I18nProvider>
    ),
    bindings: {
      Text: AriaText,
      Image: AriaImage,
      Badge: AriaBadge,
      Stack: AriaStack,
      Grid: AriaGrid,
      Accordion: AriaAccordion,
      Form: AriaForm,
      TextInput: AriaTextInput,
      NumberInput: AriaNumberInput,
      ChoiceField: AriaChoiceField,
      Checkbox: AriaCheckbox,
      DataTable: AriaDataTable,
      Card: AriaCard,
      Action: AriaAction,
      Dialog: AriaDialog,
      EmptyState: AriaEmptyState,
      ErrorState: AriaErrorState,
    },
  };
}

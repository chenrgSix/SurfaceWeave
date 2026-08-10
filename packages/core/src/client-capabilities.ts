import { cloneValue } from "./data.js";
import type {
  ComponentDefinition,
  ComponentPackManifest,
  ComponentRegistry,
  SurfaceResourcePolicy,
} from "./types.js";

export type SurfaceRuntimeCapability =
  "operations" | "preferences" | "tool-invocation" | "action-state";

export interface SurfaceResourcePolicySummary {
  enabled: boolean;
  limits?: Partial<SurfaceResourcePolicy>;
}

/** Serializable view of the semantic catalog actually available to a host. */
export interface SurfaceComponentCatalog {
  protocolVersion: "1.0";
  rendererKind: string;
  terminalCapabilities: string[];
  acceptedPackVersions: Record<string, string[]>;
  components: ComponentDefinition[];
  packs: ComponentPackManifest[];
}

/** JSON-only client capability handshake generated from trusted host policy. */
export interface SurfaceClientCapabilities {
  wireProtocolVersion: "1.0";
  rendererKind: string;
  terminalCapabilities: string[];
  runtimeCapabilities: SurfaceRuntimeCapability[];
  acceptedPackVersions: Record<string, string[]>;
  components: ComponentDefinition[];
  packs: ComponentPackManifest[];
  resourcePolicy: SurfaceResourcePolicySummary;
}

export interface CreateSurfaceClientCapabilitiesOptions {
  rendererKind: string;
  enabledPackIds: readonly string[];
  terminalCapabilities?: readonly string[];
  supportedPackVersions?: Readonly<Record<string, readonly string[]>>;
  runtimeCapabilities?: readonly SurfaceRuntimeCapability[];
  resourcePolicy?: SurfaceResourcePolicySummary;
}

export interface SurfaceComponentCatalogQuery {
  rendererKind?: string;
  terminalCapabilities?: readonly string[];
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function supportsCapabilities(
  required: readonly string[] | undefined,
  available: ReadonlySet<string>,
): boolean {
  return (required ?? []).every((capability) => available.has(capability));
}

function acceptedVersions(
  pack: ComponentPackManifest,
  constraints: Readonly<Record<string, readonly string[]>> | undefined,
): string[] {
  const configured = constraints?.[pack.id];
  return sortedUnique(configured ?? [pack.version]);
}

/**
 * Projects the local Registry through trusted renderer policy. The result is
 * data-only and cannot make a locally unavailable binding executable.
 */
export function createSurfaceComponentCatalog(
  registry: ComponentRegistry,
  options: CreateSurfaceClientCapabilitiesOptions,
): SurfaceComponentCatalog {
  const enabled = new Set(options.enabledPackIds);
  const terminal = new Set(options.terminalCapabilities ?? []);
  const packs = registry
    .listPacks()
    .filter(
      (pack) =>
        pack.rendererKind === options.rendererKind &&
        enabled.has(pack.id) &&
        acceptedVersions(pack, options.supportedPackVersions).includes(
          pack.version,
        ) &&
        supportsCapabilities(pack.capabilities, terminal),
    )
    .map((pack) => ({
      ...pack,
      components: pack.components.filter((component) =>
        supportsCapabilities(component.capabilities, terminal),
      ),
    }))
    .filter((pack) => pack.components.length > 0)
    .sort(
      (left, right) =>
        left.id.localeCompare(right.id) ||
        left.version.localeCompare(right.version),
    );
  const semanticTypes = new Set(
    packs.flatMap((pack) =>
      pack.components.map((component) => component.semanticType),
    ),
  );
  const acceptedPackVersions = Object.fromEntries(
    packs.map((pack) => [
      pack.id,
      acceptedVersions(pack, options.supportedPackVersions),
    ]),
  );

  return cloneValue({
    protocolVersion: "1.0",
    rendererKind: options.rendererKind,
    terminalCapabilities: sortedUnique(options.terminalCapabilities ?? []),
    acceptedPackVersions,
    components: registry
      .list()
      .filter((component) => semanticTypes.has(component.type)),
    packs,
  });
}

/** Creates a deterministic capability handshake without performing transport. */
export function createSurfaceClientCapabilities(
  registry: ComponentRegistry,
  options: CreateSurfaceClientCapabilitiesOptions,
): SurfaceClientCapabilities {
  const catalog = createSurfaceComponentCatalog(registry, options);
  return cloneValue({
    wireProtocolVersion: "1.0",
    rendererKind: catalog.rendererKind,
    terminalCapabilities: catalog.terminalCapabilities,
    runtimeCapabilities: sortedUnique(
      options.runtimeCapabilities ?? [],
    ) as SurfaceRuntimeCapability[],
    acceptedPackVersions: catalog.acceptedPackVersions,
    components: catalog.components,
    packs: catalog.packs,
    resourcePolicy: options.resourcePolicy ?? { enabled: false },
  });
}

/**
 * Applies an Agent-facing query to an existing host snapshot. Queries may only
 * remove capabilities and Packs; they can never widen the trusted snapshot.
 */
export function inspectSurfaceComponentCatalog(
  capabilities: SurfaceClientCapabilities,
  query: SurfaceComponentCatalogQuery = {},
): SurfaceComponentCatalog {
  if (
    query.rendererKind !== undefined &&
    query.rendererKind !== capabilities.rendererKind
  ) {
    return {
      protocolVersion: "1.0",
      rendererKind: capabilities.rendererKind,
      terminalCapabilities: [],
      acceptedPackVersions: {},
      components: [],
      packs: [],
    };
  }
  const requested =
    query.terminalCapabilities === undefined
      ? new Set(capabilities.terminalCapabilities)
      : new Set(
          query.terminalCapabilities.filter((capability) =>
            capabilities.terminalCapabilities.includes(capability),
          ),
        );
  const packs = capabilities.packs
    .filter((pack) => supportsCapabilities(pack.capabilities, requested))
    .map((pack) => ({
      ...pack,
      components: pack.components.filter((component) =>
        supportsCapabilities(component.capabilities, requested),
      ),
    }))
    .filter((pack) => pack.components.length > 0);
  const semanticTypes = new Set(
    packs.flatMap((pack) =>
      pack.components.map((component) => component.semanticType),
    ),
  );
  return cloneValue({
    protocolVersion: "1.0",
    rendererKind: capabilities.rendererKind,
    terminalCapabilities: sortedUnique([...requested]),
    acceptedPackVersions: Object.fromEntries(
      packs.map((pack) => [
        pack.id,
        capabilities.acceptedPackVersions[pack.id] ?? [pack.version],
      ]),
    ),
    components: capabilities.components.filter((component) =>
      semanticTypes.has(component.type),
    ),
    packs,
  });
}

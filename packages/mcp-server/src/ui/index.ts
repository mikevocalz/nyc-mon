import { readFileSync } from 'node:fs';
import { registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import type { McpAppsRegistration } from '../mcp/ui-seam.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_VIEWS, type UiViewId } from './views.ts';

/**
 * MCP Apps resources for the Alexa+ add-on (SEP-1865, stable 2026-01-26).
 * Lane A registers each entry with `registerAppResource` from
 * `@modelcontextprotocol/ext-apps/server` and puts `_meta.ui.resourceUri` on
 * the tools in {@link UI_TOOL_LINKS}.
 *
 * The HTML comes from `pnpm --filter @acme/mcp-server build:ui`
 * (src/ui/build.ts → dist/ui). The URI carries the content hash, so a host
 * that caches the resource refetches only when the view changes.
 */

export const UI_MIME_TYPE = 'text/html;profile=mcp-app' as const;

/**
 * `_meta.ui.csp`. Everything is inline and nothing is fetched. `data:` is
 * declared in `resourceDomains` for one reason: the kit's two brand fonts are
 * inlined as data: URIs, and the MCP Apps default CSP has no `font-src` entry
 * for them (SEP-1865: `font-src 'self' <resourceDomains>`). Without it the
 * fonts fall back to Arial Black and the system sans; nothing else changes.
 */
export interface UiCsp {
  readonly connectDomains: readonly string[];
  readonly resourceDomains: readonly string[];
}

export interface UiResource {
  readonly id: UiViewId;
  readonly uri: `ui://nyc-mon/${string}.html`;
  readonly name: string;
  readonly description: string;
  readonly mimeType: typeof UI_MIME_TYPE;
  readonly html: string;
  readonly csp: UiCsp;
  /** Goes in the resource's `_meta.ui` next to `csp`. */
  readonly prefersBorder: false;
}

export const UI_CSP: UiCsp = { connectDomains: [], resourceDomains: ['data:'] };

/**
 * Which view each tool opens. Tools not listed return data only, and Alexa
 * renders them natively or by voice (hydrated / voice-only modes).
 * `check_on_mon` is left out on purpose: its result has no `care`, so the
 * card would open without meters. Add it here if it starts returning `care`.
 * `mon-room` has no tool of its own yet: any tool that returns `journal`
 * entries next to `mon` and `care` should link it. Until one exists, the card's
 * own expand control is the way into fullscreen.
 */
export const UI_TOOL_LINKS = {
  get_mon_status: 'mon-card',
  feed_mon: 'mon-card',
  rest_mon: 'mon-card',
  wake_mon: 'mon-card',
  play_with_mon: 'mon-card',
} as const satisfies Partial<Record<string, UiViewId>>;

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'ui');

/** dist/ui/manifest.json as build.ts writes it: one entry per view. */
const ManifestSchema = z.object(
  Object.fromEntries(
    (Object.keys(UI_VIEWS) as UiViewId[]).map((id) => [
      id,
      z.object({ file: z.string().regex(/^[a-z-]+\.html$/), hash: z.string().regex(/^[0-9a-f]{8}$/), bytes: z.number().int().positive() }),
    ]),
  ) as Record<UiViewId, z.ZodObject<{ file: z.ZodString; hash: z.ZodString; bytes: z.ZodNumber }>>,
);

/** Validates dist/ui/manifest.json; throws with the fix when it does not match this build. */
export function parseUiManifest(raw: unknown): z.infer<typeof ManifestSchema> {
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `dist/ui/manifest.json does not match this build (${z.prettifyError(parsed.error)}). Rebuild with \`pnpm --filter @acme/mcp-server build:ui\`.`,
    );
  }
  return parsed.data;
}

let cache: readonly UiResource[] | null = null;

/** Reads the built views once. Throws with the fix when the build has not run. */
export function getUiResources(): readonly UiResource[] {
  if (cache) return cache;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf8'));
  } catch {
    throw new Error('MCP App views are not built. Run `pnpm --filter @acme/mcp-server build:ui`.');
  }
  const manifest = parseUiManifest(raw);
  cache = (Object.keys(UI_VIEWS) as UiViewId[]).map((id) => {
    const entry = manifest[id];
    return {
      id,
      uri: `ui://nyc-mon/${id}-${entry.hash}.html` as const,
      name: UI_VIEWS[id].title,
      description: UI_VIEWS[id].description,
      mimeType: UI_MIME_TYPE,
      html: readFileSync(join(distDir, entry.file), 'utf8'),
      csp: UI_CSP,
      prefersBorder: false,
    };
  });
  return cache;
}

/** The versioned ui:// URI for a view, for a tool's `_meta.ui.resourceUri`. */
export function uiResourceUri(id: UiViewId): string {
  const found = getUiResources().find((r) => r.id === id);
  if (!found) throw new Error(`No UI resource "${id}"`);
  return found.uri;
}

/**
 * The value for `createHandler({ ui })` (src/mcp/ui-seam.ts). Registers both
 * views as MCP Apps resources and maps each linked tool to its view's URI.
 * Reads no Caller data, so a service token may list and read the resources.
 */
export function mcpAppsRegistration(): McpAppsRegistration {
  const resources = getUiResources();
  const byId = new Map(resources.map((r) => [r.id, r]));
  const toolResourceUris: Record<string, string> = {};
  for (const [tool, view] of Object.entries(UI_TOOL_LINKS)) {
    const resource = byId.get(view);
    if (resource) toolResourceUris[tool] = resource.uri;
  }
  return {
    registerResources: (server) => {
      for (const r of resources) {
        const ui = { csp: { connectDomains: [...r.csp.connectDomains], resourceDomains: [...r.csp.resourceDomains] }, prefersBorder: r.prefersBorder };
        registerAppResource(
          server,
          r.name,
          r.uri,
          { description: r.description, mimeType: r.mimeType, _meta: { ui } },
          async () => ({ contents: [{ uri: r.uri, mimeType: r.mimeType, text: r.html, _meta: { ui } }] }),
        );
      }
    },
    toolResourceUris,
  };
}

export { UI_VIEWS, type UiViewId } from './views.ts';
export { ACTION_TOOLS } from './actions.ts';
export { toMonViewModel, spokenSummary, type MonViewModel } from './contract.ts';

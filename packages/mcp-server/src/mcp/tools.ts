import { z } from 'zod';
import type { AuthContext } from '../auth/oauth.ts';
import { permitted, resolveActingVoice, type ResolvedActor, type SpeakerHint } from '../auth/actor.ts';
import type { CallerData } from '../data/caller.ts';
import type { PresenceService } from '../presence/service.ts';
import { toolError, permissionDenied } from './errors.ts';
import {
  AcknowledgePersonInput,
  CheckOnMonInput,
  FeedMonInput,
  HealMonInput,
  InjectPresenceEventInput,
  MonIdInput,
  PersonIdInput,
  PlayWithMonInput,
  TalkToMonInput,
} from './schemas.ts';

/**
 * Tool registry (ADR 0005). Definitions are data; `src/mcp/server.ts` maps them
 * onto `McpServer.registerTool`. Names are snake_case and stable — `alexa-ai`
 * generates the add-on manifest by introspection.
 *
 * Conventions:
 *  - Handlers return { structuredContent } — no canned dialogue (ADR 0009).
 *  - Mutating tools resolve ActingVoice first; a denied call returns
 *    PERMISSION_DENIED_NOT_CALLER and never reaches the data layer.
 *  - `speakerHint` travels on the call context (Voice ID for the direct
 *    speaker only — ADR 0007).
 */

export interface ToolResult {
  readonly isError?: boolean;
  readonly structuredContent: Record<string, unknown>;
  readonly content?: readonly { readonly type: 'text'; readonly text: string }[];
}

export interface ToolContext {
  readonly auth: AuthContext;
  readonly data: CallerData;
  readonly presence: PresenceService;
  readonly speakerHint?: SpeakerHint;
  /** Dev/demo flag from env — gates the inject_presence_event tool. */
  readonly devMode: boolean;
}

export interface ToolDef<Input> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Input;
  readonly annotations: {
    readonly title: string;
    readonly readOnlyHint: boolean;
    readonly destructiveHint: boolean;
    readonly idempotentHint?: boolean;
    readonly openWorldHint?: boolean;
  };
  /** Permission key for mutating tools; undefined = read. */
  readonly requiredPermission?: 'talk' | 'play' | 'feed' | 'care';
  readonly handler: (args: unknown, ctx: ToolContext) => Promise<ToolResult>;
}

/** Shared gate: resolve voice + enforce permission for mutating tools. */
async function gate(
  ctx: ToolContext,
  requiredPermission: 'talk' | 'play' | 'feed' | 'care' | undefined,
  monId?: string,
): Promise<{ actor: ResolvedActor; denied: ToolResult | null }> {
  const actor = await resolveActingVoice(ctx.data, ctx.auth.callerId, ctx.speakerHint);
  if (requiredPermission && !permitted(actor, requiredPermission)) {
    return { actor, denied: permissionDenied(actor.voice, [requiredPermission], monId) };
  }
  return { actor, denied: null };
}

function upstreamError(err: unknown): ToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return toolError({ code: 'UPSTREAM_UNAVAILABLE', message });
}

// ---------------------------------------------------------------- tools ---

export const tools: readonly ToolDef<z.ZodTypeAny>[] = [
  {
    name: 'talk_to_mon',
    description:
      'Presence-gated conversation turn with a Mon. Resolves the acting voice (Caller / familiar / unknown); a familiar without the talk grant — or an unknown voice — is refused before any state is read.',
    inputSchema: TalkToMonInput,
    annotations: { title: 'Talk to Mon', readOnlyHint: false, destructiveHint: false },
    requiredPermission: 'talk',
    handler: async (args, ctx) => {
      const parsed = TalkToMonInput.parse(args);
      const { actor, denied } = await gate(ctx, 'talk', parsed.monId);
      if (denied) return denied;
      try {
        const mon = await ctx.data.resolveActiveMon(ctx.auth.callerId, parsed.monId);
        if (!mon) return toolError({ code: 'MON_NOT_FOUND', message: 'No active Mon for this Caller.' });
        // TODO(dialogue): hand the utterance + Mon context to the personality
        // layer (AWS Builder mini-challenge: Bedrock/Strands). The skill + model
        // produce the spoken reply; this tool only supplies structured context.
        const present = ctx.presence.presentPeople(ctx.auth.callerId);
        const care = await ctx.data.getCareState(mon.monInstanceId);
        return {
          structuredContent: {
            mon,
            context: {
              pendingRequest: care?.pendingRequest ?? null,
              presentPeople: present.map((p) => p.personId),
            },
            actingVoice: actor.voice,
          },
        };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'check_on_mon',
    description:
      'How is the Mon right now — status plus who is currently detected in the room. The James-scene hook: presentPeople + confidence tiers tell the personality layer whether the Mon greets, hedges, or stays quiet.',
    inputSchema: CheckOnMonInput,
    annotations: { title: 'Check on Mon', readOnlyHint: true, destructiveHint: false },
    handler: async (args, ctx) => {
      const parsed = CheckOnMonInput.parse(args);
      try {
        const mon = await ctx.data.resolveActiveMon(ctx.auth.callerId, parsed.monId);
        if (!mon) return toolError({ code: 'MON_NOT_FOUND', message: 'No active Mon for this Caller.' });
        const care = await ctx.data.getCareState(mon.monInstanceId);
        const present = ctx.presence.presentPeople(ctx.auth.callerId);
        return { structuredContent: { mon, care, stage: mon.stage, presentPeople: present } };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'get_mon_status',
    description: 'Stage, care meters (energy / fullness / social), activity, last-fed and pending needs for a Mon. Read-only.',
    inputSchema: MonIdInput,
    annotations: { title: 'Mon status', readOnlyHint: true, destructiveHint: false },
    handler: async (args, ctx) => {
      const parsed = MonIdInput.parse(args);
      try {
        const mon = await ctx.data.resolveActiveMon(ctx.auth.callerId, parsed.monId);
        if (!mon) return toolError({ code: 'MON_NOT_FOUND', message: 'No active Mon for this Caller.' });
        const care = await ctx.data.getCareState(mon.monInstanceId);
        // TODO(mood): derive moodHint from meters + activity (canon has no
        // mood field — it is computed here for the personality layer only).
        return { structuredContent: { mon, care, stage: mon.stage } };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'feed_mon',
    description: 'Feed a Mon an inventory item. Caller-only unless a familiar holds the feed grant — this is the James refusal path (PERMISSION_DENIED_NOT_CALLER).',
    inputSchema: FeedMonInput,
    annotations: { title: 'Feed Mon', readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    requiredPermission: 'feed',
    handler: async (args, ctx) => {
      const parsed = FeedMonInput.parse(args);
      const { denied } = await gate(ctx, 'feed', parsed.monId);
      if (denied) return denied;
      try {
        const mon = await ctx.data.resolveActiveMon(ctx.auth.callerId, parsed.monId);
        if (!mon) return toolError({ code: 'MON_NOT_FOUND', message: 'No active Mon for this Caller.' });
        // TODO(inventory): resolve itemId → foodClassId + nutrition from the
        // Caller's inventory before applying the care action.
        const care = await ctx.data.applyCareAction(
          mon.monInstanceId,
          { kind: 'feed', itemId: parsed.itemId },
          `mcp-feed-${parsed.itemId}-${Date.now()}`,
        );
        return { structuredContent: { mon, care, applied: care != null } };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'play_with_mon',
    description: 'Play an activity with a Mon; quality scales Social and bond. Familiar voices need the play grant.',
    inputSchema: PlayWithMonInput,
    annotations: { title: 'Play with Mon', readOnlyHint: false, destructiveHint: false },
    requiredPermission: 'play',
    handler: async (args, ctx) => {
      const parsed = PlayWithMonInput.parse(args);
      const { denied } = await gate(ctx, 'play', parsed.monId);
      if (denied) return denied;
      try {
        const mon = await ctx.data.resolveActiveMon(ctx.auth.callerId, parsed.monId);
        if (!mon) return toolError({ code: 'MON_NOT_FOUND', message: 'No active Mon for this Caller.' });
        const care = await ctx.data.applyCareAction(
          mon.monInstanceId,
          { kind: 'play', quality: parsed.quality ?? 0.5 },
          `mcp-play-${Date.now()}`,
        );
        return { structuredContent: { mon, care, applied: care != null } };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'heal_mon',
    description:
      'Nurse Nay soothe flow. Canon has no HP/sickness (Law 8): this comforts a sluggish or neglected Mon, it never "cures". Caller/care-grant only.',
    inputSchema: HealMonInput,
    annotations: { title: 'Heal Mon (Nurse Nay)', readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    requiredPermission: 'care',
    handler: async (args, ctx) => {
      const parsed = HealMonInput.parse(args);
      const { denied } = await gate(ctx, 'care', parsed.monId);
      if (denied) return denied;
      try {
        const mon = await ctx.data.resolveActiveMon(ctx.auth.callerId, parsed.monId);
        if (!mon) return toolError({ code: 'MON_NOT_FOUND', message: 'No active Mon for this Caller.' });
        // TODO(canon): the soothe action's exact care delta is Nurse Nay's
        // flow — not yet specified in canon bibles; keep 'soothe' on the seam.
        const care = await ctx.data.applyCareAction(
          mon.monInstanceId,
          { kind: 'soothe' },
          `mcp-soothe-${Date.now()}`,
        );
        return { structuredContent: { mon, care, applied: care != null } };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'get_inventory',
    description: "The Caller's item inventory (food classes, rare items). Read-only.",
    inputSchema: MonIdInput,
    annotations: { title: 'Inventory', readOnlyHint: true, destructiveHint: false },
    handler: async (_args, ctx) => {
      try {
        const items = await ctx.data.listInventory(ctx.auth.callerId);
        return { structuredContent: { items } };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'check_incubation',
    description: "Whether the Caller's outstanding egg is still incubating and when it ends. Read-only.",
    inputSchema: z.object({}),
    annotations: { title: 'Check incubation', readOnlyHint: true, destructiveHint: false },
    handler: async (_args, ctx) => {
      try {
        const incubation = await ctx.data.getIncubation(ctx.auth.callerId);
        if (!incubation) return { structuredContent: { incubating: false } };
        const minutesRemaining = Math.max(0, (incubation.incubationEndsAt - Date.now()) / 60_000);
        return { structuredContent: { incubating: true, ...incubation, minutesRemaining } };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'get_familiar_people',
    description: "The Caller's enrolled familiar people (self-enrolled, revocable). Read-only.",
    inputSchema: z.object({}),
    annotations: { title: 'Familiar people', readOnlyHint: true, destructiveHint: false },
    handler: async (_args, ctx) => {
      try {
        const people = await ctx.data.listFamiliarPeople(ctx.auth.callerId);
        return { structuredContent: { people } };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'get_present_people',
    description: 'Familiar people detected in the room right now, with confidence tier. Read-only.',
    inputSchema: z.object({}),
    annotations: { title: 'Present people', readOnlyHint: true, destructiveHint: false },
    handler: async (_args, ctx) => {
      const present = ctx.presence.presentPeople(ctx.auth.callerId);
      const named = await Promise.all(
        present.map(async (p) => {
          const person = await ctx.data.getFamiliarPerson(ctx.auth.callerId, p.personId).catch(() => null);
          return { ...p, displayName: person?.displayName };
        }),
      );
      return { structuredContent: { people: named } };
    },
  },
  {
    name: 'get_person_relationship',
    description: 'Relationship, permissions and familiarity between the Caller’s Mon and one familiar person. Read-only.',
    inputSchema: PersonIdInput,
    annotations: { title: 'Person relationship', readOnlyHint: true, destructiveHint: false },
    handler: async (args, ctx) => {
      const parsed = PersonIdInput.parse(args);
      try {
        const person = await ctx.data.getFamiliarPerson(ctx.auth.callerId, parsed.personId);
        if (!person) return toolError({ code: 'MON_NOT_FOUND', message: 'No such familiar person.' });
        return {
          structuredContent: {
            person,
            relationship: person.relationship,
            permissions: person.permissions,
            // TODO(canon): bond-per-person familiarity model does not exist yet.
          },
        };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'get_shared_memories',
    description: 'Shared moments between the Mon and a familiar person. Read-only.',
    inputSchema: PersonIdInput,
    annotations: { title: 'Shared memories', readOnlyHint: true, destructiveHint: false },
    handler: async (args, ctx) => {
      const parsed = PersonIdInput.parse(args);
      try {
        // TODO(memories): a shared-memories store does not exist yet — design
        // target is per-(monInstanceId, personId) records appended by
        // acknowledge_person and notable care events.
        return { structuredContent: { personId: parsed.personId, memories: [] } };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'acknowledge_person',
    description: 'Record that the Mon recognised a present familiar person (greeted / hedged / ignored). Feeds the shared-memory log.',
    inputSchema: AcknowledgePersonInput,
    annotations: { title: 'Acknowledge person', readOnlyHint: false, destructiveHint: false },
    handler: async (args, ctx) => {
      const parsed = AcknowledgePersonInput.parse(args);
      try {
        const latest = ctx.presence.latestFor(ctx.auth.callerId, parsed.personId);
        if (!latest) {
          return toolError({
            code: 'PRESENCE_REQUIRED',
            message: 'No fresh presence event for this person; the Mon cannot acknowledge someone not detected.',
          });
        }
        // TODO(memories): append {personId, acknowledgedAs, ts} to the
        // shared-memories store once it exists.
        return { structuredContent: { acknowledged: true, personId: parsed.personId, at: Date.now() } };
      } catch (err) {
        return upstreamError(err);
      }
    },
  },
  {
    name: 'inject_presence_event',
    description:
      'DEV/SIMULATOR ONLY — publish a synthetic PresenceEvent into the presence service. This is the James-scene hook for the web simulator and demo rehearsal; it is refused outside dev mode.',
    inputSchema: InjectPresenceEventInput,
    annotations: { title: 'Inject presence (dev)', readOnlyHint: false, destructiveHint: true },
    handler: async (args, ctx) => {
      if (!ctx.devMode) {
        return toolError({ code: 'PERMISSION_DENIED_NOT_CALLER', message: 'inject_presence_event is dev-mode only.' });
      }
      const parsed = InjectPresenceEventInput.parse(args);
      const event = ctx.presence.ingest({ ...parsed, eventId: parsed.eventId ?? `evt-${Date.now()}` });
      if (!event) return toolError({ code: 'UPSTREAM_UNAVAILABLE', message: 'Malformed presence event.' });
      return { structuredContent: { event } };
    },
  },
];

export const toolNames = tools.map((t) => t.name);

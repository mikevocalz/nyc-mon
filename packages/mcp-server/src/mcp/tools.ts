import { randomUUID } from 'node:crypto';
import {
  advanceCare,
  createInitialCareState,
  applyCareAction,
  deriveMonMood,
  listUnmetNeeds,
  type CareAction,
  type CareNeed,
  type CareState,
  type MonInstance,
} from '@acme/core';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import type { z } from 'zod';
import { permitted, resolveActingVoice, type ActingVoice, type SpeakerHint } from '../auth/actor.ts';
import { isAdultByBirthYear } from '../auth/request-auth.ts';
import type { CallerData, MonWithCare } from '../data/caller.ts';
import { AdultRequiredError, EggNotReadyError, NotFoundError, WriteUnconfirmedError } from '../data/errors.ts';
import type { FamiliarDirectory } from '../presence/fixtures.ts';
import type { PresenceService } from '../presence/service.ts';
import type { Permission } from '../presence/types.ts';
import { failure, success } from './errors.ts';
import {
  AcknowledgeOutput,
  AcknowledgePersonInput,
  CARE_SUGGESTIONS,
  CareResultOutput,
  FamiliarPeopleOutput,
  HatchEggOutput,
  IncubationOutput,
  InjectPresenceEventInput,
  MonIdInput,
  MonStatusOutput,
  NoInput,
  PersonIdInput,
  PersonRelationshipOutput,
  SpeakerHintSchema,
  PresenceEventOutput,
  PresentPeopleOutput,
  SharedMemoriesOutput,
  careInput,
  checkOnMonOutput,
  hatchEggInput,
  playInput,
  talkToMonOutput,
} from './schemas.ts';
import type { McpAppsRegistration } from './ui-seam.ts';

/** Tools every build lists. Each maps to real `/v1` data (ADR 0015 §4). */
export const CORE_TOOL_NAMES = [
  'get_mon_status',
  'check_on_mon',
  'check_incubation',
  'hatch_egg',
  'talk_to_mon',
  'feed_mon',
  'rest_mon',
  'wake_mon',
  'play_with_mon',
] as const;

/** Tools registered only in dev and simulator mode, over seeded fictional fixtures (ADR 0015 §2). */
export const DEV_TOOL_NAMES = [
  'get_familiar_people',
  'get_present_people',
  'get_person_relationship',
  'get_shared_memories',
  'acknowledge_person',
  'inject_presence_event',
] as const;

export type ToolName = (typeof CORE_TOOL_NAMES)[number] | (typeof DEV_TOOL_NAMES)[number];

/** Everything a tool call can see. Built per HTTP request from the verified token. */
export interface ToolContext {
  /** The linked Caller; undefined only for a service token, which never reaches tools/call. */
  readonly callerId: string | undefined;
  /** From the token's `birth_year` claim, when the issuer sends one. */
  readonly birthYear: number | undefined;
  readonly data: CallerData;
  readonly presence: PresenceService;
  /** Present exactly when dev mode is on; its presence gates the dev tools. */
  readonly familiar: FamiliarDirectory | undefined;
  readonly now: () => number;
}

// ------------------------------------------------------------- helpers ---

type Linked = { readonly callerId: string };

/** The Caller id, or the failure to return. Refuses a token whose birth year says under 18. */
function linkedCaller(ctx: ToolContext): Linked | CallToolResult {
  if (ctx.callerId === undefined) return failure('not-linked');
  if (ctx.birthYear !== undefined && !isAdultByBirthYear(ctx.birthYear, ctx.now())) return failure('adults-only');
  return { callerId: ctx.callerId };
}

function isResult(value: unknown): value is CallToolResult {
  return typeof value === 'object' && value !== null && 'content' in value;
}

async function guarded(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AdultRequiredError) return failure('adults-only');
    if (error instanceof NotFoundError) return failure('mon-not-found');
    if (error instanceof WriteUnconfirmedError) return failure('not-confirmed');
    console.error('[mcp-server] tool failed:', error instanceof Error ? error.message : String(error));
    return failure('unavailable');
  }
}

/**
 * The Mon as tools report it. `gender` and `voice` are for a client that voices
 * the Mon itself (the web simulator); Alexa reads replies in its own voice
 * (PLATFORM-DOCS §2.8) and copy never uses a pronoun for a Mon (PS-005).
 */
function monView(mon: MonInstance) {
  return {
    monId: mon.monInstanceId,
    name: mon.nickname,
    speciesId: mon.speciesId,
    stage: mon.stage,
    bond: mon.bond,
    hatchedAt: mon.hatchedAt,
    gender: mon.gender,
    voice: mon.voiceLineageId === null ? null : { lineageId: mon.voiceLineageId, stage: mon.stage },
  };
}

function careView(care: CareState) {
  return {
    energy: care.energy,
    fullness: care.fullness,
    social: care.social,
    activity: care.activity.kind,
    sluggish: care.sluggishUntil !== null && care.sluggishUntil > care.updatedAt,
    wantsFood: care.pendingRequest !== null,
    lastFedAt: care.lastFedAt,
  };
}

/** Stored state advanced to now, so meters are current rather than as of the last write. */
function current(entry: MonWithCare, now: number): MonWithCare {
  return advanceCare({ mon: entry.mon, care: entry.care }, now).state;
}

/** Fallbacks already logged, so a stale or missing companion warns once per Caller, not per call. */
const loggedFallbacks = new Set<string>();
const MAX_LOGGED_FALLBACKS = 1_000;

function logFallbackOnce(callerId: string, activeMonInstanceId: string | null): void {
  const key = `${callerId}\u0000${activeMonInstanceId ?? ''}`;
  if (loggedFallbacks.has(key)) return;
  if (loggedFallbacks.size >= MAX_LOGGED_FALLBACKS) loggedFallbacks.clear();
  loggedFallbacks.add(key);
  const why = activeMonInstanceId === null ? 'no companion chosen' : `companion ${activeMonInstanceId} is not among the Caller's Mons`;
  console.warn(`[mcp-server] ${why}; answering for the most recently hatched Mon`);
}

/**
 * The Mon a tool acts on. A named `monId` wins. Otherwise the Caller's chosen
 * companion (`users.activeMonInstanceId`), so every surface answers for, and
 * speaks in the voice of, the same Mon the Caller picked. Only when no
 * companion is chosen, or it names a Mon the Caller no longer has, does the
 * most recently hatched Mon answer.
 */
async function resolveMon(ctx: ToolContext, callerId: string, monId: string | undefined): Promise<MonWithCare | CallToolResult> {
  const { mons, activeMonInstanceId } = await ctx.data.listMons(callerId);
  if (mons.length === 0) return failure('no-mon');
  const byId = (id: string) => mons.find((entry) => entry.mon.monInstanceId === id);
  if (monId !== undefined) {
    const found = byId(monId);
    return found === undefined ? failure('mon-not-found') : current(found, ctx.now());
  }
  const active = activeMonInstanceId === null ? undefined : byId(activeMonInstanceId);
  if (active !== undefined) return current(active, ctx.now());
  if (mons.length > 1) logFallbackOnce(callerId, activeMonInstanceId);
  const latest = [...mons].sort((a, b) => b.mon.hatchedAt - a.mon.hatchedAt)[0];
  return latest === undefined ? failure('no-mon') : current(latest, ctx.now());
}

/** "12 minutes", "1 minute": how a speaker says the time left on an egg. */
function timeLeft(incubationEndsAt: number, now: number): { minutesRemaining: number; timeLeft: string } {
  const minutesRemaining = Math.max(1, Math.ceil((incubationEndsAt - now) / 60_000));
  return { minutesRemaining, timeLeft: minutesRemaining === 1 ? '1 minute' : `${minutesRemaining} minutes` };
}

/**
 * hatch_egg: the Caller's own egg only (the Caller-only rule, a familiar or
 * unverified voice is refused before anything is read), never before its
 * incubation ends. Safe to retry: `/v1` returns the Mon an egg already minted.
 * The new Mon is returned explicitly, so the card shows it even while the
 * Caller's chosen companion (`activeMonInstanceId`) stays another Mon.
 */
async function runHatch(ctx: ToolContext, args: { eggId?: string; speakerHint?: SpeakerHint }): Promise<CallToolResult> {
  const linked = linkedCaller(ctx);
  if (isResult(linked)) return linked;
  const actor = actorFor(ctx, linked.callerId, args.speakerHint);
  if (actor.kind !== 'caller') return failure('not-permitted', { speaker: speakerView(actor) });

  return guarded(async () => {
    const now = ctx.now();
    const eggs = [...(await ctx.data.listIncubatingEggs(linked.callerId))].sort((a, b) => a.egg.incubationEndsAt - b.egg.incubationEndsAt);
    const listed = args.eggId === undefined ? eggs[0] : eggs.find((e) => e.egg.eggId === args.eggId);
    // A named egg that is no longer listed has hatched already (or is not the
    // Caller's): /v1 answers with its Mon, or 404, which reads as no egg.
    const eggId = listed?.egg.eggId ?? args.eggId;
    if (eggId === undefined) return failure('no-egg');
    if (listed !== undefined && listed.egg.incubationEndsAt > now) {
      return failure('egg-not-ready', { eggId, ...timeLeft(listed.egg.incubationEndsAt, now) });
    }
    let mon: MonInstance;
    try {
      mon = await ctx.data.hatchEgg(linked.callerId, eggId);
    } catch (error) {
      // The server's clock says not yet (ours ran a little ahead).
      if (error instanceof EggNotReadyError) {
        return failure('egg-not-ready', { eggId, ...timeLeft(listed?.egg.incubationEndsAt ?? now + 60_000, now) });
      }
      if (error instanceof NotFoundError) return failure('no-egg');
      throw error;
    }
    const { mons } = await ctx.data.listMons(linked.callerId);
    const stored = mons.find((entry) => entry.mon.monInstanceId === mon.monInstanceId);
    const state = current(stored ?? { mon, care: createInitialCareState(mon.monInstanceId, mon.hatchedAt) }, now);
    const alreadyHatched = listed === undefined;
    return success({
      hatched: true,
      alreadyHatched,
      hatching: !alreadyHatched,
      egg: { eggId, speciesId: listed?.egg.speciesId ?? 'dex-001' },
      mon: monView(state.mon),
      care: careView(state.care),
      mood: deriveMonMood(state.care),
    });
  });
}

function suggestedCare(state: MonWithCare, needs: readonly CareNeed[]): (typeof CARE_SUGGESTIONS)[number][] {
  if (state.care.activity.kind === 'asleep') return ['wait'];
  const sluggish = state.care.sluggishUntil !== null && state.care.sluggishUntil > state.care.updatedAt;
  const out: (typeof CARE_SUGGESTIONS)[number][] = [];
  if (!sluggish && (state.care.pendingRequest !== null || needs.includes('fullness'))) out.push('feed');
  if (needs.includes('energy')) out.push('rest');
  if (!sluggish && needs.includes('social')) out.push('play');
  return out.length === 0 ? ['wait'] : out;
}

function presentPeople(ctx: ToolContext, callerId: string) {
  const familiar = ctx.familiar;
  if (familiar === undefined) return [];
  return ctx.presence.presentPeople(callerId, ctx.now()).flatMap((p) => {
    const person = familiar.getPerson(callerId, p.personId);
    return person === undefined
      ? []
      : [{ personId: p.personId, displayName: person.displayName, tier: p.tier, confidence: p.confidence }];
  });
}

function speakerView(actor: ActingVoice) {
  if (actor.kind === 'caller') return { kind: 'caller' as const };
  if (actor.kind === 'unverified') return { kind: 'unverified' as const, personId: actor.personId };
  return { kind: 'familiar' as const, personId: actor.person.personId, displayName: actor.person.displayName };
}

function actorFor(ctx: ToolContext, callerId: string, hint: SpeakerHint | undefined): ActingVoice {
  return resolveActingVoice({ familiar: ctx.familiar, presence: ctx.presence }, callerId, hint, ctx.now());
}

interface CareToolSpec {
  readonly permission: keyof Permission;
  readonly action: (args: { quality?: number }) => CareAction;
}

/** Shared flow for the four canon care actions. A predicted decline writes nothing. */
async function runCare(
  ctx: ToolContext,
  spec: CareToolSpec,
  args: { monId?: string; quality?: number; speakerHint?: SpeakerHint; intentId?: string },
): Promise<CallToolResult> {
  const linked = linkedCaller(ctx);
  if (isResult(linked)) return linked;
  const actor = actorFor(ctx, linked.callerId, args.speakerHint);
  if (!permitted(actor, spec.permission)) return failure('not-permitted', { speaker: speakerView(actor) });

  return guarded(async () => {
    const state = await resolveMon(ctx, linked.callerId, args.monId);
    if (isResult(state)) return state;
    const now = ctx.now();
    const action = spec.action(args);
    const predicted = applyCareAction(state, action, now);
    if (predicted.outcome.kind === 'declined') {
      return success({
        applied: false,
        declinedBecause: predicted.outcome.reason,
        mon: monView(state.mon),
        care: careView(state.care),
        mood: deriveMonMood(state.care),
      });
    }
    const written = current(
      await ctx.data.applyCare({
        callerId: linked.callerId,
        monInstanceId: state.mon.monInstanceId,
        action,
        at: now,
        // JSON-RPC ids are connection-local and can restart after reconnect.
        // A client can supply one stable UUID for a retry. Without one, mint
        // a fresh UUID so two separate calls can never collide.
        intentKey: `mcp:${args.intentId ?? randomUUID()}`,
      }),
      now,
    );
    const outcome = predicted.outcome;
    const effect = outcome.kind === 'woke' ? (outcome.early ? 'woke-early' : 'woke') : outcome.kind;
    return success({
      applied: true,
      effect,
      mon: monView(written.mon),
      care: careView(written.care),
      mood: deriveMonMood(written.care),
    });
  });
}

// ------------------------------------------------------------ registry ---

interface ToolDef<I extends z.ZodType, O extends z.ZodType> {
  readonly name: ToolName;
  readonly title: string;
  readonly description: string;
  readonly input: I;
  readonly output: O;
  readonly annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
  readonly run: (args: z.infer<I>, request: ToolRequest) => Promise<CallToolResult>;
}

/** Facts about the MCP request a tool call arrived on. */
export interface ToolRequest {
  /** The JSON-RPC id of the `tools/call`. */
  readonly requestId: string | number;
}

/** A tool ready to register: `call` parses raw arguments through the tool's own input schema. */
interface RegisteredToolDef extends Omit<ToolDef<z.ZodType, z.ZodType>, 'run'> {
  readonly call: (raw: unknown, request: ToolRequest) => Promise<CallToolResult>;
}

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

function def<I extends z.ZodType, O extends z.ZodType>(tool: ToolDef<I, O>): RegisteredToolDef {
  const { run, ...rest } = tool;
  return {
    ...rest,
    // The SDK has already validated against `input`; parsing again here gives
    // `run` its typed value without a cast and costs microseconds.
    call: async (raw, request) => {
      const parsed = tool.input.safeParse(raw);
      return parsed.success ? run(parsed.data, request) : failure('invalid-input');
    },
  };
}

/** The tool definitions for one request. Dev tools exist only when `ctx.familiar` is set. */
export function buildTools(ctx: ToolContext) {
  const devMode = ctx.familiar !== undefined;
  const core = [
    def({
      name: 'get_mon_status',
      title: 'Mon status',
      description:
        "Exact care meters for the Caller's Mon: Energy, Fullness and Social from 0 to 1, stage, bond, whether it is asleep, and whether it asked for food.",
      input: MonIdInput,
      output: MonStatusOutput,
      annotations: READ,
      run: async (args) => {
        const linked = linkedCaller(ctx);
        if (isResult(linked)) return linked;
        return guarded(async () => {
          const state = await resolveMon(ctx, linked.callerId, args.monId);
          if (isResult(state)) return state;
          return success({
            mon: monView(state.mon),
            care: careView(state.care),
            mood: deriveMonMood(state.care),
            needs: listUnmetNeeds(state.care),
          });
        });
      },
    }),
    def({
      name: 'check_on_mon',
      title: 'Check on Mon',
      description:
        "How the Caller's Mon is doing and what it needs: its mood, which needs are low, and the care that would help most (feed, rest, play, or wait).",
      input: MonIdInput,
      output: checkOnMonOutput(devMode),
      annotations: READ,
      run: async (args) => {
        const linked = linkedCaller(ctx);
        if (isResult(linked)) return linked;
        return guarded(async () => {
          const state = await resolveMon(ctx, linked.callerId, args.monId);
          if (isResult(state)) return state;
          const needs = listUnmetNeeds(state.care);
          return success({
            mon: monView(state.mon),
            mood: deriveMonMood(state.care),
            needs,
            suggestedCare: suggestedCare(state, needs),
            ...(devMode ? { presentPeople: presentPeople(ctx, linked.callerId) } : {}),
          });
        });
      },
    }),
    def({
      name: 'check_incubation',
      title: 'Check incubation',
      description: "Whether the Caller has an egg incubating, how many minutes are left, and whether it is ready to hatch (hatch_egg hatches it).",
      input: NoInput,
      output: IncubationOutput,
      annotations: READ,
      run: async () => {
        const linked = linkedCaller(ctx);
        if (isResult(linked)) return linked;
        return guarded(async () => {
          const now = ctx.now();
          const eggs = (await ctx.data.listIncubatingEggs(linked.callerId)).map(({ egg }) => ({
            eggId: egg.eggId,
            speciesId: egg.speciesId,
            incubationEndsAt: egg.incubationEndsAt,
            minutesRemaining: Math.max(0, Math.ceil((egg.incubationEndsAt - now) / 60_000)),
            readyToHatch: egg.incubationEndsAt <= now,
          }));
          return success({ incubating: eggs.length > 0, eggs });
        });
      },
    }),
    def({
      name: 'hatch_egg',
      title: 'Hatch egg',
      description:
        "Hatch the Caller's egg once incubation has ended, and show it hatching. Returns the Mon it hatched into. Before the egg is ready it refuses and says how many minutes are left. Only the Caller can hatch. Safe to retry.",
      input: hatchEggInput(devMode),
      output: HatchEggOutput,
      annotations: { ...WRITE, idempotentHint: true },
      run: (args) => runHatch(ctx, args),
    }),
    def({
      name: 'talk_to_mon',
      title: 'Talk to Mon',
      description:
        "Use when the Caller talks to their Mon. Returns the Mon's state (mood, needs, awake or asleep, whether it wants food) and who is speaking, so the reply can be voiced in character. Writes nothing.",
      input: careInput(devMode),
      output: talkToMonOutput(devMode),
      annotations: READ,
      run: async (args) => {
        const linked = linkedCaller(ctx);
        if (isResult(linked)) return linked;
        const hint = SpeakerHintSchema.optional().parse('speakerHint' in args ? args.speakerHint : undefined);
        const actor = actorFor(ctx, linked.callerId, hint);
        return guarded(async () => {
          const state = await resolveMon(ctx, linked.callerId, args.monId);
          if (isResult(state)) return state;
          return success({
            mon: monView(state.mon),
            mood: deriveMonMood(state.care),
            needs: listUnmetNeeds(state.care),
            activity: state.care.activity.kind,
            wantsFood: state.care.pendingRequest !== null,
            speaker: speakerView(actor),
            ...(devMode ? { presentPeople: presentPeople(ctx, linked.callerId) } : {}),
          });
        });
      },
    }),
    def({
      name: 'feed_mon',
      title: 'Share a meal',
      description:
        'Share a meal with the Mon (feed it). No food item is chosen. A Mon that is asleep or sluggish from overeating declines, and nothing changes.',
      input: careInput(devMode),
      output: CareResultOutput,
      annotations: WRITE,
      run: (args) => runCare(ctx, { permission: 'feed', action: () => ({ kind: 'feed' }) }, args),
    }),
    def({
      name: 'rest_mon',
      title: 'Put Mon to rest',
      description: 'Put the Mon to sleep so its Energy recovers. Declines if it is already asleep.',
      input: careInput(devMode),
      output: CareResultOutput,
      annotations: WRITE,
      run: (args) => runCare(ctx, { permission: 'rest', action: () => ({ kind: 'rest' }) }, args),
    }),
    def({
      name: 'wake_mon',
      title: 'Wake Mon',
      description: 'Wake the Mon up. Waking it before its Energy recovers costs some Social. Declines if it is already awake.',
      input: careInput(devMode),
      output: CareResultOutput,
      annotations: WRITE,
      run: (args) => runCare(ctx, { permission: 'rest', action: () => ({ kind: 'wake' }) }, args),
    }),
    def({
      name: 'play_with_mon',
      title: 'Play with Mon',
      description:
        'Play with the Mon (Peek). Raises Social and bond and costs some Energy. Declines if it is asleep or too tired.',
      input: playInput(devMode),
      output: CareResultOutput,
      annotations: WRITE,
      run: (args) =>
        runCare(
          ctx,
          { permission: 'play', action: ({ quality }) => ({ kind: 'play', quality: quality ?? 0.5 }) },
          args,
        ),
    }),
  ];

  const familiar = ctx.familiar;
  if (familiar === undefined) return core;

  const person = (callerId: string, personId: string) => familiar.getPerson(callerId, personId);
  const personView = (p: NonNullable<ReturnType<typeof person>>) => ({
    personId: p.personId,
    displayName: p.displayName,
    relationship: p.relationship,
    permissions: p.permissions,
    fictional: p.fictional,
  });

  const dev = [
    def({
      name: 'get_familiar_people',
      title: 'Familiar people',
      description: "Simulator only. The fictional people in the Caller's circle and what each may do with the Mon.",
      input: NoInput,
      output: FamiliarPeopleOutput,
      annotations: READ,
      run: async () => {
        const linked = linkedCaller(ctx);
        if (isResult(linked)) return linked;
        return success({ people: familiar.listPeople(linked.callerId).map(personView) });
      },
    }),
    def({
      name: 'get_present_people',
      title: 'Present people',
      description: 'Simulator only. Familiar people detected nearby in the last 90 seconds, with a confidence tier.',
      input: NoInput,
      output: PresentPeopleOutput,
      annotations: READ,
      run: async () => {
        const linked = linkedCaller(ctx);
        if (isResult(linked)) return linked;
        return success({ people: presentPeople(ctx, linked.callerId) });
      },
    }),
    def({
      name: 'get_person_relationship',
      title: 'Person relationship',
      description: 'Simulator only. One familiar person: relationship to the Caller and what they may do with the Mon.',
      input: PersonIdInput,
      output: PersonRelationshipOutput,
      annotations: READ,
      run: async (args) => {
        const linked = linkedCaller(ctx);
        if (isResult(linked)) return linked;
        const p = person(linked.callerId, args.personId);
        return p === undefined ? failure('person-not-found') : success({ person: personView(p) });
      },
    }),
    def({
      name: 'get_shared_memories',
      title: 'Shared memories',
      description: 'Simulator only. Moments the Mon shared with one familiar person, newest first.',
      input: PersonIdInput,
      output: SharedMemoriesOutput,
      annotations: READ,
      run: async (args) => {
        const linked = linkedCaller(ctx);
        if (isResult(linked)) return linked;
        if (person(linked.callerId, args.personId) === undefined) return failure('person-not-found');
        const memories = familiar.listMemories(linked.callerId, args.personId).map(({ memoryId, summary, at }) => ({
          memoryId,
          summary,
          at,
        }));
        return success({ personId: args.personId, memories });
      },
    }),
    def({
      name: 'acknowledge_person',
      title: 'Acknowledge person',
      description: 'Simulator only. Record that the Mon noticed a familiar person who is nearby (greeted, hedged or ignored).',
      input: AcknowledgePersonInput,
      output: AcknowledgeOutput,
      annotations: WRITE,
      run: async (args) => {
        const linked = linkedCaller(ctx);
        if (isResult(linked)) return linked;
        const p = person(linked.callerId, args.personId);
        if (p === undefined) return failure('person-not-found');
        if (ctx.presence.latestFor(linked.callerId, args.personId, ctx.now()) === null) return failure('not-detected');
        const verb = { greeted: 'Greeted', hedged: 'Half-recognised', ignored: 'Noticed but ignored' }[args.acknowledgedAs];
        const memory = familiar.recordMemory(linked.callerId, args.personId, `${verb} ${p.displayName}.`, ctx.now());
        return success({ personId: args.personId, memoryId: memory.memoryId, at: memory.at });
      },
    }),
    def({
      name: 'inject_presence_event',
      title: 'Inject presence (simulator)',
      description: 'Simulator only. Mark a fictional familiar person as detected nearby, with a confidence from 0 to 1.',
      input: InjectPresenceEventInput,
      output: PresenceEventOutput,
      annotations: { ...WRITE, idempotentHint: false },
      run: async (args) => {
        const linked = linkedCaller(ctx);
        if (isResult(linked)) return linked;
        if (person(linked.callerId, args.personId) === undefined) return failure('person-not-found');
        const event = ctx.presence.ingest({
          eventId: `evt-${randomUUID()}`,
          personId: args.personId,
          callerId: linked.callerId,
          confidence: args.confidence,
          ts: ctx.now(),
          source: 'simulator',
          monInstanceId: args.monInstanceId,
        });
        return event === null ? failure('unavailable') : success({ event });
      },
    }),
  ];

  return [...core, ...dev];
}

/** Registers every tool for this request on `server`, linking MCP Apps views from `ui` when given. */
export function registerTools(server: McpServer, ctx: ToolContext, ui: McpAppsRegistration | undefined): void {
  for (const tool of buildTools(ctx)) {
    const resourceUri = ui?.toolResourceUris[tool.name];
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        outputSchema: tool.output,
        annotations: { title: tool.title, ...tool.annotations },
        // MCP Apps: linked tools stay visible to the model and callable from
        // the view (the card's care buttons call them with `{ monId }`).
        ...(resourceUri === undefined ? {} : { _meta: { ui: { resourceUri, visibility: ['model', 'app'] } } }),
      },
      (args: unknown, extra: { mcpReq: { id: string | number } }) => tool.call(args, { requestId: extra.mcpReq.id }),
    );
  }
}

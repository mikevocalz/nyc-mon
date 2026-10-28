import { existsSync, readFileSync, statSync } from 'node:fs';
import { FALLBACK_MON_LINGO, type MonLingo } from '@acme/content/lingo';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The Agent Skill is the system prompt (ADR 0009): character, tool routing,
 * the permission model. It lives at `skills/nyc-mon-companion/SKILL.md`.
 * The file is re-read when it changes, so skill edits show up without a restart.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const DEFAULT_SKILL_PATHS = [
  resolve(repoRoot, 'skills/nyc-mon-companion/SKILL.md'),
];

export function resolveSkillPath(explicit: string | undefined): string {
  if (explicit) {
    const p = resolve(repoRoot, explicit);
    if (!existsSync(p)) throw new Error(`SIM_SKILL_PATH not found: ${explicit}`);
    return p;
  }
  const found = DEFAULT_SKILL_PATHS.find((p) => existsSync(p));
  if (!found) throw new Error('No Agent Skill found. Expected skills/nyc-mon-companion/SKILL.md.');
  return found;
}

/**
 * The stage-direction sentence of the host note, from the served lingo's
 * stage directions (Payload `language-lexicon`, category stage-direction):
 * the voice layer performs a direction whose words contain one of a tag's
 * keywords and drops any other (stageDirectionsWith in @acme/content/lingo).
 */
export function stageDirectionNote(lingo: MonLingo): string {
  const tags = lingo.stageDirections.map((entry) => `${entry.tag.replace(/^\[|\]$/g, '')} (${entry.keywords.join(', ')})`);
  return `For delivery, write a stage direction in asterisks, such as *${lingo.stageDirections[0]?.keywords[0] ?? 'pause'}*. The voice layer acts out a direction that contains one of these keywords, as the tag named before it, and drops any other: ${tags.join('; ')}.`;
}

/** Host framing that comes after the skill; it says where the session runs, not how to behave. */
export function hostNote(lingo: MonLingo): string {
  return [
    '',
    '---',
    "Host: the NYC-MON smart-display simulator. The person types or speaks to you; your replies are shown in large type and read aloud in the current Mon's own voice (the browser's speech synthesis when the Mon has none), so keep them short, plain and speakable: no markdown, lists, tables or emoji.",
    stageDirectionNote(lingo),
    'When a tool result has an interactive view, the host shows it on screen next to your reply.',
    'A user turn may end with a line "[Presence: <name> is speaking.]". The host adds it from its presence sensor, never the person, and care tools already act as that person. Treat it as who is speaking. Without it, the Caller is speaking.',
    'A user turn may also end with a line "[Mon now, <n> s ago: …]". The host adds it from its own get_mon_status or care result, and the card on screen already shows it. It is the current state: for chat, greetings and banter, use its mood and reply at once, without calling check_on_mon or get_mon_status first. Call a tool when the person asks for something the line does not answer (the card, exact meters, the journal, presence) or for care.',
  ].join('\n');
}

/** The host note with the bundled lingo, for the simulator entry that has no /v1 source. */
export const HOST_NOTE = hostNote(FALLBACK_MON_LINGO);

/**
 * The skill plus the host note. `lingo` returns the served lingo
 * (MonLingoSource.latest); the note is rebuilt when the skill file or the
 * served table changes. Omitted: the bundled lingo.
 */
export function createSkillLoader(path: string, lingo: () => MonLingo = () => FALLBACK_MON_LINGO): () => string {
  let mtime = -1;
  let skill = '';
  let noteFor: MonLingo | undefined;
  let text = '';
  return () => {
    const m = statSync(path).mtimeMs;
    const current = lingo();
    if (m !== mtime) {
      skill = readFileSync(path, 'utf8');
      mtime = m;
      noteFor = undefined;
    }
    if (current !== noteFor) {
      text = skill + hostNote(current);
      noteFor = current;
    }
    return text;
  };
}

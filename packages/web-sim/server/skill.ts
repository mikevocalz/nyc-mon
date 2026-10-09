import { existsSync, readFileSync, statSync } from 'node:fs';
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

/** Host framing that comes after the skill; it says where the session runs, not how to behave. */
export const HOST_NOTE = [
  '',
  '---',
  'Host: the NYC-MON smart-display simulator. The person types or speaks to you; your replies are shown in large type and read aloud with speech synthesis, so keep them short, plain and speakable: no markdown, lists, tables or emoji.',
  'When a tool result has an interactive view, the host shows it on screen next to your reply.',
].join('\n');

export function createSkillLoader(path: string): () => string {
  let mtime = -1;
  let text = '';
  return () => {
    const m = statSync(path).mtimeMs;
    if (m !== mtime) {
      text = readFileSync(path, 'utf8') + HOST_NOTE;
      mtime = m;
    }
    return text;
  };
}

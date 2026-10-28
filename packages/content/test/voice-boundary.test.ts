import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * One Mon voice: surfaces plan every line with `@acme/content/voice` and play
 * it through a `MonVoicePort`. Only the two adapters below talk to a speech
 * engine. A new surface that calls Web Speech, ElevenLabs or a native TTS
 * module itself fails here; it should add an adapter next to these instead.
 */
const ADAPTERS: ReadonlyMap<string, string> = new Map([
  ['packages/web-sim/src/client/speech.ts', 'browser adapter: plays /api/tts clips, Web Speech fallback'],
  ['packages/web-sim/server/tts.ts', 'server adapter: ElevenLabs lineage voice + stage pitch'],
  ['packages/payload/src/admin/console/v1/mon-voice.ts', 'app server adapter: POST /v1/mon-voice, ElevenLabs behind the Better Auth session'],
  ['packages/app/features/voice/mon-voice-port.native.ts', 'app native adapter: /v1/mon-voice clips on react-native-audio-api'],
  ['packages/app/features/voice/mon-voice-port.web.ts', 'app web adapter: /v1/mon-voice clips in HTMLAudio, Web Speech fallback'],
]);

const PLATFORM_TTS: readonly RegExp[] = [
  /\bspeechSynthesis\b/,
  /\bSpeechSynthesisUtterance\b/,
  /api\.elevenlabs\.io/,
  /['"]expo-speech['"]/,
  /['"]react-native-tts['"]/,
  /\bAVSpeechSynthesizer\b/,
  /\bandroid\.speech\.tts\b/,
];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function sourceFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'packages', 'apps'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out
    .split('\n')
    .filter((f) => /\.(ts|tsx|mts|js|mjs|swift|kt)$/.test(f))
    .filter((f) => !/(^|\/)(node_modules|public|dist|build|vendor)\//.test(f))
    .filter((f) => !/(\.test\.|\.spec\.|\/test\/|__tests__|\.test-support\.)/.test(f));
}

describe('Mon voice boundary', () => {
  it('no surface outside the voice adapters calls a platform TTS directly', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      if (ADAPTERS.has(file)) continue;
      let text: string;
      try {
        text = readFileSync(resolve(ROOT, file), 'utf8');
      } catch {
        continue; // listed by git but deleted in the working tree
      }
      const hit = PLATFORM_TTS.find((p) => p.test(text));
      if (hit) offenders.push(`${file} (${hit.source})`);
    }
    expect(offenders).toEqual([]);
  });

  it('every listed adapter exists and plans its lines with @acme/content/voice', () => {
    for (const file of ADAPTERS.keys()) {
      expect(readFileSync(resolve(ROOT, file), 'utf8'), file).toMatch(/from '@acme\/content\/voice'/);
    }
  });
});

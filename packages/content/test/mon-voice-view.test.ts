import { describe, expect, it } from 'vitest';
import { FALLBACK_MON_LINGO, type MonLingo } from '../lingo/index.ts';
import { monVoiceView, voiceGuideFor } from '../mon-voice.ts';

const NOW = Date.UTC(2026, 9, 29, 12);
const ratti = { speciesId: 'dex-003', stage: 'Small' as const, voiceLineageId: 'dex-001/female/1', hatchedAt: NOW - 3 * 86_400_000 };

describe('monVoiceView (mon.voice in MCP tool results)', () => {
  it('reports the lineage and stage, and whether the served lingo can voice it', () => {
    expect(monVoiceView(ratti, NOW, FALLBACK_MON_LINGO)).toEqual({ lineageId: 'dex-001/female/1', stage: 'Small', voiceStage: 'full', voiced: true });
    // Decision 32: an Egg babbles in its lineage voice, pitched up.
    expect(monVoiceView({ ...ratti, stage: 'Egg' }, NOW, FALLBACK_MON_LINGO)).toEqual({ lineageId: 'dex-001/female/1', stage: 'Egg', voiceStage: 'baby-talk', voiced: true });
    expect(monVoiceView({ ...ratti, voiceLineageId: null }, NOW, FALLBACK_MON_LINGO)).toBeNull();
  });

  it('reports the first-day babble and the limited speech after it', () => {
    const squeaklet = { ...ratti, speciesId: 'dex-002', stage: 'Baby' as const };
    expect(monVoiceView({ ...squeaklet, hatchedAt: NOW - 3_600_000 }, NOW)?.voiceStage).toBe('baby-talk');
    expect(monVoiceView(squeaklet, NOW)?.voiceStage).toBe('limited');
  });

  it('follows the served tables, not the bundled ones', () => {
    const noVoices: MonLingo = { ...FALLBACK_MON_LINGO, voices: { ...FALLBACK_MON_LINGO.voices, lineages: [] } };
    expect(monVoiceView(ratti, NOW, noVoices)?.voiced).toBe(false);
  });
});

describe('voiceGuideFor (the served voice rules for one Mon)', () => {
  it("gives a Small Hood Ratti the all-Mon rules, its line's rules, the palette and its canon lines", () => {
    const guide = voiceGuideFor(ratti, 'content', FALLBACK_MON_LINGO);
    expect(guide).toContain('**No pronoun for a Mon (PS-005).** Use the Mon\'s name, its form name, or "your Mon". Not he, she, they or it.');
    expect(guide).toContain('Short, punchy phrases with a beat in them. Two to five words lands better than one long clause.');
    expect(guide.some((g) => g.startsWith('bet: '))).toBe(true);
    expect(guide).toContain('Canon line (greet): "Yeah Callah, I\'m good."');
    expect(guide).toContain('Mood content: `*chuckle*`');
  });

  it("leaves out other forms', stages', moods' and bloodlines' rules, and inactive canon", () => {
    const guide = voiceGuideFor(ratti, 'asleep', FALLBACK_MON_LINGO).join('\n');
    expect(guide).not.toContain('chirrup, purr'); // Kittee Cee
    expect(guide).not.toContain('the family sound and at most two words'); // Baby stage
    expect(guide).not.toContain('Mood content'); // another mood
    expect(guide).not.toContain("You ain't my Callah"); // story canon, inactive
    expect(guide).toContain('Mood asleep: `*whisper*`');
  });

  it('gives a babbling Mon only the babble rules and its sounds, no palette, lines or Callah', () => {
    const guide = voiceGuideFor({ speciesId: 'dex-002', stage: 'Baby' }, 'content', FALLBACK_MON_LINGO, 'baby-talk').join('\n');
    expect(guide).toContain('baby talk only');
    expect(guide).toContain('skree');
    expect(guide).not.toContain('bet: ');
    expect(guide).not.toContain('Canon line');
    const egg = voiceGuideFor({ speciesId: 'dex-001', stage: 'Egg' }, undefined, FALLBACK_MON_LINGO).join('\n');
    expect(egg).toContain('still an Egg');
    expect(egg).toContain('mm');
  });

  it('gives a Mon of another bloodline no Hood Ratti palette or cadence', () => {
    const guide = voiceGuideFor({ speciesId: 'dex-009', stage: 'Baby' }, undefined, FALLBACK_MON_LINGO).join('\n');
    expect(guide).toContain('chirrup, purr, clipped meow');
    expect(guide).not.toContain('bet: ');
    expect(guide).not.toContain('Short, punchy phrases');
  });
});

import { describe, expect, it } from 'vitest';
import { companionModelClips, companionModelForDex } from '../src/client/companionModels.ts';

// The panel's model table (companionModels.ts) mirrors the app's
// mon-models.ts: only forms with a real GLB get an entry, so the page can
// never promise a model the server does not have.
describe('companionModelForDex', () => {
  it('has the forms that ship a GLB in public/mons', () => {
    expect(companionModelForDex(1)?.file).toBe('metro-egg');
    expect(companionModelForDex(2)?.file).toBe('squeaklet');
    expect(companionModelForDex(3)?.file).toBe('lil-ratti');
  });

  it('is null for forms with no model and for no form at all', () => {
    expect(companionModelForDex(null)).toBeNull();
    for (const dex of [8, 9, 20, 21, 61, 62]) expect(companionModelForDex(dex)).toBeNull();
  });
});

describe('companionModelClips', () => {
  it('plays the form’s idle loop in an ordinary mood', () => {
    const ratti = companionModelForDex(3)!;
    expect(companionModelClips(ratti, 'content', false)).toEqual(['up_idle', 'up_breathe', 'quad_idle_sniff']);
    expect(companionModelClips(ratti, null, false)).toEqual(['up_idle', 'up_breathe', 'quad_idle_sniff']);
  });

  it('lets a mood pick its clip, asleep winning over the mood', () => {
    const ratti = companionModelForDex(3)!;
    expect(companionModelClips(ratti, 'needs-social', false)[0]).toBe('beckon');
    expect(companionModelClips(ratti, 'needs-social', true)[0]).toBe('emote_tired');
    const squeaklet = companionModelForDex(2)!;
    expect(companionModelClips(squeaklet, 'needs-social', false)[0]).toBe('rat_run');
    // Squeaklet has no sleep clip: it holds the bind pose.
    expect(companionModelClips(squeaklet, null, true)).toEqual([]);
  });
});

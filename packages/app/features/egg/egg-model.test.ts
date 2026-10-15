import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bloodlines, eggs } from '@acme/content';
import { INCUBATION_MINUTES } from '@acme/core/schemas';
import { EGG_COPY } from './copy.ts';
import {
  afterCaseClosed,
  buildEggViews,
  entryRedirect,
  incubateHref,
  ledChip,
  MEET_INITIAL,
  meetAskConfirm,
  meetBack,
  meetFocus,
  meetStep,
  MON_HOME_PATH,
  parseBloodlineParam,
  readyAt,
  stepMinutes,
} from './egg-model.ts';
import { textRamp } from './text-ramp.ts';
import { isAccessibilityTextSize, isLandscapeWindow, ringSizeDp } from './window-layout.ts';

const views = buildEggViews(eggs, bloodlines);

describe('buildEggViews', () => {
  it('lists the three starter eggs in slot order with content-derived labels', () => {
    assert.deepEqual(views.map((v) => v.bloodlineId), eggs.map((e) => e.bloodlineId));
    assert.equal(views.length, 3);
    for (const v of views) {
      assert.match(v.dexNumber, /^\d{3}$/);
      assert.ok(v.bloodline.endsWith(' Bloodline'));
    }
    assert.deepEqual(views.map((v) => v.index), [1, 2, 3]);
  });

  it('throws when content lacks a Bloodline (the M08 error state)', () => {
    assert.throws(() => buildEggViews(eggs, []));
  });
});

describe('M08 entry guard', () => {
  it('Mon present → /(home) (M13); pending egg → /(home) (M11); neither → render', () => {
    assert.equal(entryRedirect({ hasMon: true, hasPendingEgg: false }), MON_HOME_PATH);
    assert.equal(entryRedirect({ hasMon: false, hasPendingEgg: true }), MON_HOME_PATH);
    assert.equal(entryRedirect({ hasMon: false, hasPendingEgg: false }), undefined);
  });
});

describe('M08 states', () => {
  it('no tile is focused on mount; the first step focuses index 0 either way', () => {
    assert.equal(MEET_INITIAL.focused, null);
    assert.equal(MEET_INITIAL.phase, 'browsing');
    assert.deepEqual(meetStep(MEET_INITIAL, 1, 3), { phase: 'approaching', focused: 0 });
    assert.deepEqual(meetStep(MEET_INITIAL, -1, 3), { phase: 'approaching', focused: 0 });
  });

  it('steps wrap while approaching and do nothing while confirming', () => {
    assert.equal(meetStep({ phase: 'approaching', focused: 2 }, 1, 3).focused, 0);
    assert.equal(meetStep({ phase: 'approaching', focused: 0 }, -1, 3).focused, 2);
    const confirming = { phase: 'confirming', focused: 1 } as const;
    assert.equal(meetStep(confirming, 1, 3), confirming);
  });

  it('the button path asks to confirm; Back unwinds one level at a time', () => {
    const approaching = meetFocus(MEET_INITIAL, 1);
    const confirming = meetAskConfirm(approaching);
    assert.deepEqual(confirming, { phase: 'confirming', focused: 1 });
    assert.deepEqual(meetBack(confirming), approaching);
    assert.deepEqual(meetBack(approaching), MEET_INITIAL);
    assert.equal(meetBack(MEET_INITIAL), 'leave');
  });

  it('Escape (null focus) returns to browsing', () => {
    assert.deepEqual(meetFocus({ phase: 'approaching', focused: 2 }, null), MEET_INITIAL);
  });

  it('commit pushes M10 with the chosen Bloodline', () => {
    for (const v of views) assert.equal(incubateHref(v.bloodlineId), `/(onboarding)/incubate?bloodline=${v.bloodlineId}`);
  });
});

describe('M10 route param', () => {
  it('accepts only a starter Bloodline', () => {
    assert.equal(parseBloodlineParam(views[0]!.bloodlineId, views)?.bloodlineId, views[0]!.bloodlineId);
    assert.equal(parseBloodlineParam([views[1]!.bloodlineId], views)?.bloodlineId, views[1]!.bloodlineId);
    assert.equal(parseBloodlineParam('F99', views), undefined);
    assert.equal(parseBloodlineParam(undefined, views), undefined);
  });
});

describe('M10 time choice', () => {
  it('from none, +1 picks 15 and -1 picks 60; then clamps at the ends', () => {
    assert.equal(stepMinutes(INCUBATION_MINUTES, null, 1), 15);
    assert.equal(stepMinutes(INCUBATION_MINUTES, null, -1), 60);
    assert.equal(stepMinutes(INCUBATION_MINUTES, 15, 1), 30);
    assert.equal(stepMinutes(INCUBATION_MINUTES, 60, 1), 60);
    assert.equal(stepMinutes(INCUBATION_MINUTES, 15, -1), 15);
  });

  it('Ready-at crossing local midnight uses the tomorrow string', () => {
    const late = new Date(2026, 9, 8, 23, 50).getTime();
    const early = new Date(2026, 9, 8, 14, 0).getTime();
    const fmt = (ms: number) => String(new Date(ms).getHours());
    assert.equal(readyAt(late, 15, fmt).id, 'm10.ready.tomorrow');
    assert.equal(readyAt(early, 60, fmt).id, 'm10.ready');
    assert.equal(readyAt(early, 30, fmt).endsAtMs, early + 30 * 60_000);
  });

  it('LED chip rounds minutes up and reads a full hour as an hour', () => {
    assert.deepEqual(ledChip(14 * 60_000 + 1), { id: 'm10.led.chip', minutes: 15 });
    assert.deepEqual(ledChip(60 * 60_000), { id: 'm10.led.chip.hour', minutes: 60 });
  });

  it('the M06 sheet opens only when permission is undetermined', () => {
    assert.equal(afterCaseClosed('undetermined'), 'sheet');
    assert.equal(afterCaseClosed('granted'), 'schedule-then-home');
    assert.equal(afterCaseClosed('denied'), 'home');
    assert.equal(afterCaseClosed('unsupported'), 'home');
  });
});

describe('window layout (Horizon 2D window 360–1280 dp, phones, tablets)', () => {
  it('landscape when wider than tall, including the default 1280 × 800 Quest window', () => {
    assert.equal(isLandscapeWindow(1280, 800), true);
    assert.equal(isLandscapeWindow(375, 667), false);
  });

  it('accessibility text sizes switch to rows; XXXL does not', () => {
    assert.equal(isAccessibilityTextSize(1.353), false);
    assert.equal(isAccessibilityTextSize(1.647), true);
  });

  it('ring is min(screenW - 64, 260) on phones and never under 144', () => {
    assert.equal(ringSizeDp(351, 468), 260);
    assert.equal(ringSizeDp(300, 400), 236);
    assert.equal(ringSizeDp(160, 400), 144);
    assert.ok(ringSizeDp(1280, 704) <= 360);
  });
});

describe('copy rules', () => {
  const entries = Object.entries(EGG_COPY);
  it('no M08 string says catch, capture, device, family or " line"', () => {
    for (const [id, text] of entries.filter(([id]) => id.startsWith('m08.'))) {
      assert.doesNotMatch(text, /catch|capture|device|family| line/i, id);
    }
  });

  it('no M10 string says capture, hurry, best, recommended or skip', () => {
    for (const [id, text] of entries.filter(([id]) => id.startsWith('m10.'))) {
      assert.doesNotMatch(text, /capture|hurry|best|recommended|skip/i, id);
    }
  });

  it('no string uses a pronoun for the Mon (PS-005)', () => {
    // Reviewed: "if it keeps happening" (m08/m10 error bodies) refers to the error, not a Mon.
    const allowed = new Set(['m08.error.body', 'm10.error.body']);
    for (const [id, text] of entries) {
      if (allowed.has(id)) continue;
      assert.doesNotMatch(text, /\b(he|she|him|her|his|hers|it|its|they|them|their)\b/i, id);
    }
  });

  it('the Santoro line ships empty until canon gives one', () => {
    assert.equal(EGG_COPY['m08.santoro.line'], '');
  });
});

describe('text ramp (absolute px; never rem-scaled text-xs/sm/base)', () => {
  it('headsets get the XR ramp, phones the mobile ramp', () => {
    assert.equal(textRamp(true).body, 'text-xr-body');
    assert.equal(textRamp(false).body, 'text-type-body');
    for (const ramp of [textRamp(true), textRamp(false)]) {
      for (const cls of Object.values(ramp)) assert.doesNotMatch(cls, /text-(xs|sm|base|lg)\b/);
    }
  });

});

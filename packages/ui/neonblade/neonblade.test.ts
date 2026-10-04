import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG, byCategory, siteUrl } from './catalog.ts';
import { sanitize, storyId, storyNameFromExport } from './story-id.ts';

test('the catalog lists all 41 NeonBlade components once', () => {
  assert.equal(CATALOG.length, 41);
  assert.equal(new Set(CATALOG.map((e) => `${e.category}/${e.slug}`)).size, 41);
  assert.equal(byCategory().reduce((n, g) => n + g.entries.length, 0), 41);
  assert.equal(siteUrl({ category: 'charts', slug: 'neon-donut-chart' }), 'https://neonbladeui.neuronrush.com/components/charts/neon-donut-chart');
});

test('story ids match Storybook', () => {
  assert.equal(storyNameFromExport('NavBarStory'), 'Nav Bar Story');
  assert.equal(storyNameFromExport('CornerCut'), 'Corner Cut');
  assert.equal(storyId('Nav', 'NavBarStory'), 'nav--nav-bar-story');
  assert.equal(storyId('Charts/Neon Donut Chart', 'Playground'), 'charts-neon-donut-chart--playground');
  assert.equal(storyId('NYC Mon/City blocks', 'Playground'), 'nyc-mon-city-blocks--playground');
  assert.equal(storyId('UI/DataTable', 'Neon'), 'ui-datatable--neon');
  assert.equal(storyId('Cards/Card slider', 'NeonBladeDemos'), 'cards-card-slider--neon-blade-demos');
  assert.equal(sanitize('Backgrounds/SignRain (NeonBlade: ASCII Rain)'), 'backgrounds-signrain-neonblade-ascii-rain');
});

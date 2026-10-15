import assert from 'node:assert/strict';
import test from 'node:test';
import { appPreviewEnabled } from './app-preview.ts';

test('app preview: off in production unless opted in, on in development', () => {
  assert.equal(appPreviewEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(appPreviewEnabled({ NODE_ENV: 'production', NYCMON_APP_PREVIEW: '1' }), true);
  assert.equal(appPreviewEnabled({ NODE_ENV: 'production', NYCMON_APP_PREVIEW: 'true' }), false);
  assert.equal(appPreviewEnabled({ NODE_ENV: 'development' }), true);
});

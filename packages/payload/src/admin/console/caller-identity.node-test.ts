import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { callerIdentity, CALLER_IDENTITY_SELECT } from './caller-identity.ts';

for (const id of ['00042', 'user_01HXABCDEF', 0, 42]) {
  test(`keeps the canonical user ID ${id}`, () => {
    assert.equal(callerIdentity({ id }).id, String(id));
  });
}

test('selects the existing Better Auth image field', () => {
  assert.deepEqual(CALLER_IDENTITY_SELECT, { image: true });
});

test('carries the actual user photo without exposing other profile fields', () => {
  const user = { id: 'u1', image: 'https://media.example.com/u1.png', name: 'Private name', email: 'private@example.com', username: 'not-the-id' };
  assert.deepEqual(callerIdentity(user), { id: 'u1', image: user.image });
});

test('missing and null profile images both use the fallback', () => {
  assert.equal(callerIdentity({ id: 'u1' }).image, null);
  assert.equal(callerIdentity({ id: 'u1', image: null }).image, null);
});

// Source contracts: these verify wiring, not a browser-rendered table.
const server = readFileSync(new URL('./views/Views.tsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('./views/ViewsClient.tsx', import.meta.url), 'utf8');
const avatar = readFileSync(new URL('../../../../ui/admin/CallerAvatar.tsx', import.meta.url), 'utf8');
const list = client.slice(client.indexOf('const callerColumns'), client.indexOf('export function CallersViewClient'));
const query = server.slice(server.indexOf('export async function CallersView'), server.indexOf('export async function ConsentView'));

test('avatar is the first column and User ID is second', () => {
  assert.deepEqual([...list.matchAll(/header: '([^']+)'/g)].map((match) => match[1]), ['Avatar', 'User ID', 'Age band', 'Consent', 'Joined']);
  assert.match(list, /imageUri=\{row\.original\.image\}/);
});

test('both identity columns remain visible at narrow widths', () => {
  assert.equal([...list.matchAll(/meta: \{ priority: 1 \}/g)].length, 2);
  assert.match(list, /enableSorting: false/);
});

test('renders the complete ID and copies the same ID in the detail pane', () => {
  assert.match(list, /\{row\.original\.id\}<\/Text>/);
  assert.doesNotMatch(list, /\.slice\(|truncate/);
  assert.match(client, /label: 'User ID', value: selected\.id, action: <CopyButton value=\{selected\.id\} label="Copy user ID"/);
  // DataTable links the whole row: no nested copy button inside it.
  assert.doesNotMatch(list, /CopyButton/);
});

test('server includes the avatar projection and preserves access checks', () => {
  assert.match(query, /select: \{ \.\.\.CALLER_IDENTITY_SELECT/);
  assert.match(query, /\.\.\.callerIdentity\(doc\)/);
  assert.match(query, /user, overrideAccess: false, req/);
  assert.match(query, /role: \{ equals: 'user' \}/);
});

test('avatar uses isolated Zustand state and handles image errors', () => {
  assert.match(avatar, /useInstanceStore/);
  assert.match(avatar, /onError=\{\(\) => store\.setState\(\{ failedSource: source \}\)\}/);
  assert.match(avatar, /referrerPolicy="no-referrer"/);
  assert.match(avatar, /<Avatar name="Caller"/);
  assert.doesNotMatch(avatar, /useState|\.email|\.name/);
});

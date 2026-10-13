import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageDir = fileURLToPath(new URL('../..', import.meta.url));
const repoRoot = resolve(packageDir, '../..');
const require = createRequire(import.meta.url);
const payloadModule = pathToFileURL(require.resolve('payload')).href;
const migrationDir = resolve(packageDir, 'src/migrations');

describe('native Node Payload migration discovery', () => {
  for (const cwd of [repoRoot, resolve(repoRoot, 'apps/admin-vite')]) {
    it(`loads every migration without executing SQL from ${cwd}`, () => {
      const env = { ...process.env };
      delete env.VITEST;
      delete env.NODE_OPTIONS;
      const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
        import { readMigrationFiles } from ${JSON.stringify(payloadModule)};
        const migrations = await readMigrationFiles({ payload: {
          db: { migrationDir: ${JSON.stringify(migrationDir)} },
          logger: { info() {}, error(message) { throw new Error(JSON.stringify(message)); } },
        } });
        console.log(JSON.stringify(migrations.map(({ name, up, down }) => ({
          name, up: typeof up, down: typeof down,
        }))));
      `], { cwd, env, encoding: 'utf8', timeout: 30_000 });

      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout.trim())).toEqual([
        { name: '20261004_213700', up: 'function', down: 'function' },
        { name: '20261007_202116_waitlist', up: 'function', down: 'function' },
        { name: '20261008_181202_alexa_oauth', up: 'function', down: 'function' },
      ]);
    }, 35_000);
  }
});

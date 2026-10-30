// Test harness only: create a clean pre-editor schema in an isolated local database.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const url = new URL(process.env.DATABASE_URL ?? '');
if (process.env.SITE_EDITOR_INTEGRATION !== '1' || !['127.0.0.1','localhost'].includes(url.hostname) || !url.pathname.startsWith('/site_editor_') || process.env.NYCMON_SITE_EDITOR !== '0' || process.env.PAYLOAD_PUSH !== 'true') throw Error('Baseline bootstrapping is restricted to isolated local tests');
const require = createRequire(new URL('../../packages/payload/package.json',import.meta.url));
const { getPayload } = require('payload');
const { default: config } = await import('../../packages/payload/src/payload.config.ts');
const payload = await getPayload({config});
const user = await payload.create({collection:'users',data:{email:'sentinel@example.test',name:'Migration sentinel',role:'user',emailVerified:true,birthYear:1990},overrideAccess:true});
writeFileSync('/tmp/editor-evidence/baseline-user.json',JSON.stringify({id:user.id,email:user.email}));
console.log('BASELINE_READY',user.id);
await payload.destroy();

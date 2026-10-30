// Creates disposable authentication fixtures only in the isolated localhost test database.
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const database = new URL(process.env.DATABASE_URL ?? '');
if (process.env.SITE_EDITOR_INTEGRATION !== '1' || !['127.0.0.1','localhost'].includes(database.hostname) || !database.pathname.startsWith('/site_editor_')) throw Error('Integration fixture database guard');
const require = createRequire(new URL('../../packages/payload/package.json', import.meta.url));
const { getPayload } = require('payload');
const { default: config } = await import('../../packages/payload/src/payload.config.ts');
const payload = await getPayload({config});
const fixtures=[];
for (const role of ['ops','content','user']) {
  const email=`site-editor-${role}-${Date.now()}@example.test`;
  const password=randomBytes(24).toString('base64url');
  const result=await payload.betterAuth.api.signUpEmail({body:{email,password,name:`Integration ${role}`,birthYear:1990}});
  await payload.update({collection:'users',id:result.user.id,data:{role,emailVerified:true},overrideAccess:true});
  fixtures.push({role,email,password,id:String(result.user.id)});
}
writeFileSync('/tmp/editor-evidence/auth-fixtures.json',JSON.stringify(fixtures),{mode:0o600});
console.log('Created three isolated authentication fixtures; no credentials logged.');
await payload.destroy();

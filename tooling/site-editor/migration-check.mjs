// Exercise the generated additive migration against a pre-editor test schema.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const url=new URL(process.env.DATABASE_URL??'');
if(process.env.SITE_EDITOR_INTEGRATION!=='1'||!['127.0.0.1','localhost'].includes(url.hostname)||!url.pathname.startsWith('/site_editor_')||process.env.PAYLOAD_PUSH==='true')throw Error('Migration check requires an isolated local test database and schema push disabled');
const require=createRequire(new URL('../../packages/payload/package.json',import.meta.url));const{Client}=require('pg');const db=new Client({connectionString:url.href});await db.connect();
const columns="SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='payload' ORDER BY table_name,ordinal_position";
const before=(await db.query(columns)).rows;const users=(await db.query('SELECT id,email,name,role FROM payload.users ORDER BY id')).rows;
const source=readFileSync(new URL('../../packages/payload/src/migrations/20261030_044717_website_editor.ts',import.meta.url),'utf8').split('export async function down')[0];
const sql=source.split('sql`')[1]?.split('`')[0];assert.ok(sql&&!sql.includes('${')&&!/\bDROP\b/i.test(sql));
try{await db.query('BEGIN');await db.query(sql);const after=(await db.query(columns)).rows;for(const c of before)assert.ok(after.some(a=>a.table_name===c.table_name&&a.column_name===c.column_name&&a.data_type===c.data_type));assert.deepEqual((await db.query('SELECT id,email,name,role FROM payload.users ORDER BY id')).rows,users);assert.ok(after.some(c=>c.table_name==='site_pages'));await db.query('COMMIT');writeFileSync('/tmp/editor-evidence/migration-check.json',JSON.stringify({unchangedColumns:before.length,preservedUsers:users.length,sitePagesCreated:true,destructiveUpStatements:0}));console.log('Additive migration passed; all baseline columns and users preserved.');}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}

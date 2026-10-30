/** Local browser-test account, not a production enrollment script. */
import {writeFile} from 'node:fs/promises';
const db=new URL(process.env.DATABASE_URL??'');
if(process.env.SITE_EDITOR_TEST_CONFIRM!=='disposable'||!['','localhost','127.0.0.1'].includes(db.hostname)||!/(?:test|clean)/.test(db.pathname)) throw new Error('Only disposable local tests may create this fixture.');
const {getPayload}=await import('payload');const {default:config}=await import('../payload.config.ts');const payload=await getPayload({config});
try {
 const email='website-editor-browser@example.test';const password='CMS-browser-test-only-DoNotReuse-2026';
 let user=(await payload.find({collection:'users',where:{email:{equals:email}},limit:1,overrideAccess:true})).docs[0];
 if(!user){await payload.betterAuth.api.signUpEmail({body:{email,password,name:'Disposable Website Editor',birthYear:1990},headers:new Headers({origin:'http://localhost:3001'})});user=(await payload.find({collection:'users',where:{email:{equals:email}},limit:1,overrideAccess:true})).docs[0];}
 const ops=(await payload.find({collection:'users',where:{role:{equals:'ops'}},limit:1,overrideAccess:true})).docs[0];
 if(!ops||!user)throw new Error('Missing fixture staff');
 await payload.update({collection:'users',id:user.id,data:{role:'content',emailVerified:true},user:{...ops,collection:'users'},overrideAccess:true});
 await writeFile('/tmp/cms-browser-fixture.json',JSON.stringify({email,password,id:user.id}),{mode:0o600});
 console.log('Disposable browser editor fixture ready.');
}finally{await payload.destroy();}

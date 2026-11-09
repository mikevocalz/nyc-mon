import test from "node:test";
import assert from "node:assert/strict";
import {SQUEAKLET,HATCH_BEATS,HATCH_DURATION_MS,hatchFrame,meter,voiceIntent,makeScene,careFromServer,SpecsSqueakletSession}
 from "../src/specs.mjs";
import {mcpCall,createSpecsGateway} from "../src/bridge.mjs";
const care={energy:0.81,fullness:0.23,social:0.6,activity:"awake",wantsFood:false};
const status={mon:{monId:"mon123",name:"Squeaklet"},mood:"needs-fullness",care};
test("reveal is precisely fifteen seconds and six source beats",()=>{
 assert.equal(HATCH_DURATION_MS,15000);
 assert.deepEqual(HATCH_BEATS.map(x=>x[0]),["stir","pressure","crack","burst","emerge","attention"]);
 assert.equal(hatchFrame(14999).complete,false);
 assert.equal(hatchFrame(15000).complete,true);
 assert.equal(hatchFrame(1999).canSkip,false);
 assert.equal(hatchFrame(2000).canSkip,true);
 assert.equal(hatchFrame(4200,true).wobble,0);
});
test("Dex-002 rig and five real character clip names",()=>{
 assert.equal(SQUEAKLET.glb,"https://admin.nyc-mon.city/v1/mon-models/glb/dex-002");
 assert.deepEqual(SQUEAKLET.clips,["jaw_chomp","mouth_close","rat_run","tail_swish","blink"]);
 assert.equal(SQUEAKLET.jaw.closedRadians,0.357);
});
test("Rive meters reference valid 10 percent assets; labels stay precise",()=>{
 assert.deepEqual(meter(0.66),{percent:66,riveFrame:70});
 assert.throws(()=>meter(1.3));
 assert.equal(careFromServer(status).fullness,0.23);
});
test("voice: commands, status queries, and negated write protection",()=>{
 assert.equal(voiceIntent("Feed Squeaklet"),"feed_mon");
 assert.equal(voiceIntent("Don't feed Squeaklet"),"conversation");
 assert.equal(voiceIntent("How hungry are you?"),"get_mon_status");
 assert.equal(voiceIntent("Let's play"),"play_with_mon");
});
test("Viro scene shows 3D creature, select actions, 3 Rive gauges",()=>{
 const view=makeScene({screen:"pet",frame:hatchFrame(0),care});
 assert.equal(view.version,2);
 assert.equal(view.nodes.find(x=>x.id==="sq-mon").source,"mon/squeaklet");
 assert.equal(view.nodes.find(x=>x.id==="sq-egg").visible,false);
 assert.equal(view.nodes.find(x=>x.id==="sq-gauge-fullness").source,"rive/fullness/20");
 assert.equal(view.nodes.find(x=>x.id==="sq-label-fullness").text,"FULLNESS 23%");
 assert.deepEqual(view.actions.map(x=>x.id),["sq.feed","sq.play","sq.rest","sq.listen"]);
});
test("reveal is rendered with correct skip and preset Rive asset IDs",()=>{
 const view=makeScene({screen:"hatching",frame:hatchFrame(7000),care});
 assert.equal(view.nodes.find(x=>x.id==="sq-fx").source,"rive/hatch/crack");
 assert.equal(view.actions[0].id,"sq.skip");
});
test("hatch commits only on server before cinematic starts",async()=>{
 const calls=[]; let now=1000;
 const api={hatchEgg:async id=>{calls.push(id);return {...status,hatching:true,alreadyHatched:false}},
   getMonStatus:async()=>status,checkIncubation:async()=>({eggs:[]}),
   care:async()=>status,talk:async()=>({...status,reply:{caption:"Bet!"}})};
 const session=new SpecsSqueakletSession(api,()=>now);
 session.state.screen="ready";session.state.eggId="egg-1";
 assert.equal(await session.hatch(),true);
 assert.deepEqual(calls,["egg-1"]);
 assert.equal(session.state.screen,"hatching");
 now=15000;session.tick();assert.equal(session.state.screen,"hatching");
 now=16000;session.tick();assert.equal(session.state.screen,"pet");
 assert.equal(await session.hear("What's good?"),"Bet!");
});
test("MCP calls use bearer token and only tools/call",async()=>{
 const calls=[];
 const fake=async (url,options)=>{
  calls.push({url,options});
  return {ok:true,text:async()=>JSON.stringify({jsonrpc:"2.0",result:{structuredContent:status}})};
 };
 const result=await mcpCall({url:"https://example.test/mcp",token:"token",name:"feed_mon",fetcher:fake});
 assert.equal(result.care.energy,0.81);
 assert.equal(calls[0].options.headers.authorization,"Bearer token");
 const data=JSON.parse(calls[0].options.body);
 assert.equal(data.method,"tools/call");
 assert.equal(data.params.name,"feed_mon");
 await assert.rejects(()=>mcpCall({url:"http://insecure/mcp",token:"token",name:"feed_mon",fetcher:fake}));
});
test("gateway uses native care tools and refuses unauthorized commands",async()=>{
 const calls=[];
 const fake=async (_url,options)=>{
  const request=JSON.parse(options.body);calls.push(request.params.name);
  return {ok:true,text:async()=>JSON.stringify({jsonrpc:"2.0",result:{structuredContent:status}})};
 };
 const gateway=createSpecsGateway({mcpUrl:"https://example.test/mcp",fetcher:fake});
 const result=await gateway({action:"care",tool:"rest_mon"},"token");
 assert.equal(result.care.fullness,0.23);assert.deepEqual(calls,["rest_mon"]);
 await assert.rejects(()=>gateway({action:"care",tool:"delete_everything"},"token"));
 await assert.rejects(()=>gateway({action:"care",tool:"feed_mon"},""));
});
test("canonical voice restricts speech and full chat requires server key",async()=>{
 const fake=async()=>({ok:true,text:async()=>JSON.stringify({jsonrpc:"2.0",result:{structuredContent:{...status,say:{caption:"Chirp!"}}}})});
 const gateway=createSpecsGateway({mcpUrl:"https://example.test/mcp",fetcher:fake});
 const canon=await gateway({action:"turn",text:"Hi",voiceMode:"canon"},"token");
 assert.equal(canon.reply.caption,"Chirp!");
 await assert.rejects(()=>gateway({action:"turn",text:"Hi",voiceMode:"hackathon-chat"},"token"));
});

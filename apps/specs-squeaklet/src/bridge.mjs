/** Server-side bridge: never ship API keys in a Specs Lens bundle. */
import {voiceIntent} from "./specs.mjs";
export async function mcpCall({url,token,name,args={},fetcher=fetch}){
 if(!url?.startsWith("https://")||!token)throw Error("HTTPS and paired Caller OAuth token required");
 const response=await fetcher(url,{method:"POST",headers:{
  authorization:"Bearer "+token,"content-type":"application/json",
  accept:"application/json, text/event-stream","mcp-protocol-version":"2025-11-25"
 },body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}})});
 if(!response.ok)throw Error("MCP "+response.status);
 const body=await response.text();
 const line=body.trim().startsWith("{")?body:body.split("\n").filter(x=>x.startsWith("data: ")).at(-1)?.slice(6);
 if(!line)throw Error("No MCP result");
 const rpc=JSON.parse(line);
 if(rpc.error||rpc.result?.isError)throw Error("MCP tool refused the operation");
 const data=rpc.result?.structuredContent||rpc.result?.content?.find(x=>x.type==="text")?.text;
 const payload=typeof data==="string"?JSON.parse(data):data;
 if(!payload||typeof payload!=="object")throw Error("Invalid MCP result");
 return payload;
}
export function createSpecsGateway({mcpUrl,openAiKey,aiModel="gpt-4.1-mini",fetcher=fetch}){
 const call=(token,name,args)=>mcpCall({url:mcpUrl,token,name,args,fetcher});
 return async function handle(body,token){
  if(!token)throw Error("Pair the Caller first");
  if(body?.action==="get_mon_status"||body?.action==="check_incubation")
   return call(token,body.action,{});
  if(body?.action==="hatch_egg"){
   if(!body.eggId)throw Error("Egg ID missing");
   return call(token,"hatch_egg",{eggId:body.eggId});
  }
  if(body?.action==="care"){
   if(!["feed_mon","play_with_mon","rest_mon","wake_mon"].includes(body.tool))
    throw Error("Invalid care action");
   return call(token,body.tool,body.tool==="play_with_mon"?{quality:0.5}:{});
  }
  if(body?.action!=="turn"||typeof body.text!=="string"||!body.text.trim())
   throw Error("Invalid conversation turn");
  const intent=voiceIntent(body.text);
  if(["feed_mon","play_with_mon","rest_mon","wake_mon"].includes(intent))
   return call(token,intent,intent==="play_with_mon"?{quality:0.5}:{});
  if(intent==="get_mon_status")return call(token,intent,{});
  const status=await call(token,"talk_to_mon",{});
  if(body.voiceMode==="canon")return {...status,reply:{caption:status.say?.caption||"Chirp!"}};
  if(!openAiKey)throw Error("Server-only language model is not configured");
  const system="You are Squeaklet (NYC-MON dex-002), a friendly, confident, playful "+
   "Hood Ratti-line Mon. This isolated SPECS hackathon permits full-chat Baby speech, "+
   "unlike the main game's canonical 24-hour babble gate. Keep each reply under "+
   "two short sentences. You can say Callah occasionally. No caricature, stereotypes, "+
   "guilt, streaks, injury, death, or claims that care changed without a tool result. "+
   "Do not impersonate Malik's Ratti. Reply with the Mon's speech only.";
  const messages=[{role:"system",content:system}];
  for(const turn of (Array.isArray(body.history)?body.history:[]).slice(-8)){
   messages.push({role:"user",content:String(turn.caller||"").slice(0,250)});
   messages.push({role:"assistant",content:String(turn.reply||"").slice(0,250)});
  }
  messages.push({role:"user",content:body.text.slice(0,400)});
  const response=await fetcher("https://api.openai.com/v1/chat/completions",{
   method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+openAiKey},
   body:JSON.stringify({model:aiModel,messages,max_tokens:90,temperature:0.7})
  });
  if(!response.ok)throw Error("Conversation service unavailable");
  const data=await response.json();
  const reply=String(data.choices?.[0]?.message?.content||"").trim().slice(0,400);
  if(!reply)throw Error("Empty conversation reply");
  return {...status,reply:{caption:reply,text:reply},voiceDemoOnly:true};
 };
}

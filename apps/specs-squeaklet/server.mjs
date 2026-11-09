/** Local-only hackathon gateway; do not expose directly to Specs or the public Internet. */
import {createServer} from "node:http";
import {createSpecsGateway} from "./src/bridge.mjs";
const mcpUrl=process.env.NYCMON_MCP_URL;
if(!mcpUrl?.startsWith("https://"))throw Error("NYCMON_MCP_URL must be a real HTTPS /mcp resource");
const gateway=createSpecsGateway({mcpUrl,openAiKey:process.env.OPENAI_API_KEY,aiModel:process.env.SPECS_AI_MODEL||"gpt-4.1-mini"});
const host="127.0.0.1",port=Number(process.env.SPECS_PORT||8790);
createServer((req,res)=>{
 res.setHeader("content-type","application/json");
 res.setHeader("cache-control","no-store");
 if(req.method!=="POST"||req.url!=="/v1/specs/companion"){
  res.writeHead(404);res.end("{}");return;
 }
 const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
 let payload="";
 req.on("data",chunk=>{
  payload+=chunk.toString("utf8");
  if(payload.length>16384)req.destroy();
 });
 req.on("end",async()=>{
  try{
   const reply=await gateway(JSON.parse(payload),token);
   res.writeHead(200);res.end(JSON.stringify(reply));
  }catch(err){
   const status=token?502:401;
   res.writeHead(status);
   res.end(JSON.stringify({error:token?"request-unavailable":"pairing-required"}));
  }
 });
}).listen(port,host,()=>console.log("Specs local developer gateway "+host+":"+port+"; HTTPS proxy required"));

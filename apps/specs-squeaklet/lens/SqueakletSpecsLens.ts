/**
 * SPECS 27 native Lens Studio entrypoint. Hackathon branch only.
 * Place in Assets/ViroSpecsSqueaklet next to SqueakletLensScene and sync the
 * upstream viro-external Specs host under Assets/ViroSpecs/lens.
 * Native Lens ASR and InternetModule; no React Native, DOM or WebView.
 * AuthKit wearer-pairing and native TTS are explicit external adapters.
 */
import { ViroSpecsSceneControllerHost } from "../ViroSpecs/lens/ViroSpecsSceneControllerHost";
import { buildSqueakletLensScene, type Care, type View } from "./SqueakletLensScene";
const asr = require("LensStudio:AsrModule") as AsrModule;
type Gateway = {
 care?:Care; mood?:string; mon?:{name?:string|null;speciesId?:string};
 eggs?:{eggId:string;speciesId:string;readyToHatch:boolean;minutesRemaining:number}[];
 hatching?:boolean;alreadyHatched?:boolean;applied?:boolean;
 say?:{caption:string};reply?:{caption:string;text?:string};caption?:string;
};
@component
export class SqueakletSpecsLens extends BaseScriptComponent {
 @input sceneHostObject: SceneObject;
 @input internetModule: InternetModule;
 @input @hint("Your HTTPS Squeaklet gateway, no secrets in Lens") gatewayUrl:string="";
 @input reducedMotion:boolean=false;
 private host:ViroSpecsSceneControllerHost|null=null;
 private actionSub:{remove():void}|null=null;
 private token:string="";
 private screen:View["screen"]="loading";
 private care:Care|null=null;
 private caption:string="Pair your NYC-MON Caller account";
 private error:string="";
 private eggId:string="";
 private history:{caller:string;reply:string}[]=[];
 private hatchStart=0;
 private nextEggPoll=0;
 private lastFrame=-1;
 private busy=false;
 private listening=false;
 private speaking=false;
 private speakPort:((text:string,done:()=>void)=>void)|null=null;
 onAwake():void{
  this.createEvent("OnStartEvent").bind(()=>this.start());
  this.createEvent("UpdateEvent").bind(()=>this.tick());
  this.createEvent("OnDestroyEvent").bind(()=>this.dispose());
 }
 private start():void{
  this.host=this.sceneHostObject?.getComponent(ViroSpecsSceneControllerHost.getTypeName()) as ViroSpecsSceneControllerHost|null;
  if(!this.host?.isReady){console.error("[squeaklet-specs] Viro Specs host missing");return;}
  this.actionSub=this.host.addOnActionListener(e=>{void this.onAction(e.actionId);});
  this.render();
 }
 /** Called by a trusted pairing adapter. Do not persist this bearer token in Lens. */
 setPairedAccessToken(token:string):void{
  this.token=token.trim();
  if(this.token)void this.load();
  else {this.screen="error";this.error="Pair an adult Caller account";this.render();}
 }
 /** Snap Remote Service Gateway TTS implementation supplied by app integration. */
 setSpeakPort(port:(text:string,done:()=>void)=>void):void{this.speakPort=port;}
 private async request(action:string,fields:{[key:string]:unknown}={}):Promise<Gateway>{
  if(!this.token||!this.gatewayUrl.startsWith("https://"))throw Error("Verified Caller pairing and HTTPS required");
  const response=await this.internetModule.fetch(new Request(this.gatewayUrl,{
   method:"POST",headers:{authorization:"Bearer "+this.token,"content-type":"application/json"},
   body:JSON.stringify({action,...fields})
  }));
  if(!response.ok)throw Error("Specs gateway "+response.status);
  return await response.json() as Gateway;
 }
 private applyCare(result:Gateway):void{
  const care=result.care;
  if(!care||!["energy","fullness","social"].every(k=>{
   const v=(care as unknown as {[key:string]:number})[k];
   return Number.isFinite(v)&&v>=0&&v<=1;
  }))throw Error("Missing authoritative care snapshot");
  this.care=care;
 }
 private async load():Promise<void>{
  this.screen="loading";this.error="";this.caption="Checking on Squeaklet";this.render();
  try{const r=await this.request("get_mon_status");this.applyCare(r);
   if(r.mon?.speciesId && r.mon.speciesId!=="dex-002")throw Error("Active Mon is not dex-002");
   this.screen="pet";this.caption="Squeaklet is here!";this.render();return;
  }catch{}
  try{
   const r=await this.request("check_incubation");
   const egg=r.eggs?.find(x=>x.speciesId==="dex-001");
   if(!egg)throw Error("No egg");
   this.eggId=egg.eggId;this.screen=egg.readyToHatch?"ready":"incubating";
   this.nextEggPoll=Date.now()+30000;
   this.caption=egg.readyToHatch?"Pinch HATCH!":"Egg ready in "+egg.minutesRemaining+" minutes";
   this.render();
  }catch{this.screen="error";this.error="Connect a verified Caller account";this.render();}
 }
 private async pollIncubation():Promise<void>{
  if(this.busy || this.screen!=="incubating")return;
  this.busy=true;
  try{
   const response=await this.request("check_incubation");
   const egg=response.eggs?.find(x=>x.eggId===this.eggId && x.speciesId==="dex-001");
   if(!egg){this.error="Egg status unavailable. Check pairing.";return;}
   this.error="";
   this.screen=egg.readyToHatch?"ready":"incubating";
   this.caption=egg.readyToHatch?"Your egg is ready. Pinch HATCH!":"Hatch in "+egg.minutesRemaining+" minutes";
   this.render();
  }catch{
   this.caption="Egg status unavailable offline. Will retry.";
   this.render();
  }finally{this.busy=false;}
 }
 private async hatch():Promise<void>{
  if(this.screen!=="ready"||!this.eggId||this.busy)return;
  this.busy=true;this.caption="Confirming hatch...";this.render();
  try{
   // Server commits the unique Mon BEFORE the 15-second animation.
   const r=await this.request("hatch_egg",{eggId:this.eggId});
   this.applyCare(r);
   if(r.alreadyHatched||r.hatching===false){
    this.screen="pet";this.caption="Welcome back, Squeaklet!";
   }else{this.screen="hatching";this.hatchStart=Date.now();this.lastFrame=-1;this.caption="Something is moving...";}
  }catch{this.caption="Hatch not confirmed; pinch again to retry.";}
  finally{this.busy=false;this.render();}
 }
 private tick():void{
  if(this.screen==="incubating" && !this.busy && Date.now()>=this.nextEggPoll){
   this.nextEggPoll=Date.now()+30000;
   void this.pollIncubation();
   return;
  }
  if(this.screen!=="hatching")return;
  const elapsed=Date.now()-this.hatchStart;
  if(elapsed>=15000){this.screen="pet";this.caption="Meet Squeaklet!";this.render();return;}
  const frame=Math.floor(elapsed/100);
  if(frame!==this.lastFrame){this.lastFrame=frame;this.render();}
 }
 private async onAction(id:string):Promise<void>{
  if(id==="sq.hatch"){await this.hatch();return;}
  if(id==="sq.skip"){
   if(this.screen==="hatching"&&Date.now()-this.hatchStart>=2000){
    this.screen="pet";this.caption="Meet Squeaklet!";this.render();
   }return;
  }
  if(id==="sq.listen"){this.listen();return;}
  const tool=({"sq.feed":"feed_mon","sq.play":"play_with_mon",
   "sq.rest":"rest_mon","sq.wake":"wake_mon"} as {[key:string]:string})[id];
  if(!tool||this.busy||this.screen!=="pet")return;
  this.busy=true;
  try{const r=await this.request("care",{tool});this.applyCare(r);
   this.caption=r.say?.caption||(r.applied===false?"Squeaklet needs a moment.":"Squeaklet chirps!");
   this.render();this.speak(this.caption);
  }catch{this.caption="Care could not be confirmed. Try again.";this.render();}
  finally{this.busy=false;}
 }
 private listen():void{
  if(this.listening||this.speaking||this.busy||this.screen!=="pet")return;
  this.listening=true;this.caption="Listening...";this.render();
  const options=AsrModule.AsrTranscriptionOptions.create();
  options.silenceUntilTerminationMs=900;
  options.mode=AsrModule.AsrMode.HighAccuracy;
  options.onTranscriptionUpdateEvent.add((event:AsrModule.TranscriptionUpdateEvent)=>{
   if(event.isFinal&&event.text.trim()){
    this.listening=false;void asr.stopTranscribing().then(()=>this.hear(event.text));
   }
  });
  options.onTranscriptionErrorEvent.add((_status:AsrModule.AsrStatusCode)=>{
   this.listening=false;this.caption="Could not hear. Pinch TALK again.";this.render();
  });
  asr.startTranscribing(options);
 }
 private async hear(text:string):Promise<void>{
  if(this.busy||this.screen!=="pet")return;
  this.busy=true;this.caption="You: "+text.slice(0,100);this.render();
  try{
   const r=await this.request("turn",{text,history:this.history.slice(-8),voiceMode:"hackathon-chat"});
   if(r.care)this.applyCare(r);
   const reply=r.reply?.caption||r.say?.caption||r.caption||"Chirp!";
   this.history=[...this.history.slice(-7),{caller:text,reply}];
   this.caption=reply;this.render();this.speak(reply);
  }catch{this.caption="Connection interrupted. Pinch TALK to retry.";this.render();}
  finally{this.busy=false;}
 }
 private speak(text:string):void{
  if(!this.speakPort)return; // Captions are real; native speech needs the installed adapter.
  this.speaking=true;
  this.speakPort(text,()=>{this.speaking=false;});
 }
 private render():void{
  if(!this.host?.isReady)return;
  const elapsedMs=this.screen==="hatching"?Math.max(0,Date.now()-this.hatchStart):0;
  const scene=buildSqueakletLensScene({
   screen:this.screen,caption:this.caption,error:this.error,care:this.care,
   elapsedMs,reducedMotion:this.reducedMotion
  });
  if(!this.host.committedScene)this.host.present(scene);
  else this.host.update(scene);
 }
 private dispose():void{
  this.actionSub?.remove();this.actionSub=null;this.token="";this.speakPort=null;
  if(this.listening)void asr.stopTranscribing();
 }
}
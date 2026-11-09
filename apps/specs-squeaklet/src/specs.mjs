/** Hackathon-only Squeaklet scene logic for the Viro Specs Lens backend. */
export const SQUEAKLET=Object.freeze({
  speciesId:"dex-002",
  sourceId:"mon/squeaklet",
  glb:"https://admin.nyc-mon.city/v1/mon-models/glb/dex-002",
  clips:["jaw_chomp","mouth_close","rat_run","tail_swish","blink"],
  jaw:{bone:"jaw",closedRadians:0.357,openRadians:-0.15}
});
export const HATCH_BEATS=[
 ["stir",2200],["pressure",1700],["crack",3500],
 ["burst",800],["emerge",3300],["attention",3500]
];
export const HATCH_DURATION_MS=HATCH_BEATS.reduce((sum,beat)=>sum+beat[1],0);
export function hatchFrame(elapsedMs,reducedMotion=false){
 const elapsed=Math.max(0,Math.min(HATCH_DURATION_MS,Number.isFinite(elapsedMs)?elapsedMs:0));
 let offset=0;
 for(const [phase,duration] of HATCH_BEATS){
  if(elapsed<offset+duration){
   const progress=(elapsed-offset)/duration;
   return {phase,progress,elapsed,complete:false,reducedMotion,
    showEgg:!["emerge","attention"].includes(phase),
    showMon:["emerge","attention"].includes(phase),
    canSkip:elapsed>=2000,
    cracks:phase==="crack"?[.25,.55,.85].filter(x=>x<=progress).length:0,
    wobble:reducedMotion?0:phase==="stir"?Math.sin(progress*Math.PI*4)*.025:0,
    pressure:reducedMotion?1:phase==="pressure"?1+.035*Math.sin(progress*Math.PI):1};
  }
  offset+=duration;
 }
 return {phase:"complete",progress:1,elapsed:HATCH_DURATION_MS,complete:true,reducedMotion,
  showEgg:false,showMon:true,canSkip:true,cracks:3,wobble:0,pressure:1};
}
export function meter(value){
 if(!Number.isFinite(value)||value<0||value>1)throw Error("Invalid server-owned care meter");
 return {percent:Math.round(value*100),riveFrame:Math.round(value*10)*10};
}
export function careFromServer(result){
 if(!result?.care)throw Error("Missing authenticated care snapshot");
 for(const key of ["energy","fullness","social"])meter(result.care[key]);
 return {...result.care,mood:result.mood||"content"};
}
export function voiceIntent(input){
 const text=String(input||"").trim().toLowerCase();
 if(!text)return "none";
 if(/\b(don't|do not|never|shouldn't|should not)\b/.test(text))return "conversation";
 if(/\b(are you hungry|how hungry|status|how are you|your stats)\b/.test(text))return "get_mon_status";
 if(/\b(feed|give you food|share a meal|eat something)\b/.test(text))return "feed_mon";
 if(/\b(play|peek|let's play)\b/.test(text))return "play_with_mon";
 if(/\b(go to sleep|go to bed|take a nap|rest now)\b/.test(text))return "rest_mon";
 if(/\b(wake up)\b/.test(text))return "wake_mon";
 if(/\b(hatch the egg|hatch your egg)\b/.test(text))return "hatch_egg";
 return "conversation";
}
export function makeScene(state){
 const screen=state.screen,frame=state.frame||hatchFrame(0),care=state.care;
 const showEgg=["ready","incubating"].includes(screen)||(screen==="hatching"&&frame.showEgg);
 const showMon=screen==="pet"||(screen==="hatching"&&frame.showMon);
 const nodes=[
 {id:"sq-root",kind:"group",position:[0,0,-1.45]},
 {id:"sq-mon",kind:"model",parentId:"sq-root",label:"Squeaklet",source:SQUEAKLET.sourceId,format:"glb",
  position:[0,-.035,0],scale:[.23,.23,.23],visible:showMon},
 {id:"sq-egg",kind:"model",parentId:"sq-root",label:"Metro Egg",source:"mon/metro-egg",format:"glb",
  position:[frame.wobble,-.02,0],scale:[.21*frame.pressure,.21*frame.pressure,.21],visible:showEgg},
 {id:"sq-title",kind:"text",text:screen==="hatching"?"HATCHING":"SQUEAKLET",
  position:[0,.37,-1.2],style:{fontSize:120,color:"#febE80",fontWeight:"700"},extents:{width:.55,height:.06}},
 {id:"sq-caption",kind:"text",text:state.error||state.caption||"Squeaklet is here",
  position:[0,-.43,-1.2],style:{fontSize:110,color:"#f8f8f8"},extents:{width:.65,height:.12},maxLines:3}
 ];
 const actions=[],interactions=[];
 const button=(id,label,x,y,actionId)=>{
  nodes.push({id,kind:"text",label,text:label,position:[x,y,-1.12],
   style:{fontSize:107,fontWeight:"600",color:"#febE80"},extents:{width:.17,height:.055}});
  actions.push({id:actionId});interactions.push({nodeId:id,interactable:true,manipulation:false,events:["select"],
   triggers:[{on:"select",actionId}]});
 };
 if(screen==="ready")button("sq-hatch","HATCH",0,-.54,"sq.hatch");
 if(screen==="hatching"){
  nodes.push({id:"sq-progress",kind:"text",text:(frame.elapsed/1000).toFixed(1)+" / 15.0 s",
   position:[0,.29,-1.2],style:{fontSize:95,color:"#febE80"},extents:{width:.35,height:.04}});
  if(["crack","burst","emerge"].includes(frame.phase))nodes.push({id:"sq-fx",kind:"image",
   source:"rive/hatch/"+frame.phase,position:[0,-.06,-1.38],extents:{width:.52,height:.52}});
  if(frame.canSkip)button("sq-skip","SKIP",0,-.54,"sq.skip");
 }
 if(screen==="pet"&&care){
  button("sq-feed","FEED",-.255,-.54,"sq.feed");
  button("sq-play","PLAY",-.085,-.54,"sq.play");
  button("sq-rest",care.activity==="asleep"?"WAKE":"REST",.085,-.54,
   care.activity==="asleep"?"sq.wake":"sq.rest");
  button("sq-talk","TALK",.255,-.54,"sq.listen");
  for(const [index,key] of ["energy","fullness","social"].entries()){
   const x=(index-1)*.23,value=meter(care[key]);
   nodes.push({id:"sq-gauge-"+key,kind:"image",source:"rive/"+key+"/"+value.riveFrame,
    label:key+" "+value.percent+" percent",position:[x,-.28,-1.2],extents:{width:.11,height:.11}});
   nodes.push({id:"sq-label-"+key,kind:"text",text:key.toUpperCase()+" "+value.percent+"%",
    position:[x,-.37,-1.18],style:{fontSize:94,color:"#f8f8f8"},extents:{width:.22,height:.04}});
  }
 }
 return {version:2,route:"squeaklet",nodes,actions,interactions,materials:[],polylines:[],lights:[],animations:[]};
}
export class SpecsSqueakletSession{
 constructor(api,now=()=>Date.now(),reducedMotion=false){
  this.api=api;this.now=now;this.reducedMotion=reducedMotion;this.start=0;this.busy=false;
  this.state={screen:"loading",eggId:"",care:null,caption:"",error:"",frame:hatchFrame(0),history:[]};
 }
 async load(){
  try{this.state.care=careFromServer(await this.api.getMonStatus());this.state.screen="pet";}
  catch{
   const result=await this.api.checkIncubation();
   const egg=result.eggs?.find(x=>x.speciesId==="dex-001")||result.eggs?.[0];
   if(!egg)throw Error("No verified Mon or egg");
   this.state.eggId=egg.eggId;this.state.screen=egg.readyToHatch?"ready":"incubating";
  }
  return this.state;
 }
 async hatch(){
  if(this.busy||this.state.screen!=="ready"||!this.state.eggId)return false;
  this.busy=true;
  try{
   const result=await this.api.hatchEgg(this.state.eggId);
   this.state.care=careFromServer(result);
   this.state.screen=result.alreadyHatched?"pet":"hatching";
   this.start=this.now();this.state.frame=hatchFrame(0,this.reducedMotion);
   return true;
  }finally{this.busy=false;}
 }
 tick(){
  if(this.state.screen!=="hatching")return this.state;
  this.state.frame=hatchFrame(this.now()-this.start,this.reducedMotion);
  if(this.state.frame.complete){this.state.screen="pet";this.state.caption="Meet Squeaklet!";}
  return this.state;
 }
 skip(){
  if(this.state.screen==="hatching"&&this.state.frame.canSkip){
   this.state.screen="pet";this.state.frame=hatchFrame(HATCH_DURATION_MS,this.reducedMotion);
  }
 }
 async hear(text){
  if(this.busy||this.state.screen!=="pet"||!text.trim())return null;
  this.busy=true;
  try{
   const intent=voiceIntent(text);
   const result=intent==="conversation"?
    await this.api.talk(text,this.state.history.slice(-8)):
    intent==="get_mon_status"?await this.api.getMonStatus():
    await this.api.care(intent);
   if(result.care)this.state.care=careFromServer(result);
   const caption=result.reply?.caption||result.say?.caption||result.caption||"Chirp!";
   this.state.caption=caption;this.state.history=[...this.state.history.slice(-7),{caller:text,reply:caption}];
   return caption;
  }finally{this.busy=false;}
 }
}
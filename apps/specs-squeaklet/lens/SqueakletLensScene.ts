/** Plain Lens Studio TS; Viro Specs Protocol 2. No React Native or WebViews. */
export type Care = {energy:number;fullness:number;social:number;activity:"awake"|"asleep";wantsFood?:boolean};
export type View = {
 screen:"loading"|"incubating"|"ready"|"hatching"|"pet"|"error";
 caption:string;error:string;care:Care|null;
 elapsedMs:number;reducedMotion:boolean;
};
const beats:[string,number][]=[["stir",2200],["pressure",1700],["crack",3500],["burst",800],["emerge",3300],["attention",3500]];
function frame(elapsedMs:number,reducedMotion:boolean){
 const elapsed=Math.max(0,Math.min(15000,elapsedMs));
 let start=0;
 for(const [phase,duration] of beats){
  if(elapsed<start+duration){
   const progress=(elapsed-start)/duration;
   return {phase,elapsed,showEgg:phase!=="emerge"&&phase!=="attention",
    showMon:phase==="emerge"||phase==="attention",canSkip:elapsed>=2000,
    sway:reducedMotion?0:phase==="stir"?Math.sin(progress*Math.PI*4)*.025:0,
    swell:reducedMotion?1:phase==="pressure"?1+.035*Math.sin(progress*Math.PI):1};
  }
  start+=duration;
 }
 return {phase:"complete",elapsed:15000,showEgg:false,showMon:true,canSkip:true,sway:0,swell:1};
}
export function buildSqueakletLensScene(view:View){
 const f=frame(view.elapsedMs,view.reducedMotion);
 const showEgg=view.screen==="ready"||view.screen==="incubating"||(view.screen==="hatching"&&f.showEgg);
 const showMon=view.screen==="pet"||(view.screen==="hatching"&&f.showMon);
 const nodes:any[]=[
  {id:"sq-root",kind:"group",position:[0,0,-1.45]},
  {id:"sq-mon",kind:"model",parentId:"sq-root",label:"Squeaklet 3D Mon",
   source:"mon/squeaklet",format:"glb",position:[0,-.035,0],scale:[.23,.23,.23],visible:showMon},
  {id:"sq-egg",kind:"model",parentId:"sq-root",label:"Metro Egg",source:"mon/metro-egg",
   format:"glb",position:[f.sway,-.02,0],scale:[.21*f.swell,.21*f.swell,.21],visible:showEgg},
  {id:"sq-title",kind:"text",text:view.screen==="hatching"?"HATCHING":"SQUEAKLET",
   position:[0,.36,-1.2],extents:{width:.55,height:.06},
   style:{fontSize:120,fontWeight:"700",color:"#FEBE80"}},
  {id:"sq-caption",kind:"text",text:view.error||view.caption||"Pair a Caller account",
   position:[0,-.42,-1.2],extents:{width:.62,height:.12},maxLines:3,
   style:{fontSize:110,color:"#F8F8F8"}}
 ];
 const interactions:any[]=[];const actions:any[]=[];
 const btn=(id:string,label:string,x:number,actionId:string)=>{
  nodes.push({id,kind:"text",text:label,label,position:[x,-.54,-1.12],
   extents:{width:.17,height:.055},style:{fontSize:108,color:"#FEBE80",fontWeight:"600"}});
  actions.push({id:actionId});
  interactions.push({nodeId:id,interactable:true,manipulation:false,events:["select"],
   triggers:[{on:"select",actionId}]});
 };
 if(view.screen==="ready")btn("sq-hatch","HATCH",0,"sq.hatch");
 if(view.screen==="hatching"){
  nodes.push({id:"sq-progress",kind:"text",text:(f.elapsed/1000).toFixed(1)+" / 15.0 s",
   position:[0,.27,-1.2],extents:{width:.35,height:.04},
   style:{fontSize:95,color:"#FEBE80"}});
  if(["crack","burst","emerge"].includes(f.phase))nodes.push({
   id:"sq-rive-hatch",kind:"image",source:"rive/hatch/"+f.phase,
   position:[0,-.06,-1.38],extents:{width:.52,height:.52}
  });
  if(f.canSkip)btn("sq-skip","SKIP",0,"sq.skip");
 }
 if(view.screen==="pet"&&view.care){
  btn("sq-feed","FEED",-.255,"sq.feed");
  btn("sq-play","PLAY",-.085,"sq.play");
  btn("sq-rest",view.care.activity==="asleep"?"WAKE":"REST",.085,
   view.care.activity==="asleep"?"sq.wake":"sq.rest");
  btn("sq-talk","TALK",.255,"sq.listen");
  for(const [i,key] of ["energy","fullness","social"].entries()){
   const value=view.care[key as keyof Care] as number;
   const percent=Math.max(0,Math.min(100,Math.round(value*100)));
   const x=(i-1)*.23;
   nodes.push({id:"sq-gauge-"+key,kind:"image",source:"rive/"+key+"/"+(Math.round(percent/10)*10),
    label:key+" "+percent+" percent",position:[x,-.28,-1.2],
    extents:{width:.11,height:.11}});
   nodes.push({id:"sq-meter-"+key,kind:"text",text:key.toUpperCase()+" "+percent+"%",
    position:[x,-.36,-1.18],extents:{width:.22,height:.045},
    style:{fontSize:94,color:"#F8F8F8"}});
  }
 }
 return {version:2,route:"squeaklet",actions,nodes,interactions,animations:[],materials:[],lights:[],polylines:[]};
}
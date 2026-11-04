import { sourceFogSkyRing } from './source-sky-radiance.ts';
/** Pinned Valdrada 2724c79: saved graphics.json + final sky.js LB14/SH35/GH26/N11,
 * composed by weather.js. Linear RGB throughout; display grading belongs to post. */
export type SourceLookPreset = 'golden' | 'midday' | 'twilight' | 'midnight';
export type SourceRgb = readonly [number, number, number];
export interface SourceLookWeather {
  rain?: number; cloud?: number; snow?: number; flash?: number;
  /** Actual delivered SH-probe fade, never inferred from an environment map. */
  probeOn?: number; lampBounceK?: number; timeSquareDayK?: number;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const linear = (n: number) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
function rgb(hex: number): SourceRgb { return [linear((hex >> 16 & 255) / 255), linear((hex >> 8 & 255) / 255), linear((hex & 255) / 255)]; }
const mix = (a: SourceRgb, b: SourceRgb, t: number): SourceRgb => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const scale = (a: SourceRgb, k: number): SourceRgb => [a[0]*k,a[1]*k,a[2]*k];
const lum = (a: SourceRgb) => a[0]*.2126+a[1]*.7152+a[2]*.0722;
interface Row { mode: 'day'|'golden'|'dusk'|'night'; elev:number;azim:number;expo:number;night:number;env:number;sun:number;bnc:number;hemi:number;hemiC:number;fog:number;fogD:number;probeK:number;expoK:number;warmK:number;sunW:number;skyGain:number;skyHaze:number;nAmb:number;nGlow:number;nSkyGain:number; }
const fogRings = new Map<SourceLookPreset, readonly SourceRgb[]>();
const ROWS: Record<SourceLookPreset,Row> = {
 midday:{mode:'day',elev:42,azim:128,expo:.62,night:0,env:.264,sun:5,bnc:1.5,hemi:1.3,hemiC:0x9db9de,fog:0xcfd8e2,fogD:.000095,probeK:.34,expoK:.58,warmK:.35,sunW:.26,skyGain:.65,skyHaze:.35,nAmb:0,nGlow:0,nSkyGain:1},
 golden:{mode:'golden',elev:15,azim:205,expo:.76,night:.05,env:.20,sun:4,bnc:.9,hemi:.6,hemiC:0x8aa9d8,fog:0xe2b98e,fogD:.00013,probeK:.5,expoK:1,warmK:1,sunW:.55,skyGain:.7,skyHaze:0,nAmb:0,nGlow:0,nSkyGain:1},
 twilight:{mode:'dusk',elev:-3,azim:262,expo:.74,night:.55,env:.16,sun:1,bnc:1,hemi:.48,hemiC:0x9db9de,fog:0x3c3a44,fogD:.00014,probeK:1,expoK:1,warmK:1,sunW:0,skyGain:.9,skyHaze:0,nAmb:.34,nGlow:.45,nSkyGain:1},
 midnight:{mode:'night',elev:-14,azim:280,expo:.95,night:1,env:1,sun:1,bnc:0,hemi:.22,hemiC:0x202a3c,fog:0x241d17,fogD:.00012,probeK:1,expoK:1,warmK:1,sunW:0,skyGain:1,skyHaze:0,nAmb:1,nGlow:1,nSkyGain:.12},
};
/** Source defaults, not a substitute for the actual captured probe, sky/city PMREM or GI. */
export function resolveSourceLook(id: SourceLookPreset, weather: SourceLookWeather = {}) {
 const p=ROWS[id],w=clamp(weather.rain??0),snow=clamp(weather.snow??0),cl=Math.max(clamp(weather.cloud??.24),w*.8,snow*.7),flash=Math.max(0,weather.flash??0);
 const el=p.elev*Math.PI/180,az=p.azim*Math.PI/180,trans=Math.sqrt(Math.max(Math.sin(el),0));
 const sunDirection:SourceRgb=[Math.cos(el)*Math.sin(az),Math.sin(el),-Math.cos(el)*Math.cos(az)];
 const sunColor=mix(rgb(0xffb072),rgb(0xfffcf7),clamp(trans*1.3-p.sunW));
 const skyAmbient=p.night>.9 ? scale([.0125,.0135,.0178],1.15) : mix(rgb(0x1a2333),rgb(0x9db8d8),Math.max(trans,p.night>.5?.02:.15));
 let hemiSky=rgb(p.hemiC),hemiGround=rgb(p.mode==='night'?0x141210:0x6a5e49),hemiBase=p.hemi;
 const wall:SourceRgb=[sunColor[0]*.62,sunColor[1]*.50,sunColor[2]*.38],ground:SourceRgb=[sunColor[0]*.60,sunColor[1]*.53,sunColor[2]*.44];
 const norm=Math.max(...wall)||1;
 let bounceSky=scale(wall,1/norm),bounceGround=scale(ground,1/norm),bounceBase=.62*trans*(1-p.night)*p.bnc;
 if(p.nAmb>0){
  if(p.mode==='night'){hemiSky=rgb(0x646c7c);hemiGround=rgb(0x2e241a);hemiBase=0;}
  hemiBase+=.21*p.nAmb/Math.max(.0001,lum(hemiSky));
  bounceSky=rgb(0xffdcb6);bounceGround=rgb(0xdcbb9e);bounceBase=.25*p.nAmb/Math.max(.0001,lum(bounceSky));
 }
 const pOn=clamp(weather.probeOn??0)*.45,td=clamp(weather.timeSquareDayK??0);
 const dim=1-.62*w-.55*cl*(1-w)-.25*snow,n=clamp((p.night-.15)/.45),nB=n*n*(3-2*n);
 const bncDim=Math.max(.08,dim)*(1-nB)+(1+.22*cl)*nB;
 const d=Math.max(0,1-p.night/.35),day=Math.max(0,1-p.night/.05);
 const cloudNight=clamp(p.night/.6),cloudNightWeight=cloudNight*cloudNight*(3-2*cloudNight);
 const cloudBrightness=(1-.42*w)*(1-cloudNightWeight*.35);
 const cloudLit=scale(mix([1,1,1],scale(rgb(p.fog),1.6),cloudNightWeight),cloudBrightness);
 const result = {
  clouds:{visible:cl>.02,cover:Math.min(1,cl+w*.9+snow*.35),lit:cloudLit,flash,height:780},
  toneMapping:'agx' as const,sourceMode:p.mode,sunDirection,sunColor,skyAmbient,horizon:rgb(p.fog),night:p.night,
  /** Native adaptation: one correctly shadowed SunLight key across its two cascades,
   * rather than source's two independently lit keys with 88/12 intensity shares. */
  sunIntensity:3.4*trans*p.sun*1.8*Math.max(.12,dim),
  hemiSky,hemiGround,hemiIntensity:hemiBase*.46*(1+.35*w+.3*cl)*(1-.4*pOn)+flash*6,
  bounceSky,bounceGround,bounceIntensity:bounceBase*.8*bncDim*(1-.35*pOn)*(1+((weather.lampBounceK??1)-1)*nB)*(1+3*td),
  envIntensity:p.env*1.15*(1-.25*td),probeIntensity:.45*clamp(weather.probeOn??0)*p.probeK,
  probeFloor:p.nAmb>0 ? hemiSky.map((v,i)=>(.4*v*hemiBase+.35*bounceSky[i]!*bounceBase)/Math.PI) as unknown as SourceRgb : null,
  sceneFogDensity:p.fogD,
  fogDensity:p.fogD*(.00007/.00011)*(1+w*2.2+snow*3+cl*1.2),
  bloom:{strength:(.05+p.night*.25)*(1-.4*day)+flash*.9,radius:.26+p.night*.10-.14*day,threshold:2.30-p.night*1.45,smoothWidth:.01+2*clamp((p.night-.6)/.3),maxLuminance:p.night>.3?4:1e4},
  exposure:{base:p.expo*(.73/.74)*1.35*(1+.25*td),target:.20*p.expoK,min:p.mode==='day'?.35:.70,max:1.35,rate:p.mode==='day'?.25:.06,strength:p.mode==='day'?1:.65},
  grade:{contrast:p.mode==='golden'?.72:.5,saturation:(p.mode==='golden'?1.25:1.3)*(1-.18*cl-.12*snow),warmth:(p.mode==='golden'?.08:.05)*p.warmK+(p.mode==='day'?-.010:0),tint:0,vignette:.2,blackPoint:.008+.028*d,whitePoint:1-.03*d,grain:.05,chromaticAberration:.1,time:0,highlightLift:.12*day,definitionEdge:day,sharpness:.45,definition:.32,lut:p.mode==='golden'?'teal_orange':'none',lutAmount:p.mode==='golden'?.42:.7},
  sky:{turbidity:5,rayleigh:2.5,mieCoefficient:.004,mieDirectionalG:.95,gain:p.skyGain*p.nSkyGain,haze:p.skyHaze,nightGlow:p.nGlow},
 };
 let ring=fogRings.get(id);if(!ring){ring=sourceFogSkyRing(result);fogRings.set(id,ring);}
 const clear=Math.max(0,1-w*1.6-snow*1.6-cl*.8);
 return {...result,haze:{density:.00016*(1+w*2.5+snow*3+cl*1.6),falloff:.011,g:.6,sunBoost:(p.mode==='golden'?1.7:.7)*(p.mode==='day' ? .45 : 1)*(1-.85*cl)*Math.max(.15,dim),baseY:-25,skyAmount:0,glowMax:.9,blue:.85*clear,minTransmittance:.42*clear,ring,ringAmount:1}};
}
export type SourceLook = ReturnType<typeof resolveSourceLook>;

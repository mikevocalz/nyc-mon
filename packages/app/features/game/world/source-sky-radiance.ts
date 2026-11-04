/** CPU evaluation of the clear authored Sky185/SH35/TW36/N11 graph.
 * FS26 samples this dome with clouds disabled; this avoids adding a third GPU
 * readback owner merely to recover sixteen deterministic analytic values. */
type RGB=readonly[number,number,number];
interface ClearSky { sunDirection:RGB; sourceMode:string; sky:{turbidity:number;rayleigh:number;mieCoefficient:number;mieDirectionalG:number;gain:number;haze:number;nightGlow:number} }
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=(a:number,b:number,n:number)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
export function sourceClearSkyRadiance(look:ClearSky,dir:RGB):RGB{
 const sun=look.sunDirection,s=look.sky,mu=dir.reduce((n,v,i)=>n+v*sun[i]!,0);
 const sunE=1000*Math.max(0,1-Math.exp(-(1.6110731556870734-Math.acos(clamp(sun[1],-1,1)))/1.5));
 const fade=1-clamp(1-Math.exp(sun[1]/450000)),angle=Math.acos(Math.max(0,dir[1]));
 const inverse=1/(Math.cos(angle)+.15*(93.885-angle*180/Math.PI)**-1.253);
 const rPhase=.05968310365946075*(1+(mu*.5+.5)**2),g=s.mieDirectionalG;
 const mPhase=.07957747154594767*(1-g*g)/(1-2*g*mu+g*g)**1.5;
 const r=[5.804542996261093e-6,1.3562911419845635e-5,3.0265902468824876e-5];
 const m=[1.8399918514433978e14,2.7798023919660528e14,4.0790479543861094e14];
 const raw=r.map((v,i)=>{
  const br=v*(s.rayleigh-(1-fade)),bm=m[i]!*.434*(.2*s.turbidity)*1e-17*s.mieCoefficient;
  const ex=Math.exp(-(br*8400+bm*1250)*inverse),scatter=sunE*(br*rPhase+bm*mPhase)/(br+bm);
  const lin=(scatter*(1-ex))**1.5*mix(1,Math.sqrt(scatter*ex),clamp((1-sun[1])**5));
  const disc=smooth(.9999566769464484,.9999766769464484,mu);
  return (lin+.1*ex+sunE*19000*ex*disc)*.04+[0,.0003,.00075][i]!;
 });
 const luma=raw[0]!*.2126+raw[1]!*.7152+raw[2]!*.0722;
 const sl=Math.hypot(sun[0],sun[2]),dl=Math.hypot(dir[0],dir[2]);
 const toward=sl>1e-4&&dl>1e-4 ? (dir[0]*sun[0]+dir[2]*sun[2])/dl/sl*.5+.5 : .5,t3=toward**3;
 const tw=look.sourceMode==='dusk'?1:0,k=Math.exp(-Math.max(dir[1],0)*mix(4,9,t3));
 const az=Math.atan2(dir[2],dir[0]),h=clamp(dir[1],-.3,1),band=Math.exp(-Math.max(h,0)*6.5);
 const lobes=Math.max(.35,1+.30*Math.sin(az+.7)+.14*Math.sin(az*2-1.3));
 const under=mix(.55,1,smooth(-.3,.02,h));
 return raw.map((c,i)=>{
  const sh=mix(c,luma*[.90,1,1.16][i]!,s.haze)*s.gain;
  const hz=mix([.060,.090,.180][i]!,[.700,.250,.085][i]!,t3*t3);
  const twilight=mix([.015,.041,.123][i]!*(.85+.3*toward),hz,k)*tw*mix(.35,1,smooth(-.25,0,dir[1]));
  const night=mix([.0125,.0135,.0178][i]!,[.062,.048,.038][i]!,band)*s.nightGlow*lobes*under;
  return Math.min(5,sh+twilight+night);
 }) as unknown as RGB;
}
export function sourceFogSkyRing(look:ClearSky):readonly RGB[]{
 const ring:RGB[]=[];
 for(let sample=0;sample<16;sample++){
  const az=-Math.PI+(sample%8)/8*Math.PI*2,el=sample<8?.03:.2;
  let value=sourceClearSkyRadiance(look,[Math.cos(az)*Math.cos(el),Math.sin(el),Math.sin(az)*Math.cos(el)]);
  if(sample>=8){const cap=1.6*Math.max(...ring[sample-8]!,1e-4),max=Math.max(...value);if(max>cap)value=value.map(c=>c*cap/max) as unknown as RGB;}
  ring.push(value.map(c=>Math.max(0,c)) as unknown as RGB);
 }
 return ring;
}

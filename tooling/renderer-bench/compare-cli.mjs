import { readFileSync } from 'node:fs';
import { compareCaptures } from './compare.ts';

const [threePath,pixiPath]=process.argv.slice(2);
if(!threePath||!pixiPath){
  console.error('Usage: node tooling/renderer-bench/compare-cli.mjs three.json pixijs3d.json');
  process.exitCode=2;
}else{
  try{
    const three=JSON.parse(readFileSync(threePath,'utf8'));
    const pixi=JSON.parse(readFileSync(pixiPath,'utf8'));
    const result=compareCaptures(three,pixi);
    console.log(JSON.stringify({warning:'Self-reported hardware captures; independent GPU/visual review required',...result},null,2));
  }catch(error){
    console.error('No comparison:',error instanceof Error?error.message:String(error));
    process.exitCode=1;
  }
}

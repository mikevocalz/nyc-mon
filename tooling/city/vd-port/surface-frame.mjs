const finiteMatrix=(matrix,name)=>{if(!Array.isArray(matrix)||matrix.length!==16||!matrix.every(Number.isFinite)||matrix[3]!==0||matrix[7]!==0||matrix[11]!==0||matrix[15]!==1)throw new Error(`Missing finite affine source ${name}`);return matrix;};
export function multiplySourceMatrices(a,b){return Array.from({length:16},(_,index)=>{const col=Math.floor(index/4),row=index%4;let value=0;for(let axis=0;axis<4;axis++)value+=a[axis*4+row]*b[col*4+axis];return value;});}
export function inverseSourceMatrix(matrix){
 const m=finiteMatrix(matrix,'combined matrix'),[a,b,c,d,e,f,g,h,i]=[m[0],m[4],m[8],m[1],m[5],m[9],m[2],m[6],m[10]];
 const cofactor=[e*i-f*h,f*g-d*i,d*h-e*g,c*h-b*i,a*i-c*g,b*g-a*h,b*f-c*e,c*d-a*f,a*e-b*d],det=a*cofactor[0]+b*cofactor[1]+c*cofactor[2];
 if(!Number.isFinite(det)||det===0)throw new Error('Singular source combined frame');
 const inverse=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1];
 for(let col=0;col<3;col++)for(let row=0;row<3;row++)inverse[col*4+row]=cofactor[col*3+row]/det;
 for(let row=0;row<3;row++)inverse[12+row]=-(inverse[row]*m[12]+inverse[4+row]*m[13]+inverse[8+row]*m[14]);
 if(!inverse.every(Number.isFinite))throw new Error('Nonfinite source frame inverse');
 for(const product of[multiplySourceMatrices(m,inverse),multiplySourceMatrices(inverse,m)])if(product.some((value,index)=>Math.abs(value-(index%5===0?1:0))>1e-8))throw new Error('Source inverse identity residual exceeds1e-8');
 return inverse;
}
export function sourceFrameValues(frame){
 const combined=finiteMatrix(frame.combinedMatrix,'combined matrix'),mesh=finiteMatrix(frame.meshMatrixWorld,'mesh matrix'),instance=finiteMatrix(frame.instanceMatrix,'instance matrix');
 if(multiplySourceMatrices(mesh,instance).some((value,index)=>Math.abs(value-combined[index])>1e-8))throw new Error('Source mesh/instance combination mismatch');
 if(typeof frame.isInstanced!=='boolean'||!Array.isArray(frame.instanceTranslationXZ)||frame.instanceTranslationXZ.length!==2||!frame.instanceTranslationXZ.every(Number.isFinite))throw new Error('Source instance metadata missing');
 const {sx,sz,ox,oz}=frame.affine??{};
 if(![sx,sz,ox,oz,frame.baseY,frame.curb].every(Number.isFinite)||sx===0||sz===0)throw new Error('Source scene affine frame missing');
 const scene=[sx,0,0,0,0,1,0,0,0,0,sz,0,ox,frame.curb-frame.baseY,oz,1];
 const values={baseY:frame.baseY,curb:frame.curb,affine:[sx,sz,ox,oz],isInstanced:Number(frame.isInstanced),instanceTranslationXZ:[...frame.instanceTranslationXZ]};
 for(const[name,matrix]of[['combined',combined],['inverseCombined',inverseSourceMatrix(combined)],['meshWorld',mesh],['instanceMatrix',instance],['localToScene',multiplySourceMatrices(scene,combined)]])for(let col=0;col<4;col++)values[`${name}${col}`]=matrix.slice(col*4,col*4+4);
 return values;
}

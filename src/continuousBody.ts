import * as THREE from 'three';

/** Improves the segmented, INTERNAL Nia test rig only.
 * Produces continuous, smoothly skinned clothing and limbs while preserving
 * the existing 25-bone skeleton, animation clips and facial blendshapes.
 * It cannot reconstruct the owner's approved photorealistic likeness.
 */
type P=readonly [number,number,number,number,number];
type Key=readonly [number,ReadonlyArray<readonly [string,number]>];
export type Refinement={applied:boolean;created:number;hidden:number};

const oldBody=['Hips pelvis','Waist shirt','Chest shirt','Neck skin',
 'Left upper arm','Right upper arm','Left forearm','Right forearm',
 'Left shorts leg','Right shorts leg','Left thigh','Right thigh',
 'Left shin','Right shin'];
const torso:P[]=[[0,1.07,0,.165,.110],[0,1.15,0,.148,.112],[0,1.23,.008,.149,.119],
 [0,1.33,.012,.186,.142],[0,1.42,.016,.213,.145],[0,1.51,.002,.192,.124],[0,1.57,0,.108,.092]];
const hips:P[]=[[0,.86,0,.170,.135],[0,.94,0,.206,.145],[0,1.01,0,.207,.145],
 [0,1.10,0,.177,.125],[0,1.15,0,.158,.117]];
const neck:P[]=[[0,1.56,0,.065,.065],[0,1.62,0,.061,.062],[0,1.68,0,.062,.064],[0,1.715,0,.073,.072]];
const clamp=(x:number)=>Math.min(1,Math.max(0,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
const scaled=(list:P[],sign:number):P[]=>list.map(p=>[sign*p[0],p[1],p[2],p[3],p[4]]);
const K=(x:number,weights:ReadonlyArray<readonly [string,number]>):Key=>[x,weights];
function interpolate(keys:ReadonlyArray<Key>,t:number):Map<string,number>{
 for(let i=0;i<keys.length-1;i++){
  if(t>keys[i+1][0])continue;
  const [start,from]=keys[i],[end,to]=keys[i+1];
  const a=smooth((t-start)/Math.max(.00001,end-start)), result=new Map<string,number>();
  for(const [name,weight] of from)result.set(name,weight*(1-a));
  for(const [name,weight] of to)result.set(name,(result.get(name)||0)+weight*a);
  return result;
 }
 return new Map(keys[keys.length-1][1]);
}
function makeGeometry(profile:ReadonlyArray<P>,keys:ReadonlyArray<Key>,jointIndex:Map<string,number>){
 const rings=34,sides=24,verts:number[]=[],indices:number[]=[],js:number[]=[],ws:number[]=[];
 const centers:THREE.Vector3[]=[],rx:number[]=[],rz:number[]=[];
 for(let i=0;i<rings;i++){
  const u=i/(rings-1)*(profile.length-1);
  const j=Math.min(profile.length-2,Math.floor(u)),s=smooth(u-j);
  const a=profile[j],b=profile[j+1];
  const v=a.map((x,k)=>x*(1-s)+b[k]*s);
  centers.push(new THREE.Vector3(v[0],v[1],v[2]));rx.push(v[3]);rz.push(v[4]);
 }
 for(let i=0;i<rings;i++){
  const t=i/(rings-1),center=centers[i],tan=centers[Math.min(i+1,rings-1)].clone().sub(centers[Math.max(0,i-1)]);
  tan.normalize();
  const a=new THREE.Vector3().crossVectors(tan,new THREE.Vector3(0,0,1)).normalize();
  const b=new THREE.Vector3().crossVectors(tan,a).normalize();
  const weights=[...interpolate(keys,t)].filter(x=>x[1]>0).sort((x,y)=>y[1]-x[1]).slice(0,4);
  const total=weights.reduce((n,x)=>n+x[1],0);
  for(let side=0;side<sides;side++){
   const phi=2*Math.PI*side/sides;
   const point=center.clone().addScaledVector(a,rx[i]*Math.cos(phi)).addScaledVector(b,rz[i]*Math.sin(phi));
   verts.push(point.x,point.y,point.z);
   for(let k=0;k<4;k++){
    const weight=weights[k];js.push(weight?(jointIndex.get(weight[0])??0):0);ws.push(weight?weight[1]/total:0);
   }
  }
 }
 for(let i=0;i<rings-1;i++)for(let j=0;j<sides;j++){
  const u=i*sides+j,v=i*sides+(j+1)%sides,w=(i+1)*sides+j,x=(i+1)*sides+(j+1)%sides;
  indices.push(u,v,x,u,x,w);
 }
 const point=(i:number)=>new THREE.Vector3(verts[3*i],verts[3*i+1],verts[3*i+2]);
 const radial=point(0).sub(centers[0]);
 const normal=point(1).sub(point(0)).cross(point(sides).sub(point(0)));
 if(normal.dot(radial)<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(js,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(ws,4));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return geometry;
}
export function applyContinuousNiaBody(model:THREE.Object3D):Refinement{
 // GLTFLoader sanitizes spaces in node names, so match using a stable key.
 const normalized=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
 const lookup=new Map<string,THREE.Object3D>();
 model.traverse(node=>{lookup.set(normalized(node.name),node);});
 const get=(name:string)=>lookup.get(normalized(name));
 const old=get('Hips pelvis') as THREE.SkinnedMesh|undefined;
 if(!old?.isSkinnedMesh||!get('left shoulder seam')||
    get('Nia continuous fitted torso'))return {applied:false,created:0,hidden:0};
 const skin=old.skeleton;
 const joints=new Map<string,number>(skin.bones.map((bone,i)=>[bone.name,i]));
 const required=['Hips','Spine','Chest','UpperChest','Neck','Head',
  'LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand',
  'LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'];
 if(required.some(name=>!joints.has(name)))return {applied:false,created:0,hidden:0};
 const materials:Record<string,THREE.Material>={};
 for(const [key,nodeName] of Object.entries({skin:'Left upper arm',shirt:'Chest shirt',shorts:'Hips pelvis'})){
  const n=get(nodeName) as THREE.Mesh|undefined;
  if(!n?.isMesh)return {applied:false,created:0,hidden:0};
  materials[key]=(Array.isArray(n.material)?n.material[0]:n.material).clone();
 }
 const generated:THREE.SkinnedMesh[]=[];
 const add=(name:string,points:P[],material:'skin'|'shirt'|'shorts',keys:Key[])=>{
  const mesh=new THREE.SkinnedMesh(makeGeometry(points,keys,joints),materials[material].clone());
  mesh.name='Nia continuous '+name;
  mesh.bind(skin,old.bindMatrix.clone());
  mesh.bindMode=old.bindMode;mesh.bindMatrixInverse.copy(old.bindMatrixInverse);
  generated.push(mesh);
 };
 add('fitted torso',torso,'shirt',[
  K(0,[['Hips',.65],['Spine',.35]]),K(.26,[['Spine',.85],['Chest',.15]]),
  K(.62,[['Chest',.9],['UpperChest',.1]]),K(1,[['UpperChest',1]])]);
 add('hips and shorts',hips,'shorts',[
  K(0,[['Hips',1]]),K(.45,[['Hips',1]]),K(1,[['Hips',.75],['Spine',.25]])]);
 add('neck',neck,'skin',[
  K(0,[['UpperChest',.7],['Neck',.3]]),K(.6,[['Neck',1]]),K(1,[['Head',.8],['Neck',.2]])]);
 for(const [side,sign] of [['Left',-1],['Right',1]] as const){
  const arm=scaled([[.238,1.52,0,.075,.075],[.270,1.465,0,.079,.074],[.315,1.365,0,.081,.073],
   [.356,1.30,0,.065,.063],[.398,1.245,0,.06,.059],[.419,1.17,0,.058,.057],
   [.456,1.095,0,.051,.052],[.478,1.026,0,.044,.044]],sign);
  const sleeve=scaled([[.236,1.523,0,.084,.081],[.28,1.45,0,.086,.080],
   [.313,1.389,0,.085,.074],[.329,1.354,0,.081,.073]],sign);
  const leg=scaled([[.115,.821,0,.1,.098],[.115,.748,0,.104,.101],[.116,.66,0,.10,.099],
   [.119,.584,0,.082,.086],[.12,.553,0,.071,.074],[.12,.483,0,.078,.075],
   [.12,.374,0,.076,.074],[.119,.25,0,.069,.068],[.12,.151,0,.049,.051]],sign);
  const hem=scaled([[.108,.958,0,.111,.111],[.116,.88,0,.109,.112],
   [.116,.821,0,.107,.108],[.115,.779,0,.103,.105]],sign);
  add(side+' skin arm',arm,'skin',[
   K(0,[[side+'UpperArm',1]]),K(.27,[[side+'UpperArm',.96],[side+'LowerArm',.04]]),
   K(.56,[[side+'UpperArm',.36],[side+'LowerArm',.64]]),
   K(.82,[[side+'LowerArm',.94],[side+'Hand',.06]]),
   K(1,[[side+'LowerArm',.38],[side+'Hand',.62]])]);
  add(side+' shirt sleeve',sleeve,'shirt',[
   K(0,[['UpperChest',.6],[side+'UpperArm',.4]]),K(1,[[side+'UpperArm',1]])]);
  add(side+' skin leg',leg,'skin',[
   K(0,[[side+'UpperLeg',1]]),K(.33,[[side+'UpperLeg',.94],[side+'LowerLeg',.06]]),
   K(.55,[[side+'UpperLeg',.32],[side+'LowerLeg',.68]]),
   K(.82,[[side+'LowerLeg',1]]),K(1,[[side+'LowerLeg',.82],[side+'Foot',.18]])]);
  add(side+' shorts hem',hem,'shorts',[
   K(0,[['Hips',.58],[side+'UpperLeg',.42]]),K(1,[[side+'UpperLeg',1]])]);
 }
 let hidden=0;
 for(const name of oldBody){
  const obj=get(name);
  if(obj){obj.visible=false;hidden++;}
 }
 model.traverse(obj=>{
  if(normalized(obj.name).endsWith('seam')){
   if(obj.visible){obj.visible=false;hidden++;}
  }
 });
 for(const m of generated)model.add(m);
 for(const material of Object.values(materials))material.dispose();
 return {applied:true,created:generated.length,hidden};
}
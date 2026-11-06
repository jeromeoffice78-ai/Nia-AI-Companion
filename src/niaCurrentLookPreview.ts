import * as THREE from 'three';

/** Reference-driven COSMETIC TEST of the original Nia mannequin.
 * NEVER treat this procedural hairstyle as the approved photorealistic 3D likeness.
 * It runs only on the known bundled segmented rig and leaves imported models alone.
 */
export interface CurrentLookResult { applied:boolean; created:number; hidden:number; }
const key=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
function strand(points:THREE.Vector3[],thickness:number,material:THREE.Material){
 const path=new THREE.CatmullRomCurve3(points);
 return new THREE.Mesh(new THREE.TubeGeometry(path,22,thickness,6,false),material);
}
export function applyCurrentNiaLookPreview(model:THREE.Object3D):CurrentLookResult {
 const byName=new Map<string,THREE.Object3D>();
 model.traverse(node=>byName.set(key(node.name),node));
 const get=(name:string)=>byName.get(key(name));
 const head=get('Head');
 const hairCap=get('Hair cap');
 const face=get('Facial lip sync blendshape controls');
 const earring=get('Left hoop earring');
 if(!head||!hairCap||!face||!earring||get('Nia approved-look preview ponytail anchor'))
  return {applied:false,created:0,hidden:0};
 let hidden=0,created=0;
 // Preserve the existing face mesh, all blendshapes, 25-bone skeleton, clips,
 // original hoop earrings, white athletic top, gray shorts and sneakers.
 // Replace only the prototype's cluster-like crown curls.
 model.traverse(node=>{
  if(key(node.name).startsWith('haircrowncurl')&&node.visible){
   node.visible=false;hidden++;
  }
 });
 const dark=new THREE.MeshStandardMaterial({color:0x21171b,roughness:.86,metalness:0});
 const shadow=new THREE.MeshStandardMaterial({color:0x352326,roughness:.88,metalness:0});
 const highlight=new THREE.MeshStandardMaterial({color:0x503131,roughness:.85,metalness:0});
 const hairMaterials=[dark,shadow,highlight];
 const group=new THREE.Group();
 group.name='Nia approved-look preview ponytail anchor';
 head.add(group);
 const add=(name:string,points:THREE.Vector3[],thickness:number,material:THREE.Material)=>{
  const mesh=strand(points,thickness,material);
  mesh.name='Nia look preview '+name;
  group.add(mesh);created++;
 };
 const ponytailBase=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),dark);
 ponytailBase.name='Nia look preview ponytail base';
 ponytailBase.position.set(0,.25,-.095);
 ponytailBase.scale.set(.075,.062,.085);
 group.add(ponytailBase);created++;
 // High curly ponytail falls behind the shoulder line. Strands are bound to
 // the Head joint as a preview; final hair requires independent simulation.
 for(let i=0;i<22;i++){
  const phase=i*2.399963229728653;
  const spread=.026+.091*Math.sqrt((i+1)/22);
  const start=new THREE.Vector3(spread*Math.cos(phase),.24,-.12+spread*.45*Math.sin(phase));
  const points:THREE.Vector3[]=[];
  for(let s=0;s<=10;s++){
   const t=s/10;
   const coil=phase+15*t;
   const baseX=start.x+(.024+.036*t)*Math.sin(coil);
   const baseY=.24-.70*t+.015*Math.sin(coil*1.2);
   const baseZ=start.z-.057*t+(.018+.027*t)*Math.cos(coil);
   points.push(new THREE.Vector3(baseX,baseY,baseZ));
  }
  add('curly high ponytail strand '+i,points,.010+(i%4)*.0018,hairMaterials[i%3]);
 }
 // Soft hairline and two face-framing tendrils match the approved image
 // without replacing or pretending to recreate the underlying facial likeness.
 for(const side of [-1,1] as const){
  const pts=[
   new THREE.Vector3(side*.102,.18,.102),
   new THREE.Vector3(side*.12,.095,.122),
   new THREE.Vector3(side*.127,.035,.133),
   new THREE.Vector3(side*.117,-.035,.117),
   new THREE.Vector3(side*.126,-.097,.099)
  ];
  add(side<0?'left face-framing curl':'right face-framing curl',pts,.0075,shadow);
  add(side<0?'left swept baby-hair':'right swept baby-hair',[
   new THREE.Vector3(side*.037,.171,.142),
   new THREE.Vector3(side*.063,.166,.148),
   new THREE.Vector3(side*.084,.155,.140),
   new THREE.Vector3(side*.099,.142,.131)
  ],.0034,shadow);
 }
 return {applied:true,created,hidden};
}

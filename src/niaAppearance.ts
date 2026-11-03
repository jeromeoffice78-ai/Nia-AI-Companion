import * as THREE from 'three';

/** Reference-guided cosmetic refinement for the known INTERNAL Nia mannequin.
 * Not a photorealistic reconstruction and not an owner-approved likeness.
 * Applies only when the original mannequin hair and facial blendshape controls exist.
 */
export type AppearanceResult={applied:boolean;created:number;hidden:number};

const key=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
const colors={
 skin:'#c88e75',
 shirt:'#c986a0',
 shorts:'#bd7893',
 hair:'#35221f',
 iris:'#4d3026',
 lips:'#af586b'
} as const;
function tube(points:THREE.Vector3[],radius:number,material:THREE.Material){
 const curve=new THREE.CatmullRomCurve3(points);
 return new THREE.Mesh(new THREE.TubeGeometry(curve,30,radius,7,false),material);
}
export function applyNiaReferenceStyling(model:THREE.Object3D):AppearanceResult{
 const byName=new Map<string,THREE.Object3D>();
 model.traverse(node=>byName.set(key(node.name),node));
 const get=(name:string)=>byName.get(key(name));
 const head=get('Head');
 const chest=get('UpperChest');
 if(!head||!chest||!get('Hair cap')||!get('Facial lip sync blendshape controls')||
   get('Nia reference brunette bun'))return {applied:false,created:0,hidden:0};

 // Keep original facial morph targets, skeleton, and skin influences untouched.
 // Only change the prototype materials; a future approved GLB is never modified.
 model.traverse(object=>{
  const mesh=object as THREE.Mesh;
  if(!mesh.isMesh)return;
  for(const mat of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){
   if(!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial)continue;
   const m=mat as THREE.MeshStandardMaterial;
   const name=key(m.name);
   const set=(value:string,rough=.72)=>{
    m.color.set(value);m.roughness=rough;m.metalness=0;m.needsUpdate=true;
   };
   if(name.includes('warmbrownskin'))set(colors.skin,.82);
   else if(name.includes('fittedwhiteathletictop'))set(colors.shirt,.79);
   else if(name.includes('lightgrayathleticshorts'))set(colors.shorts,.85);
   else if(name.includes('blackhighcurlyponytail'))set(colors.hair,.9);
   else if(name.includes('darkbrownirises'))set(colors.iris,.36);
   else if(name.includes('naturalroselips'))set(colors.lips,.52);
  }
 });
 let hidden=0;
 model.traverse(object=>{
  const n=key(object.name);
  if(n==='haircap'||n.startsWith('haircrowncurl')||n==='lefthoopearring'||n==='righthoopearring'){
   if(object.visible){object.visible=false;hidden++;}
  }
 });

 const hairMaterial=new THREE.MeshStandardMaterial({name:'Nia brunette hair',color:colors.hair,roughness:.81,metalness:0});
 const strandMaterial=new THREE.MeshStandardMaterial({name:'Nia dark brunette strands',color:'#543329',roughness:.84});
 const gold=new THREE.MeshStandardMaterial({name:'Nia pendant gold',color:'#d8b273',metalness:.72,roughness:.26});
 const eyebrow=new THREE.MeshStandardMaterial({name:'Nia soft eyebrows',color:'#573429',roughness:.9});
 let created=0;
 const add=(name:string,parent:THREE.Object3D,mesh:THREE.Mesh)=>{
  mesh.name='Nia reference '+name;parent.add(mesh);created++;return mesh;
 };
 function ellipsoid(name:string,at:[number,number,number],size:[number,number,number],material:THREE.Material){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,28,18),material);
  mesh.position.set(...at);mesh.scale.set(...size);
  return add(name,head,mesh);
 }
 // Bone-relative coordinates: Head's bind origin is world y≈1.73.
 // More natural brunette high bun with face-framing loose strands.
 ellipsoid('brunette crown',[0,.173,-.039],[.131,.106,.127],hairMaterial);
 ellipsoid('brunette bun',[.027,.304,-.075],[.113,.104,.086],hairMaterial);
 for(const side of [-1,1]){
  const points=[
   new THREE.Vector3(side*.094,.225,.108),
   new THREE.Vector3(side*.116,.153,.126),
   new THREE.Vector3(side*.124,.079,.13),
   new THREE.Vector3(side*.119,.005,.122),
   new THREE.Vector3(side*.107,-.038,.116)
  ];
  add(side<0?'left face-framing lock':'right face-framing lock',head,tube(points,.008,strandMaterial));
  const brow=[
   new THREE.Vector3(side*.021,.118,.142),
   new THREE.Vector3(side*.042,.136,.151),
   new THREE.Vector3(side*.069,.130,.145),
   new THREE.Vector3(side*.087,.116,.133)
  ];
  add(side<0?'left shaped eyebrow':'right shaped eyebrow',head,tube(brow,.0034,eyebrow));
 }
 add('side-swept fringe',head,tube([
  new THREE.Vector3(-.115,.206,.078),
  new THREE.Vector3(-.064,.212,.131),
  new THREE.Vector3(.006,.176,.152),
  new THREE.Vector3(.066,.165,.142)
 ],.010,strandMaterial));
 // Fine high-bun hair texture without the original spherical curl clusters.
 for(let i=0;i<5;i++){
  const theta=(i/5)*Math.PI*1.65;
  add('bun strand '+i,head,tube([
    new THREE.Vector3(.027+.079*Math.cos(theta),.331,-.078+.059*Math.sin(theta)),
    new THREE.Vector3(.027+.04*Math.cos(theta+.6),.39,-.083+.040*Math.sin(theta+.6)),
    new THREE.Vector3(.027+.065*Math.cos(theta+1),.355,-.070+.02*Math.sin(theta+1))
  ],.0038,strandMaterial));
 }
 // Reference-inspired necklace. Attach to upper chest so animation follows
 // the skeleton rather than leaving a floating accessory in world coordinates.
 add('necklace chain',chest,tube([
  new THREE.Vector3(-.076,.143,.071),
  new THREE.Vector3(-.067,.097,.103),
  new THREE.Vector3(-.027,.067,.145),
  new THREE.Vector3(0,.060,.152),
  new THREE.Vector3(.027,.067,.145),
  new THREE.Vector3(.067,.097,.103),
  new THREE.Vector3(.076,.143,.071)
 ],.0027,gold));
 const pendant=add('heart pendant',chest,tube([
  new THREE.Vector3(0,.061,.157),
  new THREE.Vector3(-.014,.072,.157),
  new THREE.Vector3(-.022,.060,.16),
  new THREE.Vector3(0,.037,.16),
  new THREE.Vector3(.022,.060,.16),
  new THREE.Vector3(.014,.072,.157),
  new THREE.Vector3(0,.061,.157)
 ],.0024,gold));
 pendant.userData.purpose='Non-approved appearance test accessory';
 return {applied:true,created,hidden};
}

import Renderer from 'expo-three/build/Renderer';
import {Asset} from 'expo-asset';
import {File} from 'expo-file-system';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import {VisemeCue,visemeAt,mouthOpenForViseme,validateVisemes} from './visemes';

/**
 * Load a bundled GLB into the Nia OpenGL scene.
 * Uses the bundled animated GLB asset from src/niaModel.ts.
 * Android CI replaces the prototype with the approved skeletal GLB before packaging.
 */
export async function mountNiaGLB(gl:any, assetModule:number|string) {
 const renderer=new Renderer({gl});
 renderer.setSize(gl.drawingBufferWidth,gl.drawingBufferHeight);
 const scene=new THREE.Scene();
 scene.background=new THREE.Color(0x241b31);
 scene.add(new THREE.HemisphereLight(0xffffff,0x554466,2.5));
 const light=new THREE.DirectionalLight(0xffffff,2);
 light.position.set(3,5,4);scene.add(light);
 const camera=new THREE.PerspectiveCamera(45,gl.drawingBufferWidth/gl.drawingBufferHeight,0.1,100);
 camera.position.set(0,1.25,4.5);
 let loaded:any;
 try{
  let uri:string;
  if(typeof assetModule==='number'){
   const asset=Asset.fromModule(assetModule);await asset.downloadAsync();
   if(!asset.localUri)throw new Error('Bundled avatar could not be loaded');
   uri=asset.localUri;
  }else{uri=assetModule;}
  const file=new File(uri);
  if(file.size>25*1024*1024)throw new Error('Avatar exceeds 25 MB limit');
  const bytes=await file.arrayBuffer();
  const view=new DataView(bytes);
  if(bytes.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(8,true)!==bytes.byteLength)throw new Error('Invalid binary GLB');
  const length=view.getUint32(12,true);
  const metadata=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
  if([...(metadata.buffers||[]),...(metadata.images||[])].some(item=>item.uri))throw new Error('Use a self-contained GLB with embedded resources');
  loaded=await new GLTFLoader().parseAsync(bytes,'');
 }catch(error){renderer.dispose();throw error;}
 const model:THREE.Object3D=loaded.scene||loaded;
 // Bundled GLB is already Y-up; do not rotate it.
 scene.add(model);
 const clips:THREE.AnimationClip[]=loaded.animations||[];
 const mixer=new THREE.AnimationMixer(model);
 const leftArm=model.getObjectByName('leftArm');
 const rightArm=model.getObjectByName('rightArm');
 const leftLeg=model.getObjectByName('leftLeg');
 const rightLeg=model.getObjectByName('rightLeg');
 const head=model.getObjectByName('head');
 const rigged=!!model.getObjectByName('Hips')&&!!model.getObjectByName('Head');
 const headBone=model.getObjectByName('Head');
 const spineBone=model.getObjectByName('Spine')||model.getObjectByName('Spine2');
 const jawBone=model.getObjectByName('Jaw')||model.getObjectByName('jaw');
 const headRest=headBone?.rotation.clone();
 const spineRest=spineBone?.rotation.clone();
 const jawRest=jawBone?.rotation.clone();
 const faceMeshes:THREE.Mesh[]=[];
 let skinnedMeshes=0;
 let boneCount=0;
 const morphNames=new Set<string>();
 model.traverse(o=>{
  if(o instanceof THREE.SkinnedMesh){skinnedMeshes++;boneCount=Math.max(boneCount,o.skeleton.bones.length);}
  if(o instanceof THREE.Mesh&&o.morphTargetDictionary){faceMeshes.push(o);Object.keys(o.morphTargetDictionary).forEach(name=>morphNames.add(name));}
 });
 // Convert independently positioned meshes into pivoted joints.
 // A pivot at the shoulder/hip rotates the entire limb around its attachment,
 // rather than spinning an ellipsoid around its own centre.
 function joint(mesh:THREE.Object3D|undefined,anchor:THREE.Vector3){
  if(!mesh)return undefined;
  const parent=mesh.parent;
  if(!parent)return undefined;
  const pivot=new THREE.Group();
  pivot.position.copy(anchor);
  parent.add(pivot);
  pivot.attach(mesh); // preserves world transform while reparenting
  return pivot;
 }
 model.updateMatrixWorld(true);
 const leftShoulder=rigged?undefined:joint(leftArm,new THREE.Vector3(-0.29,1.52,0));
 const rightShoulder=rigged?undefined:joint(rightArm,new THREE.Vector3(0.29,1.52,0));
 const leftHip=rigged?undefined:joint(leftLeg,new THREE.Vector3(-0.15,0.88,0));
 const rightHip=rigged?undefined:joint(rightLeg,new THREE.Vector3(0.15,0.88,0));
 const neck=rigged?undefined:joint(head,new THREE.Vector3(0,1.69,0));
 let selected:'Idle'|'Walk'|'Dance'|'Wave'='Idle';
 let blend=0;
 let waveBlend=0;
 let speechLevel=0;
 let blinkAt=2.5;
 let blinkStart=-1;
 let speaking=false;
 let cues:VisemeCue[]=[];
 let cueStartedAt=0;
 // Face details are parented to the head mesh, so they follow head motion.
 const eyes:THREE.Mesh[]=[];
 let mouth:THREE.Mesh|null=null;
 if(head&&!rigged){
  const eyeMaterial=new THREE.MeshStandardMaterial({color:0x191018});
  const mouthMaterial=new THREE.MeshStandardMaterial({color:0x5a2331});
  for(const x of [-0.055,0.055]){
   const eye=new THREE.Mesh(new THREE.SphereGeometry(0.12,12,8),eyeMaterial);
   // The head mesh is scaled by its parent node; positions here are local.
   eye.position.set(x/0.145,0.15,0.97);
   eye.scale.set(0.14,0.09,0.12);
   head.add(eye);eyes.push(eye);
  }
  mouth=new THREE.Mesh(new THREE.SphereGeometry(0.13,12,8),mouthMaterial);
  mouth.position.set(0,-0.37,0.99);
  mouth.scale.set(0.45,0.10,0.12);
  head.add(mouth);
 }
 let activeAction:THREE.AnimationAction|null=null;
 function play(name:'Idle'|'Walk'|'Dance'|'Wave'){
  const clip=clips.find(c=>c.name===(rigged?name:(name==='Wave'?'Idle':name)));
  if(rigged&&name==='Wave'&&!clip)return false;
  if(!clip)return false;
  selected=name;
  const action=mixer.clipAction(clip);
  activeAction?.fadeOut(0.25);
  action.reset().fadeIn(0.25).play();
  activeAction=action;
  return true;
 }
 play('Idle');
 const clock=new THREE.Clock();
 let active=true,paused=false,frame=0;
 function tick(){
  if(!active)return;
  frame=requestAnimationFrame(tick);
  const elapsed=clock.getDelta();
  if(paused)return;
  mixer.update(elapsed);
  const t=clock.elapsedTime;
  const delta=Math.min(elapsed,0.05);
  const easing=Math.min(1,delta*5);
  blend+=(Number(selected==='Dance')-blend)*easing;
  waveBlend+=(Number(selected==='Wave')-waveBlend)*easing;
  const swing=Math.sin(t*4.2);
  if(leftShoulder)leftShoulder.rotation.z=0.06+blend*0.6*swing;
  if(rightShoulder){
   rightShoulder.rotation.z=-0.06-blend*0.6*Math.sin(t*4.2+0.7)-waveBlend*1.8;
   rightShoulder.rotation.x=waveBlend*0.3*Math.sin(t*8);
  }
  if(leftHip)leftHip.rotation.x=blend*0.32*Math.sin(t*3.4);
  if(rightHip)rightHip.rotation.x=-blend*0.32*Math.sin(t*3.4);
  if(neck){neck.rotation.y=0.08*Math.sin(t*0.8);neck.rotation.z=0.035*Math.sin(t*0.55);}
  // Add small lifelike secondary motion to rigged characters as well as prototype pivots.
  if(headBone&&headRest){headBone.rotation.y+=0.025*Math.sin(t*0.8);headBone.rotation.z+=0.012*Math.sin(t*0.55);}
  if(spineBone&&spineRest){spineBone.rotation.x+=0.008*Math.sin(t*1.5);spineBone.rotation.z+=0.015*Math.sin(t*0.6);}
  if(jawBone&&jawRest&&speaking&&!cues.length){jawBone.rotation.x+=0.08*(0.5+0.5*Math.sin(t*11));}
  if(t>=blinkAt&&blinkStart<0){blinkStart=t;blinkAt=t+2.6+1.2*(0.5+0.5*Math.sin(t*3.1));}
  const blink=blinkStart<0?0:Math.max(0,Math.sin(Math.PI*Math.min(1,(t-blinkStart)/0.16)));
  if(blinkStart>=0&&t-blinkStart>0.16)blinkStart=-1;
  for(const eye of eyes)eye.scale.y=0.09*(1-0.93*blink);
  speechLevel+=(Number(speaking)-speechLevel)*Math.min(1,delta*9);
  const visemeLevel=cues.length?mouthOpenForViseme(visemeAt(cues,(t-cueStartedAt)*1000)):null;
  if(mouth)mouth.scale.y=0.10+speechLevel*0.19*(visemeLevel??(0.45+0.35*Math.sin(t*11)));
  // Prefer true GLB facial blendshapes when the rig provides them.
  const viseme= cues.length?visemeAt(cues,(t-cueStartedAt)*1000):'sil';
  const mapped:Record<string,string>={PP:'viseme_MBP',FF:'viseme_FV',aa:'viseme_AA',E:'viseme_EE',ih:'viseme_EE',oh:'viseme_OH',ou:'viseme_OH',nn:'viseme_L',DD:'viseme_L',RR:'viseme_OH'};
  const target=cues.length&&speaking?(viseme==='sil'?null:(mapped[viseme]||'viseme_AA')):(speaking?'viseme_AA':null);
  const fallbackLevel=visemeLevel??(0.35+0.25*Math.sin(t*11));
  for(const mesh of faceMeshes){
   const dictionary=mesh.morphTargetDictionary||{};
   const influences=mesh.morphTargetInfluences;
   if(!influences)continue;
   for(const [key,index] of Object.entries(dictionary)){
    const isBlink=key==='blinkLeft'||key==='blinkRight';
    const wanted=isBlink?blink:(speaking&&target!==null&&key===target?(fallbackLevel??0):0);
    influences[index]+=(wanted-influences[index])*Math.min(1,delta*18);
   }
  }
  renderer.render(scene,camera);
  gl.endFrameEXP();
 }
 tick();
 return {diagnostics:{rigged,skinnedMeshes,boneCount,morphTargets:[...morphNames],animations:clips.map(c=>c.name)},play,setSpeaking(value:boolean){speaking=value;if(!value)cues=[]},setActive(value:boolean){paused=!value;clock.getDelta();},setVisemes(value:VisemeCue[]){cues=validateVisemes(value);cueStartedAt=clock.elapsedTime},dispose(){
  active=false;cancelAnimationFrame(frame);mixer.stopAllAction();
  scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){for(const value of Object.values(mat)){if(value instanceof THREE.Texture)value.dispose();}mat.dispose();}}});
  renderer.dispose();
 }};
}


import {Renderer} from 'expo-three';
import {Asset} from 'expo-asset';
import {File} from 'expo-file-system';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import {VisemeCue,visemeAt,mouthOpenForViseme,validateVisemes} from './visemes';
import {computeBodyPose,REQUIRED_BODY_BONES} from './rigMotion';

/**
 * Load a bundled GLB into the Nia OpenGL scene.
 * Uses the bundled animated GLB asset from src/niaModel.ts.
 * Android CI replaces the prototype with the approved skeletal GLB before packaging.
 */
export async function mountNiaGLB(gl:any, assetModule:number|string) {
 let stage='renderer';
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
  stage='resolve asset';
  let uri:string;
  if(typeof assetModule==='number'){
   const asset=Asset.fromModule(assetModule);await asset.downloadAsync();
   if(!asset.localUri)throw new Error('Bundled avatar could not be loaded');
   uri=asset.localUri;
  }else{uri=assetModule;}
  stage='read GLB file';
  const file=new File(uri);
  if(file.size>25*1024*1024)throw new Error('Avatar exceeds 25 MB limit');
  const bytes=await file.arrayBuffer();
  stage='validate GLB';
  const view=new DataView(bytes);
  if(bytes.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(8,true)!==bytes.byteLength)throw new Error('Invalid binary GLB');
  const length=view.getUint32(12,true);
  const metadata=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
  if([...(metadata.buffers||[]),...(metadata.images||[])].some(item=>item.uri))throw new Error('Use a self-contained GLB with embedded resources');
  stage='parse GLB';
  loaded=await new GLTFLoader().parseAsync(bytes,'');
 }catch(error){renderer.dispose();const message=error instanceof Error?error.message:String(error);throw new Error('Nia GLB '+stage+': '+message,{cause:error});}
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
 const jawBone=model.getObjectByName('Jaw')||model.getObjectByName('jaw');
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
 // Preserve each GLB bone's bind/rest pose and let the mixer animate the
 // authored clips. Motion offsets are layered onto currently unanimated
 // joints, including hips, chest, knees, elbows, ankles, and hands.
 const bodyRig=new Map<string,{node:THREE.Object3D;rotation:THREE.Euler;position:THREE.Vector3}>();
 for(const name of REQUIRED_BODY_BONES){
  const bone=model.getObjectByName(name);
  if(bone)bodyRig.set(name,{node:bone,rotation:bone.rotation.clone(),position:bone.position.clone()});
 }
 const bodyOffsets=new Map<string,[number,number,number]>();
 const rootHipsOffset=[0,0,0];
 function animateBody(time:number,dt:number){
  if(!rigged)return;
  const pose=computeBodyPose(selected,time);
  const alpha=Math.min(1,Math.max(0,dt)*8);
  for(const [name,angles] of Object.entries(pose.rotations)){
   const b=bodyRig.get(name);
   if(!b)continue;
   const previous=bodyOffsets.get(name)||[0,0,0];
   const current:[number,number,number]=[
    previous[0]+(angles[0]-previous[0])*alpha,
    previous[1]+(angles[1]-previous[1])*alpha,
    previous[2]+(angles[2]-previous[2])*alpha
   ];
   bodyOffsets.set(name,current);
   // The original glTF clips already key these thigh quaternions, and
   // own their Y/Z angles. Add only sagittal swing rather than replacing
   // the authored animation.
   if(name==='LeftUpperLeg'||name==='RightUpperLeg'){
    b.node.rotation.x=b.rotation.x+current[0];
   }else{
    b.node.rotation.set(b.rotation.x+current[0],b.rotation.y+current[1],b.rotation.z+current[2]);
   }
  }
  const hips=bodyRig.get('Hips');
  if(hips){
   for(let i=0;i<3;i++)rootHipsOffset[i]+=(pose.hips[i]-rootHipsOffset[i])*alpha;
   hips.node.position.set(hips.position.x+rootHipsOffset[0],hips.position.y+rootHipsOffset[1],hips.position.z+rootHipsOffset[2]);
  }
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
  if(!active||paused)return;
  frame=requestAnimationFrame(tick);
  const elapsed=clock.getDelta();
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
  // Drive actual skeletal joints through the complete motion cycle.
  animateBody(t,delta);
  if(jawBone&&jawRest&&cues.length&&speaking){jawBone.rotation.x=jawRest.x+0.08*mouthOpenForViseme(visemeAt(cues,(t-cueStartedAt)*1000));}
  else if(jawBone&&jawRest){jawBone.rotation.x=jawRest.x;}
  if(t>=blinkAt&&blinkStart<0){blinkStart=t;blinkAt=t+2.6+1.2*(0.5+0.5*Math.sin(t*3.1));}
  const blink=blinkStart<0?0:Math.max(0,Math.sin(Math.PI*Math.min(1,(t-blinkStart)/0.16)));
  if(blinkStart>=0&&t-blinkStart>0.16)blinkStart=-1;
  for(const eye of eyes)eye.scale.y=0.09*(1-0.93*blink);
  speechLevel+=(Number(speaking)-speechLevel)*Math.min(1,delta*9);
  const visemeLevel=cues.length?mouthOpenForViseme(visemeAt(cues,(t-cueStartedAt)*1000)):null;
  if(mouth)mouth.scale.y=0.10+speechLevel*0.19*(visemeLevel??0);
  // Prefer true GLB facial blendshapes when the rig provides them.
  const viseme= cues.length?visemeAt(cues,(t-cueStartedAt)*1000):'sil';
  const mapped:Record<string,string>={PP:'viseme_MBP',FF:'viseme_FV',aa:'viseme_AA',E:'viseme_EE',ih:'viseme_EE',oh:'viseme_OH',ou:'viseme_OH',nn:'viseme_L',DD:'viseme_L',RR:'viseme_OH'};
  const target=cues.length&&speaking?(viseme==='sil'?null:(mapped[viseme]||'viseme_AA')):null;
  const fallbackLevel=visemeLevel??0;
  for(const mesh of faceMeshes){
   const dictionary=mesh.morphTargetDictionary||{};
   const influences=mesh.morphTargetInfluences;
   if(!influences)continue;
   for(const [key,index] of Object.entries(dictionary)){
    const isBlink=key==='blinkLeft'||key==='blinkRight';
    // Preserve expression morphs driven by imported clips or other animation systems.
    if(!isBlink&&!key.startsWith('viseme_'))continue;
    const wanted=isBlink?blink:(speaking&&target!==null&&key===target?fallbackLevel:0);
    influences[index]+=(wanted-influences[index])*Math.min(1,delta*18);
   }
  }
  renderer.render(scene,camera);
  gl.endFrameEXP();
 }
 tick();
 return {diagnostics:{rigged,skinnedMeshes,boneCount,morphTargets:[...morphNames],animations:clips.map(c=>c.name)},play,setSpeaking(value:boolean){speaking=value;if(!value)cues=[]},setActive(value:boolean){
   if(!active)return;
   const wasPaused=paused;
   paused=!value;
   if(paused){cancelAnimationFrame(frame);clock.stop();}
   else if(wasPaused){clock.start();tick();}
  },setVisemes(value:VisemeCue[]){cues=validateVisemes(value);cueStartedAt=clock.elapsedTime},dispose(){
  active=false;cancelAnimationFrame(frame);mixer.stopAllAction();
  scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){for(const value of Object.values(mat)){if(value instanceof THREE.Texture)value.dispose();}mat.dispose();}}});
  renderer.dispose();
 }};
}


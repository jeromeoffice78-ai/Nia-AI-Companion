import {Renderer,loadAsync} from 'expo-three';
import * as THREE from 'three';
import {VisemeCue,visemeAt,mouthOpenForViseme,validateVisemes} from './visemes';

/**
 * Load a bundled GLB into the Nia OpenGL scene.
 * Uses the bundled animated GLB asset from src/niaModel.ts.
 * This model has Idle and Dance animations but no skeletal rig.
 */
export async function mountNiaGLB(gl:any, assetModule:number) {
 const renderer=new Renderer({gl});
 renderer.setSize(gl.drawingBufferWidth,gl.drawingBufferHeight);
 const scene=new THREE.Scene();
 scene.background=new THREE.Color(0x241b31);
 scene.add(new THREE.HemisphereLight(0xffffff,0x554466,2.5));
 const light=new THREE.DirectionalLight(0xffffff,2);
 light.position.set(3,5,4);scene.add(light);
 const camera=new THREE.PerspectiveCamera(45,gl.drawingBufferWidth/gl.drawingBufferHeight,0.1,100);
 camera.position.set(0,1.25,4.5);
 const loaded:any=await loadAsync(assetModule);
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
 const leftShoulder=joint(leftArm,new THREE.Vector3(-0.29,1.52,0));
 const rightShoulder=joint(rightArm,new THREE.Vector3(0.29,1.52,0));
 const leftHip=joint(leftLeg,new THREE.Vector3(-0.15,0.88,0));
 const rightHip=joint(rightLeg,new THREE.Vector3(0.15,0.88,0));
 const neck=joint(head,new THREE.Vector3(0,1.69,0));
 let selected:'Idle'|'Dance'|'Wave'='Idle';
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
 if(head){
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
 function play(name:'Idle'|'Dance'|'Wave'){
  selected=name;
  const clip=clips.find(c=>c.name===(name==='Wave'?'Idle':name));
  if(!clip)return false;
  const action=mixer.clipAction(clip);
  activeAction?.fadeOut(0.25);
  action.reset().fadeIn(0.25).play();
  activeAction=action;
  return true;
 }
 play('Idle');
 const clock=new THREE.Clock();
 let active=true,frame=0;
 function tick(){
  if(!active)return;
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
  if(t>=blinkAt&&blinkStart<0){blinkStart=t;blinkAt=t+2.6+1.2*(0.5+0.5*Math.sin(t*3.1));}
  const blink=blinkStart<0?0:Math.max(0,Math.sin(Math.PI*Math.min(1,(t-blinkStart)/0.16)));
  if(blinkStart>=0&&t-blinkStart>0.16)blinkStart=-1;
  for(const eye of eyes)eye.scale.y=0.09*(1-0.93*blink);
  speechLevel+=(Number(speaking)-speechLevel)*Math.min(1,delta*9);
  const visemeLevel=cues.length?mouthOpenForViseme(visemeAt(cues,(t-cueStartedAt)*1000)):null;
  if(mouth)mouth.scale.y=0.10+speechLevel*0.19*(visemeLevel===null?(0.25+0.75*Math.abs(Math.sin(t*12))):visemeLevel);
  renderer.render(scene,camera);
  gl.endFrameEXP();
 }
 tick();
 return {play,setSpeaking(value:boolean){speaking=value;if(!value)cues=[]},setVisemes(value:VisemeCue[]){cues=validateVisemes(value);cueStartedAt=clock.elapsedTime},dispose(){
  active=false;cancelAnimationFrame(frame);mixer.stopAllAction();
  scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();}});
  renderer.dispose();
 }};
}

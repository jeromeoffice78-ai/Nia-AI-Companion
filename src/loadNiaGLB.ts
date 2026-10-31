import {Renderer,loadAsync} from 'expo-three';
import * as THREE from 'three';

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
 let selected:'Idle'|'Dance'='Idle';
 let speaking=false;
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
 function play(name:'Idle'|'Dance'){
  selected=name;
  const clip=clips.find(c=>c.name===name);
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
  mixer.update(clock.getDelta());
  const t=clock.elapsedTime;
  const dance=selected==='Dance';
  if(leftArm)leftArm.rotation.z=(dance?0.6:0.07)*Math.sin(t*(dance?4:1.1));
  if(rightArm)rightArm.rotation.z=-(dance?0.6:0.07)*Math.sin(t*(dance?4:1.1)+0.7);
  if(leftLeg)leftLeg.rotation.x=(dance?0.28:0.02)*Math.sin(t*3);
  if(rightLeg)rightLeg.rotation.x=-(dance?0.28:0.02)*Math.sin(t*3);
  if(head)head.rotation.y=0.09*Math.sin(t*0.9);
  // Narrow periodic eyelid closure, rather than a prolonged squint.
  const blink=Math.pow(Math.max(0,Math.cos(t*2.1)),80);
  for(const eye of eyes)eye.scale.y=Math.max(0.008,0.09*(1-blink));
  if(mouth)mouth.scale.y=speaking?0.10+0.17*Math.abs(Math.sin(t*13)):0.10;
  renderer.render(scene,camera);
  gl.endFrameEXP();
 }
 tick();
 return {play,setSpeaking(value:boolean){speaking=value},dispose(){
  active=false;cancelAnimationFrame(frame);mixer.stopAllAction();
  scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();}});
  renderer.dispose();
 }};
}

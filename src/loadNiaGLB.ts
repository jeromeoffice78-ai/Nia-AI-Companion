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
 let activeAction:THREE.AnimationAction|null=null;
 function play(name:'Idle'|'Dance'){
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
  renderer.render(scene,camera);
  gl.endFrameEXP();
 }
 tick();
 return {play,dispose(){
  active=false;cancelAnimationFrame(frame);mixer.stopAllAction();
  scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();}});
  renderer.dispose();
 }};
}

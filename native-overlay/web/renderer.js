import * as THREE from './three.module.js';
import {GLTFLoader} from './GLTFLoader.js';
import {applyContinuousNiaBody} from './continuousBody.js';

// Scalar states come from the native bridge using the audio player's measured
// currentTime and validated aligned cues. This renderer never derives phonemes
// from text or advances a speech timeline using a local clock.
const SPEECH_VISEMES=new Set(['sil','PP','FF','TH','DD','kk','CH','SS','nn','RR','aa','E','ih','oh','ou']);
const SHAPES={PP:'viseme_MBP',FF:'viseme_FV',aa:'viseme_AA',E:'viseme_EE',ih:'viseme_EE',oh:'viseme_OH',ou:'viseme_OH',nn:'viseme_L',DD:'viseme_L',RR:'viseme_OH'};
const silentSpeech=()=>({viseme:'sil',opening:0,speaking:false});
export function normalizeOverlaySpeechState(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    !SPEECH_VISEMES.has(value.viseme)||typeof value.speaking!=='boolean'||
    typeof value.opening!=='number'||!Number.isFinite(value.opening)||value.opening<0||value.opening>1)return null;
 return !value.speaking||value.viseme==='sil'?silentSpeech():
  {viseme:value.viseme,opening:value.opening,speaking:true};
}
export function createOverlaySpeechController(root){
 const faces=[];
 root.traverse(node=>{if(node.isMesh&&node.morphTargetDictionary&&node.morphTargetInfluences)faces.push(node);});
 const jaw=root.getObjectByName('Jaw')||root.getObjectByName('jaw');
 const jawRest=jaw?.rotation.x;
 let state=silentSpeech();
 function reset(){
  state=silentSpeech();
  for(const mesh of faces)for(const [name,index] of Object.entries(mesh.morphTargetDictionary))
   if(name.startsWith('viseme_'))mesh.morphTargetInfluences[index]=0;
  if(jaw)jaw.rotation.x=jawRest;
 }
 function setSpeechState(value){
  const valid=normalizeOverlaySpeechState(value);
  if(!valid||!valid.speaking){reset();return Boolean(valid);}
  state=valid;return true;
 }
 function update(deltaSeconds){
  const delta=Number.isFinite(deltaSeconds)?Math.max(0,Math.min(.1,deltaSeconds)):0;
  const alpha=1-Math.exp(-18*delta);
  const target=state.speaking?(SHAPES[state.viseme]||'viseme_AA'):null;
  for(const mesh of faces)for(const [name,index] of Object.entries(mesh.morphTargetDictionary)){
   if(!name.startsWith('viseme_'))continue; // Keep imported blinks and expressions.
   const wanted=name===target?state.opening:0;
   const current=Number.isFinite(mesh.morphTargetInfluences[index])?mesh.morphTargetInfluences[index]:0;
   mesh.morphTargetInfluences[index]=current+(wanted-current)*alpha;
  }
  if(jaw){const wanted=jawRest+(state.speaking ? .08*state.opening : 0);jaw.rotation.x+=(wanted-jaw.rotation.x)*alpha;}
 }
 reset();return {setSpeechState,update,reset};
}

const canvas=document.querySelector('#scene');
const label=document.querySelector('#status');
let renderer,mixer,scene,camera,model,frame=0,disposed=false,paused=false,ready=false;
let elapsed=0,last=0,action=null,lastMotionChange=0,autonomous=true,motionIndex=0;
let speechController=null,pendingSpeechState=silentSpeech();
window.niaOverlay={setSpeechState(value){
 if(disposed)return false;
 const valid=normalizeOverlaySpeechState(value);pendingSpeechState=valid||silentSpeech();
 speechController?.setSpeechState(pendingSpeechState);
 if(!pendingSpeechState.speaking&&renderer&&scene&&camera)renderer.render(scene,camera);
 return Boolean(valid);
}};
function fail(error){
 const message=error instanceof Error?error.message:String(error);
 document.querySelector('#error').textContent='3D overlay could not start: '+message;
 document.querySelector('#error').style.display='block';
 label.textContent='3D renderer unavailable';
 window.__niaOverlayDiagnostics={ready:false,error:message};
 console.error('NIA_OVERLAY_ERROR:'+message);
 cancelAnimationFrame(frame);
}
function resize(){
 if(!renderer||!camera)return;
 const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
 renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
}
function play(name){
 const clip=model?.animations.find(item=>item.name===name);
 if(!clip)throw Error('Bundled motion is missing: '+name);
 const next=mixer.clipAction(clip);
 if(next===action)return;
 action?.fadeOut(.25);next.reset().fadeIn(.25).play();action=next;
}
function tick(now){
 if(disposed||paused||document.hidden)return;
 frame=requestAnimationFrame(safeTick);
 if(now-last<1000/30)return;
 const delta=last?Math.min((now-last)/1000,.1):0;last=now;elapsed+=delta;
 if(autonomous&&elapsed-lastMotionChange>12){
  const motions=['Idle','Wave','Idle','Dance'];play(motions[++motionIndex%motions.length]);lastMotionChange=elapsed;
 }
 mixer.update(delta);
 speechController?.update(delta);
 renderer.render(scene,camera);
 if(!ready){
  if(renderer.info.render.calls<1)throw Error('No geometry was drawn');
  ready=true;
  let bones=0,skinnedMeshes=0;model.scene.traverse(node=>{if(node.isSkinnedMesh){skinnedMeshes++;bones=Math.max(bones,node.skeleton.bones.length);}});
  window.__niaOverlayDiagnostics={ready:true,bones,skinnedMeshes,offline:true};
  label.textContent='Internal 3D test rig • '+bones+' bones';
  console.log('NIA_OVERLAY_READY');
 }
}
function resume(){last=0;cancelAnimationFrame(frame);if(!disposed&&!paused&&!document.hidden)frame=requestAnimationFrame(safeTick);}
function safeTick(now){try{tick(now);}catch(error){fail(error);}}
function dispose(){
 if(disposed)return;disposed=true;cancelAnimationFrame(frame);speechController?.reset();pendingSpeechState=silentSpeech();mixer?.stopAllAction();
 scene?.traverse(node=>{
  if(!node.isMesh)return;node.geometry.dispose();
  for(const material of (Array.isArray(node.material)?node.material:[node.material])){
   for(const value of Object.values(material))if(value?.isTexture)value.dispose();
   material.dispose();
  }
 });
 renderer?.dispose();renderer?.forceContextLoss();
}
window.addEventListener('pagehide',dispose);
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pendingSpeechState=silentSpeech();speechController?.reset();}resume();});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(!disposed)fail(Error('WebGL context lost; close and reopen the overlay'));});
document.querySelector('#pause').addEventListener('click',event=>{paused=!paused;event.target.textContent=paused?'Resume':'Pause';resume();});
for(const button of document.querySelectorAll('[data-motion]'))button.addEventListener('click',()=>{try{autonomous=false;play(button.dataset.motion);}catch(error){fail(error);}});

async function main(){
 renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor(0,0);
 scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x554466,2.5));
 const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(3,5,4);scene.add(key);
 const response=await fetch('./nia-character.glb');if(!response.ok)throw Error('Bundled GLB not found');
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength<20||bytes.byteLength>25*1024*1024)throw Error('Invalid bundled GLB size');
 const view=new DataView(bytes);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(8,true)!==bytes.byteLength)throw Error('Invalid bundled GLB header');
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,view.getUint32(12,true))));
 if([...(json.buffers||[]),...(json.images||[])].some(item=>item.uri))throw Error('Overlay GLB must have self-contained resources');
 model=await new GLTFLoader().parseAsync(bytes,'');
 if(disposed)return;
 applyContinuousNiaBody(model.scene);
 scene.add(model.scene);mixer=new THREE.AnimationMixer(model.scene);
 speechController=createOverlaySpeechController(model.scene);speechController.setSpeechState(pendingSpeechState);
 const box=new THREE.Box3().setFromObject(model.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 if(!Number.isFinite(size.y)||size.y<=0)throw Error('Empty bundled character');
 camera=new THREE.PerspectiveCamera(40,1,.01,100);
 const distance=Math.max(size.y,size.x*1.8)/(2*Math.tan(THREE.MathUtils.degToRad(20)))*1.15;
 camera.position.set(center.x,center.y,center.z+distance);camera.lookAt(center);
 resize();play('Idle');resume();
}
main().catch(fail);

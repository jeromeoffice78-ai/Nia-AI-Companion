import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Vector3} from 'three';

// Execute the exact exported controller before the browser-only bootstrap.
// Its inputs are real GLTFLoader meshes, not a substitute mouth implementation.
const source=readFileSync('native-overlay/web/renderer.js','utf8').split("const canvas=document.querySelector('#scene');")[0];
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function('require','module','exports',compiled)(()=>({}),module,module.exports);
const {createOverlaySpeechController,normalizeOverlaySpeechState}=module.exports;
async function rig(){
 const bytes=readFileSync('assets/nia-character-animated.glb');
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const meshes=[];gltf.scene.traverse(node=>{if(node.isMesh&&node.morphTargetDictionary?.viseme_AA!==undefined)meshes.push(node);});
 assert.ok(meshes.length>0,'The actual GLB must expose facial geometry');
 return {root:gltf.scene,face:meshes[0]};
}
const settle=controller=>{for(let i=0;i<30;i++)controller.update(1/30);};
const snapshot=face=>Array.from({length:face.geometry.getAttribute('position').count},(_,i)=>face.getVertexPosition(i,new Vector3()));
const difference=(a,b)=>a.reduce((sum,vertex,i)=>sum+vertex.distanceTo(b[i]),0);

test('floating speech deforms actual GLB AA/PP targets, then silence closes the mouth',async()=>{
 const {root,face}=await rig();
 const controller=createOverlaySpeechController(root),dictionary=face.morphTargetDictionary;
 const blinks=[];
 root.traverse(node=>{for(const [name,index] of Object.entries(node.morphTargetDictionary||{}))if(name.startsWith('blink')){node.morphTargetInfluences[index]=name==='blinkLeft'?.45:.25;blinks.push({node,index,value:node.morphTargetInfluences[index]});}});
 assert.equal(blinks.length,2);
 const closed=snapshot(face);
 assert.equal(controller.setSpeechState({viseme:'aa',opening:1,speaking:true}),true);
 controller.update(1/30);
 assert.ok(face.morphTargetInfluences[dictionary.viseme_AA]>0&&face.morphTargetInfluences[dictionary.viseme_AA]<1,'Morph transition interpolates');
 settle(controller);
 assert.ok(face.morphTargetInfluences[dictionary.viseme_AA]>.99);
 const aa=snapshot(face);assert.ok(difference(closed,aa)>1e-6,'AA must deform real mouth vertices');
 assert.equal(controller.setSpeechState({viseme:'PP',opening:.03,speaking:true}),true);
 settle(controller);
 assert.ok(face.morphTargetInfluences[dictionary.viseme_MBP]>.029);
 assert.ok(face.morphTargetInfluences[dictionary.viseme_AA]<.001);
 assert.ok(difference(aa,snapshot(face))>1e-6,'PP must change AA geometry');
 for(const {node,index,value} of blinks)assert.equal(node.morphTargetInfluences[index],value,'Speech must preserve blinking');
 assert.equal(controller.setSpeechState({viseme:'sil',opening:1,speaking:true}),true);
 for(const [name,index] of Object.entries(dictionary))if(name.startsWith('viseme_'))assert.equal(face.morphTargetInfluences[index],0);
 assert.equal(difference(closed,snapshot(face)),0,'Silence restores the closed facial geometry');
});

test('malformed states fail closed and a missing aligned source resets immediately',async()=>{
 const {root,face}=await rig();const controller=createOverlaySpeechController(root);
 const invalid=[null,undefined,[],{}, {viseme:'unknown',opening:.5,speaking:true},
  {viseme:'aa',opening:NaN,speaking:true},{viseme:'aa',opening:Infinity,speaking:true},
  {viseme:'aa',opening:-.1,speaking:true},{viseme:'aa',opening:1.1,speaking:true},
  {viseme:'aa',opening:'1',speaking:true},{viseme:'aa',opening:1,speaking:1}];
 for(const value of invalid){
  controller.setSpeechState({viseme:'aa',opening:1,speaking:true});settle(controller);
  assert.equal(controller.setSpeechState(value),false);
  for(const [name,index] of Object.entries(face.morphTargetDictionary))if(name.startsWith('viseme_'))assert.equal(face.morphTargetInfluences[index],0);
 }
 controller.setSpeechState({viseme:'aa',opening:1,speaking:true});settle(controller);
 assert.equal(controller.setSpeechState({viseme:'aa',opening:1,speaking:false}),true);
 assert.equal(face.morphTargetInfluences[face.morphTargetDictionary.viseme_AA],0);
 assert.deepEqual(normalizeOverlaySpeechState({viseme:'sil',opening:1,speaking:true}),{viseme:'sil',opening:0,speaking:false});
});

test('jaw follows supplied opening and no local clock advances phonemes',async()=>{
 const {root}=await rig();const jaw=root.getObjectByName('Jaw')||root.getObjectByName('jaw');
 if(jaw){
  const rest=jaw.rotation.x,controller=createOverlaySpeechController(root);
  controller.setSpeechState({viseme:'aa',opening:.6,speaking:true});settle(controller);
  assert.ok(Math.abs(jaw.rotation.x-(rest+.08*.6))<.0001);
  controller.setSpeechState({viseme:'sil',opening:0,speaking:false});assert.equal(jaw.rotation.x,rest);
 }else{
  assert.ok(root.getObjectByName('Head'),'Facial morphs work even when no separate jaw bone exists');
 }
 for(const name of ['sil','PP','FF','TH','DD','kk','CH','SS','nn','RR','aa','E','ih','oh','ou'])
  assert.ok(normalizeOverlaySpeechState({viseme:name,opening:.5,speaking:true}));
});

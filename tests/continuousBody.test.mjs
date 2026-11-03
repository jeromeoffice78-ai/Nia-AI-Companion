import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SkinnedMesh,AnimationMixer,Vector3} from 'three';
import {loadTS} from './loadTS.mjs';
const {applyContinuousNiaBody}=loadTS('src/continuousBody.ts');
test('Nia test rig gets continuous surfaces without losing the real skeleton',async()=>{
 const bytes=readFileSync('assets/nia-character-animated.glb');
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const model=gltf.scene;
 const before=model.children.find(x=>x.name.toLowerCase().replace(/[^a-z0-9]/g,'')==='leftupperarm');
 assert.ok(before);
 const clips=gltf.animations.map(x=>x.name);
 const r=applyContinuousNiaBody(model);
 assert.equal(r.applied,true);
 assert.equal(r.created,12);
 assert.ok(r.hidden>=20);
 assert.equal(before.visible,false);
 assert.deepEqual(clips,['Idle','Walk','Dance','Wave']);
 const arm=model.getObjectByName('Nia continuous Left skin arm');
 assert.ok(arm?.isSkinnedMesh);
 assert.equal(arm.skeleton.bones.length,25);
 const weights=arm.geometry.getAttribute('skinWeight');
 for(let i=0;i<weights.count;i+=7){
  const total=weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i);
  assert.ok(Math.abs(total-1)<.0001,'Skin weights must sum to 1');
 }
 assert.equal(applyContinuousNiaBody(model).applied,false,'Must not duplicate geometry on reload');
 const face=model.children.find(x=>x.name.toLowerCase().replace(/[^a-z0-9]/g,'')==='faciallipsyncblendshapecontrols');
 assert.ok(face?.morphTargetDictionary?.viseme_AA!==undefined);
});
test('continuous skin deforms under original glTF dance animation',async()=>{
 const b=readFileSync('assets/nia-character-animated.glb');
 const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 applyContinuousNiaBody(g.scene);
 const arm=g.scene.getObjectByName('Nia continuous Right skin arm');
 const mixer=new AnimationMixer(g.scene),clip=g.animations.find(x=>x.name==='Dance');
 assert.ok(clip);
 mixer.clipAction(clip).play();
 g.scene.updateMatrixWorld(true);
 const vertex=new Vector3();
 arm.applyBoneTransform(arm.geometry.getAttribute('position').count/2|0,vertex.fromBufferAttribute(arm.geometry.getAttribute('position'),arm.geometry.getAttribute('position').count/2|0));
 const first=vertex.clone();
 mixer.update(.4);g.scene.updateMatrixWorld(true);
 arm.applyBoneTransform(arm.geometry.getAttribute('position').count/2|0,vertex.fromBufferAttribute(arm.geometry.getAttribute('position'),arm.geometry.getAttribute('position').count/2|0));
 assert.ok(first.distanceTo(vertex)>.0001,'Continuous limb must follow moving bones');
});
test('new test build is distinct from prior Android 0.1.4',()=>{
 const app=JSON.parse(readFileSync('app.json','utf8')).expo;
 assert.match(app.version,/^\d+\.\d+\.\d+$/);
 assert.ok(app.android.versionCode>=6);
});
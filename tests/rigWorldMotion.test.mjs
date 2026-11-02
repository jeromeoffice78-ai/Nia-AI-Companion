import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Vector3,SkinnedMesh} from 'three';
import {loadTS} from './loadTS.mjs';
const {computeBodyPose}=loadTS('src/rigMotion.ts');

test('actual 25-bone GLB skinned meshes move during additive Dance and Walk poses',async()=>{
 const data=readFileSync('assets/nia-character-animated.glb');
 const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 const root=gltf.scene;
 const bones=['Hips','Spine','Chest','UpperChest','Neck','LeftShoulder','RightShoulder',
  'LeftLowerArm','RightLowerArm','LeftHand','RightHand','LeftUpperLeg','RightUpperLeg',
  'LeftLowerLeg','RightLowerLeg','LeftFoot','RightFoot'];
 const rest=new Map();
 for(const name of bones){
  const node=root.getObjectByName(name);
  assert.ok(node,'Missing skeleton joint '+name);
  rest.set(name,{rotation:node.rotation.clone(),position:node.position.clone()});
 }
 const meshNames=['Chest shirt','Left forearm','Right forearm','Left shin','Right shin','Left sneaker','Right sneaker'];
 const normalized=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
 const skinned=[];
 root.traverse(node=>{if(node instanceof SkinnedMesh)skinned.push(node);});
 const meshes=meshNames.map(name=>{
  const key=normalized(name);
  // GLTFLoader sanitizes node names for animation bindings (e.g. spaces to
  // underscores). Search actual SkinnedMesh nodes using normalized names.
  const mesh=skinned.find(node=>normalized(node.name)===key)
    ||skinned.find(node=>normalized(node.name).startsWith(key));
  assert.ok(mesh instanceof SkinnedMesh,'Missing skinned body mesh '+name+
    '; available: '+skinned.slice(0,15).map(m=>m.name).join(', '));
  return mesh;
 });
 function sample(mode,t){
  const pose=computeBodyPose(mode,t);
  for(const name of bones){
   const bone=root.getObjectByName(name),base=rest.get(name),d=pose.rotations[name];
   bone.rotation.set(base.rotation.x+d[0],base.rotation.y+d[1],base.rotation.z+d[2]);
   bone.position.copy(base.position);
  }
  const pelvis=root.getObjectByName('Hips');
  pelvis.position.x+=pose.hips[0];pelvis.position.y+=pose.hips[1];pelvis.position.z+=pose.hips[2];
  root.updateMatrixWorld(true);
  return meshes.map(mesh=>{
   const vertex=new Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'),0);
   mesh.applyBoneTransform(0,vertex);
   return vertex.applyMatrix4(mesh.matrixWorld).clone();
  });
 }
 for(const mode of ['Dance','Walk']){
  const early=sample(mode,0.13),late=sample(mode,0.71);
  for(let i=0;i<meshes.length;i++){
   assert.ok(early[i].distanceTo(late[i])>.003,
    mode+' failed to move the actual skinned mesh '+meshNames[i]);
  }
 }
});
test('Android test build has a distinct installable version and visible centered avatar',()=>{
 const app=JSON.parse(readFileSync('app.json','utf8'));
 assert.match(app.expo.version,/^\d+\.\d+\.\d+$/);
 assert.ok(app.expo.android.versionCode>=2);
 const render=readFileSync('src/loadNiaGLB.ts','utf8');
 assert.match(render,/camera\.lookAt\(0,1\.04,0\)/);
 assert.match(render,/animateBody\(t,delta\)/);
});

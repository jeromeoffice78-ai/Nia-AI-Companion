import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AnimationMixer,Vector3} from 'three';
import {loadTS} from './loadTS.mjs';
const {applyContinuousNiaBody}=loadTS('src/continuousBody.ts');
const {computeBodyPose}=loadTS('src/rigMotion.ts');
async function load(){
 const b=readFileSync('assets/nia-character-animated.glb');
 const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 applyContinuousNiaBody(g.scene);return g;
}
function deformed(mesh,index){
 return mesh.applyBoneTransform(index,new Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'),index)).applyMatrix4(mesh.matrixWorld);
}
function edgeCount(geometry,a,b){
 const index=geometry.index;let count=0;
 for(let i=0;i<index.count;i+=3)for(let k=0;k<3;k++){
  const u=index.getX(i+k),v=index.getX(i+(k+1)%3);
  if((u===a&&v===b)||(u===b&&v===a))count++;
 }
 return count;
}
test('shirt armholes have matching sleeve boundaries with no overlapping torso patch',async()=>{
 const g=await load(),torso=g.scene.getObjectByName('Nia continuous fitted torso');
 for(const side of ['Left','Right']){
  const sleeve=g.scene.getObjectByName(`Nia continuous ${side} shirt sleeve`);
  const boundary=sleeve.geometry.userData.shoulderBoundary;
  assert.equal(boundary.length,24);
  for(let i=0;i<24;i++){
   assert.equal(edgeCount(torso.geometry,boundary[i],boundary[(i+1)%24]),1,'Torso must terminate at actual armhole');
   assert.equal(edgeCount(sleeve.geometry,i,(i+1)%24),1,'Sleeve must start at same armhole');
   for(const attribute of ['position','skinIndex','skinWeight']){
    const a=torso.geometry.getAttribute(attribute),b=sleeve.geometry.getAttribute(attribute);
    for(let k=0;k<a.itemSize;k++)assert.ok(Math.abs(a.getComponent(boundary[i],k)-b.getComponent(i,k))<1e-6,`${side} ${attribute} boundary differs`);
   }
  }
 }
});
test('real GLB Wave, Dance and Walk keep both shoulder seams closed after skinning',async()=>{
 const g=await load(),torso=g.scene.getObjectByName('Nia continuous fitted torso');
 const rest=new Map();g.scene.traverse(n=>{if(n.isBone)rest.set(n.name,n.rotation.clone());});
 for(const mode of ['Wave','Dance','Walk']){
  const mixer=new AnimationMixer(g.scene),clip=g.animations.find(c=>c.name===mode);
  mixer.clipAction(clip).play();
  for(let sample=0;sample<=80;sample++){
   const time=clip.duration*sample/80;mixer.setTime(time);
   const pose=computeBodyPose(mode,time);
   for(const [name,offset] of Object.entries(pose.rotations)){
    const bone=g.scene.getObjectByName(name),r=rest.get(name);
    // Same additive targets used by the app, including moving shoulder bones.
    bone.rotation.set(r.x+offset[0],r.y+offset[1],r.z+offset[2]);
   }
   g.scene.updateMatrixWorld(true);
   for(const side of ['Left','Right']){
    const sleeve=g.scene.getObjectByName(`Nia continuous ${side} shirt sleeve`);
    for(const [i,vertex] of sleeve.geometry.userData.shoulderBoundary.entries()){
     const gap=deformed(torso,vertex).distanceTo(deformed(sleeve,i));
     assert.ok(gap<1e-6,`${mode} ${time} ${side} shoulder opens ${gap}m`);
    }
    // Verify generated triangles stay finite and nondegenerate during motion.
    const index=sleeve.geometry.index;
    for(let i=0;i<index.count;i+=3){
     const a=deformed(sleeve,index.getX(i)),b=deformed(sleeve,index.getX(i+1)),c=deformed(sleeve,index.getX(i+2));
     const area=b.sub(a).cross(c.sub(a)).length();
     assert.ok(Number.isFinite(area)&&area>1e-10,'Sleeve triangle collapses');
    }
   }
  }
  mixer.stopAllAction();mixer.uncacheRoot(g.scene);
 }
});

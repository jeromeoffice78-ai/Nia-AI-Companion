import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTS} from './loadTS.mjs';
const {computeBodyPose,REQUIRED_BODY_BONES}=loadTS('src/rigMotion.ts');
const distance=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);
test('Dance drives torso, hips, shoulders, elbows, knees, ankles and wrists over time',()=>{
 const samples=[0,.15,.35,.65,1.1,1.5].map(t=>computeBodyPose('Dance',t));
 for(const key of ['Hips','Spine','Chest','UpperChest','Neck','LeftShoulder','RightShoulder',
   'LeftLowerArm','RightLowerArm','LeftHand','RightHand','LeftUpperLeg','RightUpperLeg',
   'LeftLowerLeg','RightLowerLeg','LeftFoot','RightFoot']){
  assert.ok(REQUIRED_BODY_BONES.includes(key),'GLB bone expected: '+key);
  const values=samples.map(p=>p.rotations[key]);
  assert.ok(values.some(v=>distance(v,values[0])>.001),'Dance bone does not animate: '+key);
 }
 assert.ok(samples.some(p=>distance(p.hips,[0,0,0])>.02),'Dance must move pelvis');
});
test('Walk drives leg swing, knee bend, torso counterrotation and arm bends',()=>{
 const samples=[0,.3,.6,1.2].map(t=>computeBodyPose('Walk',t));
 for(const key of ['Spine','LeftUpperLeg','RightUpperLeg','LeftLowerLeg','RightLowerLeg',
  'LeftLowerArm','RightLowerArm']){
  assert.ok(samples.some(p=>distance(p.rotations[key],samples[0].rotations[key])>.005),key);
 }
});
test('Wave moves wrist and elbow and Idle returns to gentle breathing',()=>{
 const a=computeBodyPose('Wave',0),b=computeBodyPose('Wave',.25);
 assert.ok(distance(a.rotations.RightHand,b.rotations.RightHand)>.03);
 assert.ok(distance(a.rotations.RightLowerArm,b.rotations.RightLowerArm)>.03);
 assert.ok(distance(computeBodyPose('Idle',0).rotations.Spine,computeBodyPose('Idle',1).rotations.Spine)>.005);
});
test('rejects broken animation times and leaves completed rig GLB in source',()=>{
 for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>computeBodyPose('Dance',value),RangeError);
 const loader=readFileSync('src/loadNiaGLB.ts','utf8');
 assert.match(loader,/animateBody\(t,delta\)/);
 assert.match(loader,/name==='LeftUpperLeg'\|\|name==='RightUpperLeg'/);
 assert.match(loader,/mixer\.update\(elapsed\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTS} from './loadTS.mjs';
const {chooseAutonomousMotion}=loadTS('src/avatarMotion.ts');

test('speech selects real full-body animation clips, never a fake viseme clip',()=>{
 for(const previous of ['Idle','Walk','Dance','Wave']){
  for(const sample of [0,.2,.5,.8,.999]){
   const next=chooseAutonomousMotion(true,previous,sample);
   assert.ok(['Idle','Walk','Wave'].includes(next));
   assert.notEqual(next,previous);
  }
 }
});
test('silent autonomous animations include dance and all rig clips',()=>{
 const observed=new Set();
 for(const sample of [0,.26,.51,.76,.999])observed.add(chooseAutonomousMotion(false,'Idle',sample));
 assert.deepEqual([...observed].sort(),['Dance','Walk','Wave']);
});
test('invalid random samples cannot select out-of-range animation',()=>{
 for(const sample of [-1,1,Number.NaN,Infinity])assert.throws(()=>chooseAutonomousMotion(false,'Idle',sample),RangeError);
});
test('active speaking does not disable autonomous movement selection',()=>{
 const app=readFileSync('src/Avatar3D.tsx','utf8');
 assert.match(app,/chooseAutonomousMotion\(latestSpeaking.current,latestMotion.current/);
 assert.doesNotMatch(app,/AppState.currentState!=='active'\|\|latestSpeaking.current/);
});

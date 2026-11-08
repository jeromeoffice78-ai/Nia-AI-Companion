import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {loadTS} from './loadTS.mjs';

test('renderer preserves its scene timeline and pauses frame work across background/resume',async()=>{
 const bytes=readFileSync('assets/nia-character-animated.glb');
 const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 let now=0,frameId=0,renders=0;
 const pending=new Map(),poses=[];
 class TestClock {
  elapsedTime=0;running=false;oldTime=0;
  start(){this.elapsedTime=0;this.oldTime=now;this.running=true;}
  stop(){this.getDelta();this.running=false;}
  getDelta(){if(!this.running){this.start();return 0;}const delta=now-this.oldTime;this.oldTime=now;this.elapsedTime+=delta;return delta;}
 }
 const raf=globalThis.requestAnimationFrame,caf=globalThis.cancelAnimationFrame;
 globalThis.requestAnimationFrame=callback=>{pending.set(++frameId,callback);return frameId;};
 globalThis.cancelAnimationFrame=id=>pending.delete(id);
 let controller;
 try{
  const {mountNiaGLB}=loadTS('src/loadNiaGLB.ts',{
   'three':{...THREE,Clock:TestClock},
   'expo-three':{Renderer:class{setSize(){}render(){renders++;}dispose(){}}},
   'expo-asset':{Asset:{}},
   'expo-file-system':{File:class{size=bytes.length;async arrayBuffer(){return buffer;}}},
   'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader},
   './rigMotion':{REQUIRED_BODY_BONES:[],computeBodyPose(_mode,t){poses.push(t);return {hips:[0,0,0],rotations:{}};}},
  });
  controller=await mountNiaGLB({drawingBufferWidth:400,drawingBufferHeight:700,endFrameEXP(){}},'file:///test.glb');
  function step(delta){now+=delta;const callbacks=[...pending.values()];pending.clear();callbacks.forEach(cb=>cb());}
  step(2);assert.equal(poses.at(-1),2);
  controller.setActive(false);assert.equal(pending.size,0);
  const before=renders;step(30);assert.equal(renders,before,'background must not render');
  controller.setActive(true);
  assert.equal(poses.at(-1),2,'resume must retain the prior pose clock');
  step(.1);assert.ok(Math.abs(poses.at(-1)-2.1)<1e-8,'background time must be excluded');
  assert.equal(pending.size,1,'resume schedules exactly one render loop');
  controller.setActive(true);assert.equal(pending.size,1,'duplicate active events must not duplicate loops');
  controller.dispose();assert.equal(pending.size,0);
 }finally{
  controller?.dispose();
  if(raf===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=raf;
  if(caf===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=caf;
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './loadTS.mjs';
const {overlaySpeechFrame}=loadTS('src/overlaySpeech.ts');
const cues=[{startMs:0,endMs:100,viseme:'PP'},{startMs:100,endMs:300,viseme:'aa'}];
const silent={viseme:'sil',opening:0,speaking:false};
test('floating mouth follows measured playback, including seeks and gaps',()=>{
 assert.deepEqual(overlaySpeechFrame(cues,150,true),{viseme:'aa',opening:1,speaking:true});
 assert.deepEqual(overlaySpeechFrame(cues,50,true),{viseme:'PP',opening:.03,speaking:true});
 assert.deepEqual(overlaySpeechFrame(cues,300,true),silent);
 assert.deepEqual(overlaySpeechFrame([{startMs:100,endMs:200,viseme:'aa'}],50,true),silent);
});
test('paused, unaligned device speech and invalid clocks stay silent',()=>{
 for(const time of [null,NaN,Infinity,-1])assert.deepEqual(overlaySpeechFrame(cues,time,true),silent);
 assert.deepEqual(overlaySpeechFrame(cues,150,false),silent);
 assert.deepEqual(overlaySpeechFrame([],150,true),silent);
});
test('untrusted timelines cannot drive overlay geometry',()=>{
 assert.throws(()=>overlaySpeechFrame([{startMs:20,endMs:10,viseme:'aa'}],25,true));
 assert.throws(()=>overlaySpeechFrame([{startMs:0,endMs:121000,viseme:'aa'}],25,true));
 assert.throws(()=>overlaySpeechFrame([{startMs:0,endMs:100,viseme:'invalid'}],25,true));
});
test('only scalar mouth state crosses the native bridge and clearing resets it',async()=>{
 const calls=[];
 const bridge=loadTS('src/niaOverlay.ts',{'react-native':{Platform:{OS:'android'},NativeModules:{NiaOverlay:{setSpeechState:async(...args)=>{calls.push(args);return true;}}}}});
 await bridge.sendNiaOverlaySpeech(overlaySpeechFrame(cues,150,true));
 await bridge.clearNiaOverlaySpeech();
 assert.deepEqual(calls,[['aa',1,true],['sil',0,false]]);
});

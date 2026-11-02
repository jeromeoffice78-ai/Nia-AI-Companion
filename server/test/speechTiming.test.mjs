import test from 'node:test';
import assert from 'node:assert/strict';
import {idToViseme,timingToCues} from '../speechTiming.mjs';
test('Azure speech events produce real audio-timed Nia visemes',()=>{
 const cues=timingToCues([{timeMs:150,id:21},{timeMs:420,id:1},{timeMs:710,id:18}],900);
 assert.equal(cues[0].viseme,'sil');
 assert.equal(cues[1].viseme,'PP');
 assert.equal(cues[1].startMs,150);
 assert.equal(cues[2].viseme,'aa');
 assert.equal(cues[3].viseme,'FF');
 assert.equal(cues[3].endMs,900);
});
test('reject malformed or unsupported Azure events',()=>{
 assert.equal(idToViseme.length,22);
 for(const inputs of [[],[{id:200,timeMs:10}],[{id:1,timeMs:-1}]]){
  assert.throws(()=>timingToCues(inputs,700));
 }
});

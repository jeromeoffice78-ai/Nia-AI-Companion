import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTS} from './loadTS.mjs';
const {DEMO_MOUTH_CUES,DEMO_CYCLE_MS}=loadTS('src/mouthDemo.ts');
const {validateVisemes,visemeAt,mouthOpenForViseme}=loadTS('src/visemes.ts');
test('silent facial test has valid, moving visemes and a full pause before cycling',()=>{
 assert.equal(DEMO_CYCLE_MS,1800);
 assert.deepEqual(validateVisemes(DEMO_MOUTH_CUES),DEMO_MOUTH_CUES);
 assert.equal(DEMO_MOUTH_CUES[0].startMs,0);
 assert.equal(DEMO_MOUTH_CUES.at(-1).endMs,DEMO_CYCLE_MS);
 assert.equal(visemeAt(DEMO_MOUTH_CUES,1700),'sil');
 const opened=DEMO_MOUTH_CUES.map(c=>mouthOpenForViseme(c.viseme));
 assert.ok(Math.max(...opened)>.9);
 assert.ok(new Set(opened).size>4);
});
test('facial demo only runs when local silent test is active',()=>{
 const app=readFileSync('src/Avatar3D.tsx','utf8');
 assert.match(app,/if\(!speaking\|\|externalSpeaking\)return/);
 assert.match(app,/setInterval\(start,DEMO_CYCLE_MS\)/);
 assert.match(app,/clearInterval\(timer\);controller\.current\?\.setVisemes\(\[\]\)/);
 assert.match(app,/Test facial animation \(silent\)/);
 assert.match(app,/if\(speaking&&!externalSpeaking\)mounted\.setVisemes\(DEMO_MOUTH_CUES\)/);
});

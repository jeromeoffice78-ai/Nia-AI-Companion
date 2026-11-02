import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('renderer maps aligned visemes to actual audio player position',()=>{
 const gl=readFileSync('src/loadNiaGLB.ts','utf8');
 const av=readFileSync('src/Avatar3D.tsx','utf8');
 assert.match(gl,/const cuePositionMs=audioPlaybackMs\?\?/);
 assert.match(gl,/setPlaybackPosition\(value:number\|null\)/);
 assert.match(gl,/visemeAt\(cues,cuePositionMs\)/);
 assert.match(av,/mounted\.setPlaybackPosition\(latestPlayback.current\)/);
 assert.match(av,/playbackMs\?:number\|null/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Nia uses actual audio position for gateway aligned speech and clears old player',()=>{
 const s=readFileSync('app/index.tsx','utf8');
 assert.match(s,/requestAlignedSpeech\(gatewayUrl,gatewayToken,answer\)/);
 assert.match(s,/createAudioPlayer\(\{uri:aligned.audioUri,headers:aligned.audioHeaders\},\{updateInterval:50\}\)/);
 assert.match(s,/status\.currentTime\*1000/);
 assert.match(s,/playbackMs=\{audioPositionMs\}/);
 assert.match(s,/setVisemeCues\(aligned.cues\)/);
 assert.match(s,/alignedPlayer\.current\?\.stop\(\)/);
 assert.match(s,/setAudioPositionMs\(null\)/);
 assert.match(s,/Expo Speech does not expose real audio phoneme offsets/);
});

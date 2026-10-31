import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Expo Router and Android dependencies',()=>{
 const p=JSON.parse(read('package.json'));
 assert.equal(p.main,'expo-router/entry');
 for(const d of ['expo-router','expo-gl','expo-camera','expo-secure-store'])assert.ok(p.dependencies[d],d);
 assert.ok(p.devDependencies.typescript);
});
test('Nia main screen uses 3D renderer and secure gateway',()=>{
 const screen=read('app/index.tsx');
 assert.match(screen,/Avatar3D speaking=/);
 assert.match(screen,/chatWithGateway/);
 assert.match(screen,/SecureStore/);
 assert.doesNotMatch(screen,/<NiaAvatar\s*\/>/);
});
test('3D asset exists with valid glTF binary header',()=>{
 const b=readFileSync('assets/nia-character-animated.glb');
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);
});
test('production workflow rejects missing approved rig',()=>{
 const w=read('.github/workflows/android.yml');
 assert.match(w,/nia-appearance-facial-rig-v2.glb/);
 assert.match(w,/verify_nia_rig.py/);
 assert.match(w,/assembleDebug/);
});
test('avatar renderer has animation, facial targets, and cleanup',()=>{
 const a=read('src/Avatar3D.tsx'),render=read('src/loadNiaGLB.ts');
 for(const word of ['mountNiaGLB','Dance','Walk','Wave','dispose'])assert.ok(a.includes(word),word);
 for(const word of ['morphTargetDictionary','viseme_AA','skinnedMeshes'])assert.ok(render.includes(word),word);
});
test('camera and voice have lifecycle and opt-in behavior',()=>{
 const s=read('app/index.tsx');
 assert.match(s,/AppState.addEventListener/);
 assert.match(s,/setCameraVisible\(false\)/);
 assert.match(s,/requestCameraPermission/);
 assert.match(s,/Speech.stop/);
});
test('notifications can be disabled',()=>{
 const s=read('src/checkIns.ts');
 assert.match(s,/cancelScheduledNotificationAsync/);
});

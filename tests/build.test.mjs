import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=(path)=>readFileSync(path,'utf8');
test('Expo Router entry point is configured',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.main,'expo-router/entry');
 assert.ok(pkg.dependencies['expo-router']);
 assert.ok(pkg.dependencies['react-native-screens']);
 assert.ok(pkg.dependencies['react-native-safe-area-context']);
});
test('AI model configuration and avatar source are wired',()=>{
 const screen=read('app/index.tsx');
 assert.match(screen,/nia_model/);
 assert.match(screen,/NiaAvatar/);
 assert.ok(existsSync('src/NiaAvatar.tsx'));
});
test('notification scheduler has a cancellation path',()=>{
 const source=read('src/checkIns.ts');
 assert.match(source,/cancelScheduledNotificationAsync/);
 assert.match(source,/requestPermissionsAsync/);
});
test('workflow uploads an Android debug APK',()=>{
 const workflow=read('.github/workflows/android.yml');
 assert.match(workflow,/assembleDebug/);
 assert.match(workflow,/upload-artifact/);
});

test('bundled GLB is present and has glTF 2 binary header',()=>{
 const file=readFileSync('assets/nia-character-animated.glb');
 assert.equal(file.toString('ascii',0,4),'glTF');
 assert.equal(file.readUInt32LE(4),2);
 assert.ok(file.length>1000);
});
test('active avatar screen loads bundled model and supports animation',()=>{
 const avatar=read('src/Avatar3D.tsx');
 assert.match(avatar,/mountNiaGLB/);
 assert.match(avatar,/niaBundledModel/);
 assert.match(avatar,/Dance/);
});

test('bundled GLB contains playable Idle and Dance clips',()=>{
 const file=readFileSync('assets/nia-character-animated.glb');
 const jsonSize=file.readUInt32LE(12);
 const chunkType=file.toString('ascii',16,20);
 assert.equal(chunkType,'JSON');
 const gltf=JSON.parse(file.subarray(20,20+jsonSize).toString('utf8'));
 assert.ok(Array.isArray(gltf.animations));
 for(const name of ['Idle','Dance']){
  const clip=gltf.animations.find(a=>a.name===name);
  assert.ok(clip,'missing animation '+name);
  assert.ok(clip.channels.length>0,'no animation channels '+name);
  for(const channel of clip.channels){
   assert.ok(channel.target.node<gltf.nodes.length,'invalid animation target');
  }
 }
});

test('avatar renderer animates individual limbs and head',()=>{
 const renderer=read('src/loadNiaGLB.ts');
 for(const part of ['leftArm','rightArm','leftLeg','rightLeg','head']){
  assert.match(renderer,new RegExp("getObjectByName\\('"+part+"'\\)"));
 }
 assert.match(renderer,/selected==='Dance'/);
});

test('spoken AI replies control avatar speaking state',()=>{
 const home=read('app/index.tsx');
 const avatar=read('src/Avatar3D.tsx');
 assert.match(home,/setAvatarSpeaking\(true\)/);
 assert.match(home,/onDone:\(\)=>\{setAvatarSpeaking\(false\)/);
 assert.match(home,/<Avatar3D speaking=\{avatarSpeaking\} visemes=\{visemeCues\}/);
 assert.match(avatar,/externalSpeaking\|\|speaking/);
});

test('animation rig has shoulder and hip pivots and Wave mode',()=>{
 const source=read('src/loadNiaGLB.ts');
 const avatar=read('src/Avatar3D.tsx');
 assert.match(source,/leftShoulder=rigged\?undefined:joint/);
 assert.match(source,/rightShoulder=rigged\?undefined:joint/);
 assert.match(source,/leftHip=rigged\?undefined:joint/);
 assert.match(source,/rightHip=rigged\?undefined:joint/);
 assert.match(source,/neck=rigged\?undefined:joint/);
 assert.match(source,/waveBlend/);
 assert.match(avatar,/'Wave'/);
});
test('opt-in check-ins recur weekly instead of expiring after seven days',()=>{
 const source=read('src/checkIns.ts');
 assert.match(source,/SchedulableTriggerInputTypes.WEEKLY/);
 assert.match(source,/cancelScheduledNotificationAsync/);
});

test('imported skeletal rig exposes Walk and facial morph playback',()=>{
 const renderer=read('src/loadNiaGLB.ts');
 const avatar=read('src/Avatar3D.tsx');
 assert.match(renderer,/rigged=!!model.getObjectByName\('Hips'\)/);
 assert.match(renderer,/morphTargetDictionary/);
 assert.match(renderer,/viseme_AA/);
 assert.match(avatar,/DocumentPicker.getDocumentAsync/);
 assert.match(avatar,/'Walk'/);
});
test('AI response accepts only validated viseme timing',()=>{
 const screen=read('app/index.tsx');
 const visemes=read('src/visemes.ts');
 assert.match(screen,/validateVisemes\(data.visemes\)/);
 assert.match(visemes,/previousEnd/);
});

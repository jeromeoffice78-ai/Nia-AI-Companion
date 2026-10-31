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

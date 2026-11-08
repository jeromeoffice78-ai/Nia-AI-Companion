import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTS} from './loadTS.mjs';
const read=p=>readFileSync(p,'utf8');
test('floating avatar requires explicit Android overlay permission before starting',async()=>{
 let starts=0,requests=0;
 const native={hasPermission:async()=>false,requestPermission:async()=>{requests++;return false;},show:async()=>{starts++;return true;}};
 const api=loadTS('src/niaOverlay.ts',{'react-native':{Platform:{OS:'android'},NativeModules:{NiaOverlay:native}}});
 assert.equal(await api.showNiaOverlay(),'permission-required');assert.equal(starts,0);assert.equal(requests,1);
 native.hasPermission=async()=>true;
 assert.equal(await api.showNiaOverlay(),'shown');assert.equal(starts,1);
});
test('floating avatar exposes native readiness and can be hidden',async()=>{
 let hidden=false;
 const api=loadTS('src/niaOverlay.ts',{'react-native':{Platform:{OS:'android'},NativeModules:{NiaOverlay:{getStatus:async()=> 'ready',hide:async()=>{hidden=true;}}}}});
 assert.equal(await api.niaOverlayStatus(),'ready');await api.hideNiaOverlay();assert.equal(hidden,true);
 const unsupported=loadTS('src/niaOverlay.ts',{'react-native':{Platform:{OS:'ios'},NativeModules:{}}});
 await assert.rejects(unsupported.showNiaOverlay(),/native Android APK/);
});
test('Android enables the real renderer plugin while production asset checks remain active',()=>{
 const app=JSON.parse(read('app.json'));
 assert.ok(app.expo.plugins.includes('./plugins/withNiaOverlay'));
 const workflow=read('.github/workflows/android.yml');
 assert.match(workflow,/verify_nia_rig.py/);assert.match(workflow,/nia-character-animated.glb/);
 assert.doesNotMatch(workflow,/cp assets\/nia-appearance-facial-rig-v2\.glb/);
});

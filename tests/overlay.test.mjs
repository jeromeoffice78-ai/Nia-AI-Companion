import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('unfinished native floating overlay is not included in production app',()=>{
 const app=JSON.parse(read('app.json'));
 assert.ok(!app.expo.plugins.includes('./plugins/withNiaOverlay'));
 assert.ok(!app.expo.android.permissions.includes('SYSTEM_ALERT_WINDOW'));
 const home=read('app/index.tsx');
 assert.ok(!home.includes('showNiaOverlay('));
});
test('approved avatar is required by Android release',()=>{
 const workflow=read('.github/workflows/android.yml');
 assert.match(workflow,/verify_nia_rig.py/);
 assert.match(workflow,/nia-appearance-facial-rig-v2.glb/);
});

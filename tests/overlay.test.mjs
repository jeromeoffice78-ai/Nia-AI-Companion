import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
test('Android overlay is registered in Expo configuration',()=>{
 const app=JSON.parse(read('app.json'));
 assert.ok(app.expo.plugins.includes('./plugins/withNiaOverlay'));
});
test('overlay requires explicit Android permission and user action',()=>{
 const plugin=read('plugins/withNiaOverlay.js');
 const native=read('native-overlay/NiaOverlayModule.java');
 assert.match(plugin,/SYSTEM_ALERT_WINDOW/);
 assert.match(native,/Settings.canDrawOverlays/);
 assert.match(native,/ACTION_MANAGE_OVERLAY_PERMISSION/);
 assert.match(read('app/index.tsx'),/showNiaOverlay/);
});
test('overlay is draggable, dismissible, and does not activate camera or microphone',()=>{
 const native=read('native-overlay/NiaOverlayModule.java');
 assert.match(native,/ACTION_MOVE/);
 assert.match(native,/hideInternal/);
 assert.match(native,/height\/2/);
 assert.doesNotMatch(native,/CameraManager|AudioRecord|MediaRecorder/);
});

test('tablet layout scrolls when half-screen avatar consumes available height',()=>{
 const screen=read('app/index.tsx');
 assert.match(screen,/contentContainerStyle=\{s\.screenContent\}/);
 assert.match(screen,/keyboardShouldPersistTaps="handled"/);
 assert.match(screen,/<\/ScrollView>;/);
});

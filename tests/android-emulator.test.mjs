import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const read=p=>readFileSync(p,'utf8');
test('emulator smoke uses built APK and waits for Android cold-start UI diagnostics',()=>{
 const workflow=read('.github/workflows/android.yml');
 const script=read('scripts/android-emulator-smoke.sh');
 assert.match(workflow,/emulator-smoke:/);
 assert.match(workflow,/needs: android/);
 assert.match(workflow,/actions\/download-artifact@v4/);
 assert.match(workflow,/reactivecircus\/android-emulator-runner@v2/);
 assert.match(script,/adb install -r "\$APK"/);
 assert.match(script,/am start -W -n/);
 assert.match(script,/Diagnostics: Rigged/);
 assert.match(script,/bones: 25/);
 assert.match(script,/KEYCODE_HOME/);
 assert.match(script,/verify_scene resume/);
 assert.match(script,/::error::Nia did not display/);
 assert.doesNotMatch(script,/if ! adb shell pidof/);
 assert.match(script,/sleep 6/);
 assert.match(script,/android-dialog-coordinates\.py/);
 assert.ok(script.includes('  local phase="$1" i\n  local ui="$OUT/$phase-ui.xml"'));
 assert.ok(!script.includes('local phase="$1" i ui='));
 assert.match(script,/Pixel Launcher isn/);
 assert.match(script,/android:id\/aerr_wait/);
 assert.match(script,/ET\.parse\(sys\.argv\[1\]\)/);
});

function scene(text,app='com.nia.companion'){
 const dir=mkdtempSync(join(tmpdir(),'nia-scene-'));
 try{
  const path=join(dir,'ui.xml');
  writeFileSync(path,`<hierarchy><node package="${app}" text="${text}"/></hierarchy>`);
  return spawnSync('python3',['scripts/verify-android-scene.py',path]).status;
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('scene validation rejects missing geometry, foreign app text and loader errors',()=>{
 const good='Diagnostics: Rigged internal animation test | bones: 25 | skinned meshes: 93';
 assert.equal(scene(good),0);
 assert.equal(scene(good,'com.android.launcher'),1);
 assert.equal(scene(good.replace('meshes: 93','meshes: 0')),1);
 assert.equal(scene(good.replace('bones: 25','bones: 250')),1);
 assert.equal(scene('Diagnostics: Waiting for model'),1);
 assert.equal(scene('Model loading failed: TypeError'),2);
});
test('review builds run without changing main and fresh UI dumps are required',()=>{
 const workflow=read('.github/workflows/android.yml');
 const script=read('scripts/android-emulator-smoke.sh');
 assert.match(workflow,/  pull_request:/);
 assert.match(script,/adb shell rm -f \/sdcard\/nia-smoke-ui.xml/);
 assert.match(script,/within 180 seconds/);
 assert.match(script,/verify-android-scene\.py/);
});

function overlayQuery(nodes,mode,label=''){
 const script=read('scripts/android-emulator-smoke.sh');
 const code=script.match(/<<'PY_OVERLAY_QUERY'\n([\s\S]*?)\nPY_OVERLAY_QUERY/)[1];
 const dir=mkdtempSync(join(tmpdir(),'nia-overlay-query-'));
 try{
  const path=join(dir,'ui.xml');
  writeFileSync(path,nodes);
  const result=spawnSync('python3',['-',path,mode,label],{input:code,encoding:'utf8'});
  return {status:result.status,text:result.stdout.trim()};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('native status requires explicit Nia readiness and rejects provider errors or stale foreign text',()=>{
 const xml=text=>`<hierarchy><node package="com.nia.companion" text="${text}"/></hierarchy>`;
 assert.equal(overlayQuery(xml('Floating Nia: ready'),'status').status,0);
 assert.equal(overlayQuery(xml('Floating Nia: loading'),'status').status,1);
 assert.equal(overlayQuery(xml('Floating Nia: error: WebGL stopped'),'status').status,2);
 assert.equal(overlayQuery(xml('Floating Nia: ready').replace('com.nia.companion','com.android.launcher'),'status').status,1);
 assert.equal(overlayQuery('<hierarchy>','status').status,1);
});
function windowQuery(data,mode,density='Physical density: 420'){
 const script=read('scripts/android-emulator-smoke.sh');
 const code=script.match(/<<'PY_OVERLAY_WINDOW'\n([\s\S]*?)\nPY_OVERLAY_WINDOW/)[1];
 const dir=mkdtempSync(join(tmpdir(),'nia-overlay-window-'));
 try{
  const windows=join(dir,'windows.txt'),scale=join(dir,'density.txt');
  writeFileSync(windows,data);writeFileSync(scale,density);
  const result=spawnSync('python3',['-',windows,mode,scale],{input:code,encoding:'utf8'});
  return {status:result.status,text:result.stdout.trim()};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
const homeWindow=`WINDOW MANAGER WINDOWS (dumpsys window windows)
  Window #0 Window{a123 u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}:
    mAttrs={(0,0)(fillxfill) ty=BASE_APPLICATION}
    mHasSurface=true isOnScreen=true isVisible=true
  mCurrentFocus=Window{a123 u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}
`;
const overlayWindow=`  Window #1 Window{b234 u0 com.nia.companion}:
    mOwnerUid=10234 package=com.nia.companion appop=SYSTEM_ALERT_WINDOW
    mAttrs={(270,600)(540x1200) ty=APPLICATION_OVERLAY fmt=TRANSLUCENT}
    mViewVisibility=0x0 mHasSurface=true
    Frames: parent=[0,0][1080,2400] display=[0,0][1080,2400] frame=[270,600][810,1800]
    isOnScreen=true isVisible=true
`;
test('visible application-overlay proof rejects invisible, missing, foreign or ordinary activity windows',()=>{
 assert.equal(windowQuery(homeWindow+overlayWindow,'visible').status,0);
 assert.equal(windowQuery(homeWindow+overlayWindow.replace('APPLICATION_OVERLAY','2038'),'visible').status,0);
 assert.equal(windowQuery(homeWindow,'visible').status,1);
 assert.equal(windowQuery(homeWindow+overlayWindow.replace('mHasSurface=true','mHasSurface=false'),'visible').status,1);
 assert.equal(windowQuery(homeWindow+overlayWindow.replaceAll('=true','=false'),'visible').status,1);
 assert.equal(windowQuery(homeWindow+overlayWindow.replace('mViewVisibility=0x0','mViewVisibility=0x8'),'visible').status,1);
 assert.equal(windowQuery(homeWindow+overlayWindow.replaceAll('com.nia.companion','com.other.app'),'visible').status,1);
 assert.equal(windowQuery(homeWindow+overlayWindow.replace('APPLICATION_OVERLAY','BASE_APPLICATION'),'visible').status,1);
 assert.equal(windowQuery(homeWindow+overlayWindow.replace('frame=[270,600][810,1800]','frame=[0,0][0,0]'),'visible').status,1);
});
test('nonfocusable overlay Close uses actual window frame and density; disappearance is verified independently of UIA',()=>{
 assert.deepEqual(windowQuery(homeWindow+overlayWindow,'close'),{status:0,text:'720 1742'});
 assert.deepEqual(windowQuery(homeWindow+overlayWindow,'close','Physical density: 420\nOverride density: 320'),{status:0,text:'720 1756'});
 assert.equal(windowQuery(homeWindow+overlayWindow,'close','').status,1);
 assert.equal(windowQuery(homeWindow+overlayWindow,'closed').status,1);
 assert.equal(windowQuery(homeWindow,'closed').status,0);
 assert.equal(windowQuery('','closed').status,1);
 assert.equal(windowQuery(homeWindow+overlayWindow,'home').status,0);
 assert.equal(windowQuery(homeWindow.replace('mCurrentFocus=Window{a123 u0 com.google.android.apps.nexuslauncher/com.google.android.apps.nexuslauncher.NexusLauncherActivity}','mCurrentFocus=Window{c123 u0 com.nia.companion/.MainActivity}'),'home').status,1);
});
test('overlay proof requires fresh post-Show renderer readiness and captures surfaces over Home',()=>{
 const script=read('scripts/android-emulator-smoke.sh');
 assert.match(script,/appops set "\$APP" SYSTEM_ALERT_WINDOW allow/);
 assert.match(script,/adb logcat -c\n# Stale READY[\s\S]*?tap_label "Show floating Nia" true/);
 assert.match(script,/NiaOverlay\.\*NIA_OVERLAY_READY/);
 assert.match(script,/NiaOverlay\.\*\(error:\|NIA_OVERLAY_ERROR\)/);
 assert.match(script,/overlay_window "\$OUT\/\$phase-windows.txt" visible/);
 assert.match(script,/dumpsys SurfaceFlinger --list/);
 assert.match(script,/verify_overlay overlay-home/);
 assert.match(script,/overlay-home-windows.txt" close/);
 assert.match(script,/overlay-closed-windows.txt" closed/);
});

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
function overlayNodes(label,packageName='com.nia.companion'){
 return `<hierarchy><node package="${packageName}" text="Nia • drag to move"/><node package="${packageName}" text="${label}"/></hierarchy>`;
}
test('overlay requires real rendered diagnostics from Nia and detects explicit render failure',()=>{
 assert.equal(overlayQuery(overlayNodes('Internal 3D test rig • 25 bones'),'ready').status,0);
 assert.equal(overlayQuery(overlayNodes('3D rig ready • 25 bones'),'ready').status,0);
 assert.equal(overlayQuery(overlayNodes('Internal 3D test rig • 25 bones','com.android.launcher'),'ready').status,1);
 assert.equal(overlayQuery(overlayNodes('Loading bundled 3D test rig…'),'ready').status,1);
 assert.equal(overlayQuery(overlayNodes('Internal 3D test rig • 250 bones'),'ready').status,1);
 assert.equal(overlayQuery(overlayNodes('3D overlay could not start: WebGL unavailable'),'ready').status,2);
 assert.equal(overlayQuery('<hierarchy>','ready').status,1);
});
test('overlay close control is located by Nia bounds and closure requires fresh valid UI',()=>{
 const xml='<hierarchy><node package="com.nia.companion" text="CLOSE" bounds="[100,200][300,260]" enabled="true"/></hierarchy>';
 assert.deepEqual(overlayQuery(xml,'tap','Close'),{status:0,text:'200 230'});
 assert.equal(overlayQuery(xml.replace('com.nia.companion','com.android.launcher'),'tap','Close').status,1);
 assert.equal(overlayQuery(overlayNodes('Internal 3D test rig • 25 bones'),'closed').status,1);
 assert.equal(overlayQuery('<hierarchy><node package="com.android.launcher" text="Home"/></hierarchy>','closed').status,0);
 assert.equal(overlayQuery('<hierarchy/>','closed').status,1);
 assert.equal(overlayQuery('','closed').status,1);
 const script=read('scripts/android-emulator-smoke.sh');
 assert.match(script,/appops set "\$APP" SYSTEM_ALERT_WINDOW allow/);
 assert.match(script,/verify_overlay overlay-home/);
 assert.match(script,/tap_label "Close"/);
});

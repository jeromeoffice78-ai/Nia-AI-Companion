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

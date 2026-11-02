import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
function location(xml){
 const folder=mkdtempSync(join(tmpdir(),'nia-dialog-'));
 const path=join(folder,'ui.xml');
 try{
  writeFileSync(path,xml);
  const p=spawnSync('python3',['scripts/android-dialog-coordinates.py',path],{encoding:'utf8'});
  return {status:p.status,out:p.stdout.trim()};
 }finally{rmSync(folder,{recursive:true,force:true});}
}
const layout=button=>`<hierarchy><node text="Pixel Launcher isn't responding"><node text="${button}" bounds="[70,1296][1010,1422]"/></node></hierarchy>`;
test('recover Pixel Launcher ANR by choosing centered Wait button',()=>{
 const result=location(layout('Wait'));
 assert.equal(result.status,0);
 assert.equal(result.out,'540 1359');
});
test('never tap Close app or unrelated permission dialogs',()=>{
 assert.notEqual(location(layout('Close app')).status,0);
 assert.notEqual(location('<hierarchy><node text="Nia"><node text="Wait" bounds="[1,1][200,200]"/></node></hierarchy>').status,0);
});
test('smoke workflow recovers launcher ANR before diagnosing Nia',()=>{
 const script=readFileSync('scripts/android-emulator-smoke.sh','utf8');
 assert.match(script,/android-dialog-coordinates\.py/);
 assert.match(script,/adb shell input tap \$coords/);
 assert.match(script,/Emulator infrastructure problem/);
});

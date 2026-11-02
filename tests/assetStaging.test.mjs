import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const src=readFileSync('scripts/prepare_nia_asset.py','utf8');
test('asset staging rejects missing files rather than replacing the working rig',()=>{
 const p=spawnSync('python3',['scripts/prepare_nia_asset.py','assets/not-found.glb','--mode','animated-test'],{encoding:'utf8'});
 assert.notEqual(p.status,0);
 assert.match(p.stderr,/Source GLB file does not exist/);
});
test('static preview cannot become bundled rig or approved production asset',()=>{
 assert.match(src,/assets\/nia-static-preview\.glb/);
 assert.match(src,/assets\/nia-character-animated\.glb/);
 assert.match(src,/production_approved":False/);
 assert.match(src,/verify_nia_rig\.py/);
 assert.doesNotMatch(src,/nia-production-approved\.glb/);
});
test('both Android workflows preserve any newly staged animated rig',()=>{
 for(const file of ['.github/workflows/android.yml','.github/workflows/android-preview.yml']){
  const y=readFileSync(file,'utf8');
  assert.doesNotMatch(y,/cp assets\/nia-appearance-facial-rig-v2\.glb assets\/nia-character-animated\.glb/);
  assert.match(y,/python3 scripts\/verify_nia_rig\.py assets\/nia-character-animated\.glb/);
 }
});

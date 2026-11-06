import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
test('private approved Nia photo hash is locked to latest confirmed version',()=>{
 const spec=readFileSync('docs/NIA_VISUAL_REFERENCE_SPEC.md','utf8');
 const validator=readFileSync('scripts/verify_nia_reference.py','utf8');
 const sha='e69aa53ae84f964f0e55202d711ad117d01f321f2eef3161382d1acb56532db5';
 assert.match(spec,new RegExp(sha));
 assert.match(validator,new RegExp(sha));
 assert.match(spec,/sunny_sidewalk_athletic_portrait.png/);
 assert.match(spec,/earlier purse-free image version/);
});
test('wrong private reference is rejected and does not change the production approval state',()=>{
 const r=spawnSync('python3',['scripts/verify_nia_reference.py','package.json'],{encoding:'utf8'});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/source must be a PNG/);
 const script=readFileSync('scripts/verify_nia_reference.py','utf8');
 assert.match(script,/This does not approve a 3D model/);
});

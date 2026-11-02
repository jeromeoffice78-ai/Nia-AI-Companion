import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const check=(asset,approval='docs/nia-production-approval.json')=>
 spawnSync('python3',['scripts/verify_nia_production.py',asset,'--approval',approval],{encoding:'utf8'});
test('existing segmented mannequin must fail production release preflight',()=>{
 const result=check('assets/nia-appearance-facial-rig-v2.glb');
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/Prototype\/mannequin source/);
 assert.match(result.stderr,/No embedded appearance texture images/);
 assert.match(result.stderr,/Owner-approved model hash manifest is missing/);
});
test('missing production model fails closed',()=>{
 const result=check('assets/not-produced.glb');
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/separate production avatar GLB/);
});
test('internal Android preview workflow does not assert it is a production release',()=>{
 const wf=readFileSync('.github/workflows/android-preview.yml','utf8');
 assert.match(wf,/Nia Internal Android Preview Verification/);
 assert.doesNotMatch(wf,/Require completed production avatar rig/);
});

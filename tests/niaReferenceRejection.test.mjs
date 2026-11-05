import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

test('rejected Nia portrait styling never enters the active Android renderer',()=>{
 const renderer=readFileSync('src/loadNiaGLB.ts','utf8');
 assert.doesNotMatch(renderer,/applyNiaReferenceStyling|niaAppearance/);
 assert.equal(existsSync('src/niaAppearance.ts'),false);
 const visual=readFileSync('docs/NIA_VISUAL_REFERENCE_SPEC.md','utf8');
 assert.match(visual,/SOURCE REJECTED \/ APPROVAL REQUIRED/);
 assert.match(visual,/Do not use the incorrect portrait to model Nia/);
});
test('Nia release still requires explicit approved asset and device validation',()=>{
 const gate=readFileSync('scripts/verify_nia_production.py','utf8');
 assert.match(gate,/approved_glb_sha256/);
 assert.match(gate,/likeness_reviewed/);
 assert.match(gate,/android_device_visual_test/);
 const doc=readFileSync('docs/PRODUCTION_RELEASE.md','utf8');
 assert.match(doc,/Current status: BLOCKED/);
});
test('reject wrong reference derived files from likeness modeling',()=>{
 const visual=readFileSync('docs/NIA_VISUAL_REFERENCE_SPEC.md','utf8');
 for(const wrong of [
  'Nia AI Companion Character Portrait.png',
  'Nia_Private_3D_Modeling_References.zip'
 ])assert.ok(visual.includes(wrong),'Rejected source is not documented: '+wrong);
});

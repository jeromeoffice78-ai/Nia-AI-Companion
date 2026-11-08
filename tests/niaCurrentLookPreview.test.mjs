import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {loadTS} from './loadTS.mjs';
const {applyCurrentNiaLookPreview}=loadTS('src/niaCurrentLookPreview.ts');
test('current Nia look preview is prototype-specific and keeps the same skeleton',async()=>{
 const buf=readFileSync('assets/nia-character-animated.glb');
 const b=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
 const gltf=await new GLTFLoader().parseAsync(b,'');
 const model=gltf.scene;
 const clips=gltf.animations.map(c=>c.name);
 const face=model.children.find(x=>x.name.toLowerCase().replace(/[^a-z0-9]/g,'')==='faciallipsyncblendshapecontrols');
 const morphs=Object.keys(face.morphTargetDictionary||{});
 const r=applyCurrentNiaLookPreview(model);
 assert.equal(r.applied,true);
 assert.ok(r.created>=27);
 assert.ok(r.hidden>=16);
 const group=model.getObjectByName('Nia approved-look preview ponytail anchor');
 assert.ok(group);
 assert.equal(group.parent.name,'Head');
 assert.equal(applyCurrentNiaLookPreview(model).applied,false);
 assert.deepEqual(gltf.animations.map(c=>c.name),clips);
 assert.ok(morphs.includes('viseme_AA'));
 assert.deepEqual(Object.keys(face.morphTargetDictionary||{}),morphs);
 assert.ok(model.children.some(x=>x.name.includes('Hips')));
});
test('appearance preview does not claim final likeness or add unapproved clothing',()=>{
 const code=readFileSync('src/niaCurrentLookPreview.ts','utf8');
 assert.match(code,/NEVER treat this procedural hairstyle as the approved photorealistic 3D likeness/);
 assert.doesNotMatch(code,/mauve|camisole|pink|purse base/);
 const loader=readFileSync('src/loadNiaGLB.ts','utf8');
 assert.match(loader,/applyCurrentNiaLookPreview\(model\)/);
});
test('Android test app version increments without clearing release gate',()=>{
 const version=JSON.parse(readFileSync('app.json','utf8')).expo;
 assert.match(version.version,/^0\.1\.\d+$/);assert.ok(version.android.versionCode>=11);
 assert.match(readFileSync('docs/PRODUCTION_RELEASE.md','utf8'),/Current status: BLOCKED/);
});

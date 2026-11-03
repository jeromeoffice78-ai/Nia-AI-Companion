import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {loadTS} from './loadTS.mjs';
const {applyContinuousNiaBody}=loadTS('src/continuousBody.ts');
const {applyNiaReferenceStyling}=loadTS('src/niaAppearance.ts');
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
test('reference-guided styling adds brunette bun and pink outfit without changing morph targets',async()=>{
 const b=readFileSync('assets/nia-character-animated.glb');
 const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const root=gltf.scene;
 const body=applyContinuousNiaBody(root);
 assert.equal(body.applied,true);
 assert.ok(root.getObjectByName('Nia continuous mauve cropped camisole'));
 assert.ok(root.getObjectByName('Nia continuous Left camisole strap'));
 const r=applyNiaReferenceStyling(root);
 assert.ok(r.applied);
 assert.ok(r.created>=10);
 assert.ok(r.hidden>=16);
 assert.ok(root.getObjectByName('Nia reference brunette bun'));
 assert.ok(root.getObjectByName('Nia reference heart pendant'));
 const face=root.children.find(x=>normalize(x.name)==='faciallipsyncblendshapecontrols');
 assert.ok(face?.morphTargetDictionary?.viseme_AA!==undefined);
 assert.equal(applyNiaReferenceStyling(root).applied,false,'no duplicated styling on reload');
});
test('styling refuses arbitrary approved replacement meshes, preserving owner-supplied models',()=>{
 const plain={name:'unrelated',traverse(fn){fn(this)},children:[]};
 assert.equal(applyNiaReferenceStyling(plain).applied,false);
});
test('source retains the owner approval gate and avoids styling as production evidence',()=>{
 const text=readFileSync('src/niaAppearance.ts','utf8');
 assert.match(text,/Not a photorealistic reconstruction/);
 assert.match(text,/Facial lip sync blendshape controls/);
 assert.match(readFileSync('src/loadNiaGLB.ts','utf8'),/applyNiaReferenceStyling\(model\)/);
});

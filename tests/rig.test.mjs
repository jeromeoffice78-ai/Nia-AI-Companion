import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AnimationMixer,SkinnedMesh,Vector3} from 'three';
test('bundled rig loads, skins, and moves with real Three.js animation',async()=>{
 const bytes=readFileSync('assets/nia-character-animated.glb');
 const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 let skinned=0;model.scene.traverse(node=>{if(node instanceof SkinnedMesh){skinned++;assert.equal(node.skeleton.bones.length,25);}});
 assert.ok(skinned>0);
 assert.deepEqual(model.animations.map(a=>a.name),['Idle','Walk','Dance','Wave']);
 const hand=model.scene.getObjectByName('RightHand');assert.ok(hand);
 const mixer=new AnimationMixer(model.scene);mixer.clipAction(model.animations.find(a=>a.name==='Wave')).play();
 model.scene.updateMatrixWorld(true);const before=hand.getWorldPosition(new Vector3()).clone();
 mixer.update(.4);model.scene.updateMatrixWorld(true);const after=hand.getWorldPosition(new Vector3());
 assert.ok(before.distanceTo(after)>.001,'Wave must move a skeletal hand');
});

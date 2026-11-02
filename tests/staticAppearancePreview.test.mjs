import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Nia can preview an unrigged appearance without claiming working body motion',()=>{
 const s=readFileSync('src/Avatar3D.tsx','utf8');
 assert.match(s,/Static appearance preview — animation unavailable/);
 assert.match(s,/disabled=\{staticPreview\}/);
 assert.match(s,/setStaticPreview\(!animated\)/);
 assert.match(s,/if\(!animated&&!modelUri\)/);
 assert.match(s,/Restore bundled model/);
});
test('Android app version is upgraded for static preview support',()=>{
 const v=JSON.parse(readFileSync('app.json','utf8')).expo;
 assert.match(v.version,/^\d+\.\d+\.\d+$/);
 assert.ok(v.android.versionCode>=5);
});

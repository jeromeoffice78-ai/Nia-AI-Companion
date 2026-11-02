import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('emulator smoke test installs the exact APK that passed the build job',()=>{
 const workflow=readFileSync('.github/workflows/android.yml','utf8');
 const script=readFileSync('scripts/android-emulator-smoke.sh','utf8');
 assert.match(workflow,/emulator-smoke:/);
 assert.match(workflow,/needs: android/);
 assert.match(workflow,/actions\/download-artifact@v4/);
 assert.match(workflow,/reactivecircus\/android-emulator-runner@v2/);
 assert.match(script,/adb install -r "\$APK"/);
 assert.match(script,/Diagnostics: Rigged/);
 assert.match(script,/bones: 25/);
 assert.match(script,/KEYCODE_HOME/);
 assert.match(script,/verify_scene resume/);
 assert.match(script,/::error::Nia never displayed/);
});

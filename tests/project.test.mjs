import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const config=JSON.parse(readFileSync('app.json','utf8'));
test('Android package configured',()=>assert.equal(config.expo.android.package,'com.nia.companion'));
test('app entrypoint exists',()=>assert.ok(existsSync('app/index.tsx')));
test('microphone permission declared',()=>assert.ok(config.expo.android.permissions.includes('RECORD_AUDIO')));

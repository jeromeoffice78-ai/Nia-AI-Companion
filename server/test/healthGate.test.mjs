import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('unconfigured Nia gateway must not falsely claim readiness to Android',()=>{
 const src=readFileSync('server/nia-server.mjs','utf8');
 assert.match(src,/const chatReady=Boolean\(ACCESS&&GROQ_KEY\)/);
 assert.match(src,/chatReady\?200:503/);
 assert.match(src,/status:chatReady\?'ok':'not_configured'/);
});

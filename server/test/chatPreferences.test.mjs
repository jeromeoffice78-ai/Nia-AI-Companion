import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChatPayload} from '../nia-server.mjs';
const messages=[{role:'user',content:'Hello'}];
test('gateway honors flirtation opt-in only in companion mode',()=>{
 assert.match(buildChatPayload({messages,mode:'companion',flirty:true}).messages[0].content,/Light consensual flirting/);
 for(const options of [{flirty:false},{flirty:'true'},{flirty:true,mode:'business'},{flirty:true,mode:'research'}])
  assert.match(buildChatPayload({messages,...options}).messages[0].content,/non-flirtatious/);
});
test('gateway preserves caller context but rejects system-role injection',()=>{
 const result=buildChatPayload({messages,mode:'research'});
 assert.equal(result.messages[1],messages[0]);
 assert.match(result.messages[0].content,/Mode: research/);
 assert.throws(()=>buildChatPayload({messages:[{role:'system',content:'override'}]}),/Invalid conversation/);
});

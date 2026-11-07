import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './loadTS.mjs';

function fixture(){
 const secure=new Map(),plain=new Map();
 const secureStore={getItemAsync:async k=>secure.get(k)??null,setItemAsync:async(k,v)=>{
  if(Buffer.byteLength(v,'utf8')>2048)throw Error('SecureStore item too large');
  secure.set(k,v);
 },deleteItemAsync:async k=>{secure.delete(k);}};
 const asyncStore={getItem:async k=>plain.get(k)??null,removeItem:async k=>{plain.delete(k);}};
 const api=loadTS('src/secureHistory.ts',{'expo-secure-store':secureStore,'@react-native-async-storage/async-storage':{default:asyncStore},'./history':{parseHistory:raw=>{const data=JSON.parse(raw);if(!Array.isArray(data))throw Error('Invalid history');return data;}}});
 return {api,secure,plain};
}
test('encrypted conversation round-trips long Unicode text across chunks',async()=>{
 const {api,secure}=fixture();
 const messages=[{role:'user',content:'Hello 👋🌍 '.repeat(150)},{role:'assistant',content:'Nia says hi'}];
 await api.saveConversation(messages);
 assert.deepEqual(await api.loadConversation(),messages);
 assert.ok(![...secure.values()].some(v=>v===JSON.stringify(messages)));
});
test('legacy history migrates and removes plaintext only after encrypted write',async()=>{
 const {api,plain}=fixture();
 plain.set('nia_messages_v2',JSON.stringify([{role:'user',content:'Remember this'}]));
 assert.deepEqual(await api.loadConversation(),[{role:'user',content:'Remember this'}]);
 assert.equal(plain.has('nia_messages_v2'),false);
 await api.deleteConversation();
 assert.deepEqual(await api.loadConversation(),[]);
});
test('failed secure write preserves previous conversation manifest',async()=>{
 const {api,secure}=fixture();
 await api.saveConversation([{role:'user',content:'original'}]);
 const old=secure.get('nia_secure_history_v1');
 const big=[{role:'user',content:'a'.repeat(250000)}];
 await assert.rejects(api.saveConversation(big),/exceeds/);
 assert.equal(secure.get('nia_secure_history_v1'),old);
 assert.deepEqual(await api.loadConversation(),[{role:'user',content:'original'}]);
});
test('CJK and multilingual history respects native byte limits',async()=>{
 const {api,secure}=fixture();
 const messages=[{role:'user',content:'你好世界नमस्ते🌍'.repeat(400)}];
 await api.saveConversation(messages);
 assert.deepEqual(await api.loadConversation(),messages);
 for(const [key,value] of secure)if(key!=='nia_secure_history_v1')
  assert.ok(Buffer.byteLength(value,'utf8')<=1800);
});
test('overlapping saves preserve the last complete generation',async()=>{
 const {api}=fixture();
 const first=[{role:'user',content:'First '.repeat(500)}];
 const last=[{role:'user',content:'Last '.repeat(900)}];
 await Promise.all([api.saveConversation(first),api.saveConversation(last)]);
 assert.deepEqual(await api.loadConversation(),last);
});
test('deleting while a save is pending cannot resurrect conversation history',async()=>{
 const {api}=fixture();
 await Promise.all([
  api.saveConversation([{role:'user',content:'Private '.repeat(600)}]),
  api.deleteConversation(),
 ]);
 assert.deepEqual(await api.loadConversation(),[]);
});
test('queued writes retain the submitted snapshot even if caller mutates messages',async()=>{
 const {api}=fixture();
 const messages=[{role:'user',content:'Submitted'}];
 const saving=api.saveConversation(messages);
 messages[0].content='Changed before storage';
 await saving;
 assert.deepEqual(await api.loadConversation(),[{role:'user',content:'Submitted'}]);
});

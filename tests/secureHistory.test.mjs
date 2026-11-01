import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './loadTS.mjs';

function fixture(){
 const secure=new Map(),plain=new Map();
 const secureStore={getItemAsync:async k=>secure.get(k)??null,setItemAsync:async(k,v)=>{secure.set(k,v);},deleteItemAsync:async k=>{secure.delete(k);}};
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

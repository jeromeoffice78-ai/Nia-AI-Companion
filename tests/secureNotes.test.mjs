import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './loadTS.mjs';

function fixture(){
 const secure=new Map(),plain=new Map();
 const controls={failWrite:()=>false};
 const secureStore={
  getItemAsync:async key=>secure.get(key)??null,
  setItemAsync:async(key,value)=>{
   if(Buffer.byteLength(value,'utf8')>2048)throw new Error('Native item too large');
   if(controls.failWrite(key,value))throw new Error('Simulated secure write failure');
   secure.set(key,value);
  },
  deleteItemAsync:async key=>{secure.delete(key);},
 };
 const asyncStore={getItem:async key=>plain.get(key)??null,removeItem:async key=>{plain.delete(key);}};
 const api=loadTS('src/secureNotes.ts',{
  'expo-secure-store':secureStore,
  '@react-native-async-storage/async-storage':{default:asyncStore},
 });
 return {api,secure,plain,controls};
}
test('memory notes round-trip multilingual text within native byte limits',async()=>{
 const {api,secure}=fixture();
 const notes='你好世界'.repeat(500);
 await api.saveMemoryNotes(notes);
 assert.equal(await api.loadMemoryNotes(),notes);
 assert.ok(secure.size>2);
 for(const value of secure.values())assert.ok(Buffer.byteLength(value,'utf8')<=1800);
});
test('legacy plaintext migrates only after all encrypted chunks commit',async()=>{
 const {api,plain,secure}=fixture();
 plain.set('nia_memory_notes','My approved preferences');
 assert.equal(await api.loadMemoryNotes(),'My approved preferences');
 assert.equal(plain.has('nia_memory_notes'),false);
 assert.ok(secure.has('nia_secure_notes_v1'));
});
test('failed migration preserves plaintext for retry without a partial manifest',async()=>{
 const {api,plain,secure,controls}=fixture();
 const notes='你'.repeat(1500);
 plain.set('nia_memory_notes',notes);
 controls.failWrite=key=>key.endsWith('_a_1');
 await assert.rejects(api.loadMemoryNotes(),/Simulated secure write/);
 assert.equal(plain.get('nia_memory_notes'),notes);
 assert.equal(secure.has('nia_secure_notes_v1'),false);
 controls.failWrite=()=>false;
 assert.equal(await api.loadMemoryNotes(),notes);
 assert.equal(plain.has('nia_memory_notes'),false);
});
test('failed replacement leaves the last committed notes readable',async()=>{
 const {api,controls}=fixture();
 await api.saveMemoryNotes('Keep these notes');
 controls.failWrite=key=>key==='nia_secure_notes_v1';
 await assert.rejects(api.saveMemoryNotes('New notes'),/Simulated secure write/);
 assert.equal(await api.loadMemoryNotes(),'Keep these notes');
 controls.failWrite=()=>false;
 await api.saveMemoryNotes('New notes');
 assert.equal(await api.loadMemoryNotes(),'New notes');
});
test('delete queued behind a save removes notes and interrupted generations',async()=>{
 const {api,secure,plain}=fixture();
 plain.set('nia_memory_notes','Legacy notes');
 secure.set('nia_secure_notes_v1_b_3','Orphaned encrypted notes');
 await Promise.all([api.saveMemoryNotes('Saved notes'),api.deleteMemoryNotes()]);
 assert.equal(await api.loadMemoryNotes(),'');
 assert.equal(secure.size,0);
 assert.equal(plain.size,0);
});
test('corrupt or incomplete encrypted notes fail closed, but can be erased',async()=>{
 const {api,secure,plain}=fixture();
 plain.set('nia_memory_notes','Outdated plaintext');
 secure.set('nia_secure_notes_v1',JSON.stringify({generation:'a',count:1,length:7}));
 await assert.rejects(api.loadMemoryNotes(),/incomplete/);
 secure.set('nia_secure_notes_v1','broken manifest');
 await assert.rejects(api.loadMemoryNotes(),/manifest is invalid/);
 await api.deleteMemoryNotes();
 assert.equal(await api.loadMemoryNotes(),'');
 assert.equal(plain.size,0);
});
test('oversized notes cannot replace valid notes, and empty notes round-trip',async()=>{
 const {api}=fixture();
 await api.saveMemoryNotes('Keep');
 await assert.rejects(api.saveMemoryNotes('x'.repeat(2001)),/at most 2,000/);
 assert.equal(await api.loadMemoryNotes(),'Keep');
 await api.saveMemoryNotes('');
 assert.equal(await api.loadMemoryNotes(),'');
});

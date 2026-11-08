import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {parseHistory} from './history';
import type {NiaMessage} from './niaGateway';

/** Android Keystore-backed encrypted storage, split to respect SecureStore item limits.
 * A two-generation manifest prevents interrupted writes from corrupting saved history.
 */
const ROOT='nia_secure_history_v1';
const LEGACY='nia_messages_v2';
const CHUNK=800;
// SecureStore limits apply to UTF-8 bytes, not JavaScript string length.
// Leave headroom below 2 KB for non-ASCII text and native storage overhead.
const CHUNK_BYTES=1800;
const MAX_CHUNKS=300;
let pending:Promise<void>=Promise.resolve();
function exclusively<T>(operation:()=>Promise<T>):Promise<T>{
 const next=pending.then(operation);
 pending=next.then(()=>undefined,()=>undefined);
 return next;
}
type Manifest={generation:string;count:number};
function validManifest(value:unknown):value is Manifest{
 if(!value||typeof value!=='object')return false;
 const m=value as Record<string,unknown>;
 return (m.generation==='a'||m.generation==='b')&&Number.isInteger(m.count)&&Number(m.count)>=0&&Number(m.count)<=MAX_CHUNKS;
}
async function readEncrypted():Promise<NiaMessage[]|null>{
 const raw=await SecureStore.getItemAsync(ROOT);
 if(!raw)return null;
 const manifest:unknown=JSON.parse(raw);
 if(!validManifest(manifest))throw new Error('Encrypted conversation manifest is invalid.');
 const parts:string[]=[];
 for(let i=0;i<manifest.count;i++){
  const value=await SecureStore.getItemAsync(ROOT+'_'+manifest.generation+'_'+i);
  if(value===null)throw new Error('Encrypted conversation is incomplete.');
  parts.push(value);
 }
 return parseHistory(parts.join(''));
}
async function loadSavedConversation():Promise<NiaMessage[]>{
 const saved=await readEncrypted();
 if(saved!==null)return saved;
 const legacy=await AsyncStorage.getItem(LEGACY);
 if(!legacy)return [];
 const messages=parseHistory(legacy);
 await saveEncryptedConversation(messages);
 await AsyncStorage.removeItem(LEGACY);
 return messages;
}
async function saveEncryptedConversation(messages:NiaMessage[]):Promise<void>{
 const raw=JSON.stringify(messages.slice(-200));
 const parts:string[]=[];
 let chunk='';
 let chunkBytes=0;
 for(const character of raw){
  const point=character.codePointAt(0)!;
  const bytes=point<=0x7f?1:point<=0x7ff?2:point<=0xffff?3:4;
  if(chunk.length+character.length>CHUNK||chunkBytes+bytes>CHUNK_BYTES){parts.push(chunk);chunk='';chunkBytes=0;}
  chunk+=character;
  chunkBytes+=bytes;
 }
 if(chunk)parts.push(chunk);
 if(parts.length>MAX_CHUNKS)throw new Error('Encrypted conversation exceeds 240 KB. Export or clear older messages first.');
 const previousRaw=await SecureStore.getItemAsync(ROOT);
 const previous:unknown=previousRaw?JSON.parse(previousRaw):null;
 if(previous!==null&&!validManifest(previous))throw new Error('Encrypted conversation manifest is invalid.');
 const generation=previous&&validManifest(previous)&&previous.generation==='a'?'b':'a';
 for(let i=0;i<parts.length;i++)await SecureStore.setItemAsync(ROOT+'_'+generation+'_'+i,parts[i]);
 await SecureStore.setItemAsync(ROOT,JSON.stringify({generation,count:parts.length}));
 if(previous&&validManifest(previous)){
  for(let i=0;i<previous.count;i++)await SecureStore.deleteItemAsync(ROOT+'_'+previous.generation+'_'+i);
 }
}
async function deleteSavedConversation():Promise<void>{
 const raw=await SecureStore.getItemAsync(ROOT);
 const manifest:unknown=raw?JSON.parse(raw):null;
 await SecureStore.deleteItemAsync(ROOT);
 if(validManifest(manifest)){
  for(let i=0;i<manifest.count;i++)await SecureStore.deleteItemAsync(ROOT+'_'+manifest.generation+'_'+i);
 }
 await AsyncStorage.removeItem(LEGACY);
}

// A manifest generation must never be overwritten or removed by a concurrent
// save/delete/migration. Failed operations release the queue for a safe retry.
export function loadConversation():Promise<NiaMessage[]>{
 return exclusively(loadSavedConversation);
}
export function saveConversation(messages:NiaMessage[]):Promise<void>{
 const snapshot=messages.slice(-200).map(message=>({...message}));
 return exclusively(()=>saveEncryptedConversation(snapshot));
}
export function deleteConversation():Promise<void>{
 return exclusively(deleteSavedConversation);
}

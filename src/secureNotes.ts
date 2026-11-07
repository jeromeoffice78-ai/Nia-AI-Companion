import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** User-approved memory notes, encrypted with the same native store as tokens.
 * Commit a manifest only after every byte-bounded chunk is durably written.
 */
const ROOT='nia_secure_notes_v1';
const LEGACY='nia_memory_notes';
const MAX_CHARACTERS=2000;
const CHUNK_BYTES=1800;
const MAX_CHUNKS=4;
type Manifest={generation:'a'|'b';count:number;length:number};
let pending:Promise<void>=Promise.resolve();
function exclusively<T>(operation:()=>Promise<T>):Promise<T>{
 const next=pending.then(operation);
 pending=next.then(()=>undefined,()=>undefined);
 return next;
}
function validateNotes(notes:unknown):asserts notes is string{
 if(typeof notes!=='string'||notes.length>MAX_CHARACTERS)
  throw new Error('Memory notes must be a string of at most 2,000 characters.');
}
function parseManifest(raw:string):Manifest{
 let value:unknown;
 try{value=JSON.parse(raw);}catch{throw new Error('Encrypted memory notes manifest is invalid.');}
 if(!value||typeof value!=='object')throw new Error('Encrypted memory notes manifest is invalid.');
 const m=value as Record<string,unknown>;
 if((m.generation!=='a'&&m.generation!=='b')||!Number.isInteger(m.count)||
  Number(m.count)<0||Number(m.count)>MAX_CHUNKS||!Number.isInteger(m.length)||
  Number(m.length)<0||Number(m.length)>MAX_CHARACTERS||
  (Number(m.count)===0)!==(Number(m.length)===0))
  throw new Error('Encrypted memory notes manifest is invalid.');
 return m as Manifest;
}
async function readEncrypted():Promise<string|null>{
 const raw=await SecureStore.getItemAsync(ROOT);
 if(raw===null)return null;
 const manifest=parseManifest(raw);
 const parts:string[]=[];
 for(let i=0;i<manifest.count;i++){
  const value=await SecureStore.getItemAsync(ROOT+'_'+manifest.generation+'_'+i);
  if(value===null)throw new Error('Encrypted memory notes are incomplete.');
  parts.push(value);
 }
 const notes=parts.join('');
 validateNotes(notes);
 if(notes.length!==manifest.length)throw new Error('Encrypted memory notes are incomplete.');
 return notes;
}
async function writeEncrypted(notes:string):Promise<void>{
 validateNotes(notes);
 const previousRaw=await SecureStore.getItemAsync(ROOT);
 const previous=previousRaw===null?null:parseManifest(previousRaw);
 const generation=previous?.generation==='a'?'b':'a';
 const parts:string[]=[];
 let chunk='',size=0;
 for(const character of notes){
  const point=character.codePointAt(0)!;
  const bytes=point<=0x7f?1:point<=0x7ff?2:point<=0xffff?3:4;
  if(size+bytes>CHUNK_BYTES){parts.push(chunk);chunk='';size=0;}
  chunk+=character;size+=bytes;
 }
 if(chunk)parts.push(chunk);
 for(let i=0;i<parts.length;i++)
  await SecureStore.setItemAsync(ROOT+'_'+generation+'_'+i,parts[i]);
 await SecureStore.setItemAsync(ROOT,JSON.stringify({generation,count:parts.length,length:notes.length}));
 // The committed generation is authoritative even if cleaning old ciphertext
 // fails. A later save overwrites that inactive generation; deletion sweeps both.
 if(previous)for(let i=0;i<previous.count;i++)
  await SecureStore.deleteItemAsync(ROOT+'_'+previous.generation+'_'+i).catch(()=>{});
}
export function loadMemoryNotes():Promise<string>{
 return exclusively(async()=>{
  const saved=await readEncrypted();
  if(saved!==null){await AsyncStorage.removeItem(LEGACY);return saved;}
  const legacy=await AsyncStorage.getItem(LEGACY);
  if(legacy===null)return '';
  await writeEncrypted(legacy);
  await AsyncStorage.removeItem(LEGACY);
  return legacy;
 });
}
export function saveMemoryNotes(notes:string):Promise<void>{
 return exclusively(async()=>{
  await writeEncrypted(notes);
  await AsyncStorage.removeItem(LEGACY);
 });
}
export function deleteMemoryNotes():Promise<void>{
 return exclusively(async()=>{
  // Sweep both generations so interrupted writes and corrupt manifests cannot
  // leave recoverable notes behind. No manifest parsing is needed to erase.
  await AsyncStorage.removeItem(LEGACY);
  await SecureStore.deleteItemAsync(ROOT);
  for(const generation of ['a','b'])for(let i=0;i<MAX_CHUNKS;i++)
   await SecureStore.deleteItemAsync(ROOT+'_'+generation+'_'+i);
 });
}

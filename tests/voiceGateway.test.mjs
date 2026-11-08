import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './loadTS.mjs';
const {validateRecordingConnection,transcribeRecording}=loadTS('src/voice.ts');
test('voice connections reject invalid destinations before microphone use',()=>{
 for(const endpoint of ['http://remote.example','https://u:p@example.com','https://example.com?secret=x'])
  assert.throws(()=>validateRecordingConnection({gateway:true,endpoint,token:'private'}));
 assert.throws(()=>validateRecordingConnection({gateway:true,endpoint:'https://example.com',token:''}));
 assert.throws(()=>validateRecordingConnection({gateway:false,endpoint:'https://example.com',token:'private'}));
});
test('gateway voice uses client token and returns a draft without a provider key',async t=>{
 const originalFetch=globalThis.fetch;
 t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://nia.example/v1/transcribe');
  assert.equal(options.headers.Authorization,'Bearer gateway-access');
  assert.equal(options.body.has('model'),false);
  return Response.json({text:'  review this message  '});
 };
 assert.equal(await transcribeRecording('file:///private/recording.m4a',{gateway:true,endpoint:'https://nia.example',token:'gateway-access'}),'review this message');
});
test('aborted transcription and empty transcripts cannot become a draft',async t=>{
 const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async()=>Response.json({text:''});
 const connection={gateway:true,endpoint:'https://nia.example',token:'key'};
 await assert.rejects(transcribeRecording('file:///audio',connection),/No usable speech/);
 globalThis.fetch=async(_url,options)=>{assert.equal(options.signal.aborted,true);throw new Error('cancelled');};
 const abort=new AbortController();abort.abort();
 await assert.rejects(transcribeRecording('file:///audio',connection,abort.signal));
});

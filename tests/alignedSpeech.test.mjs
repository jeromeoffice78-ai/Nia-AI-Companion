import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './loadTS.mjs';
const stub={'./network':{fetchWithTimeout:async()=>{throw Error('Network not configured')}},
 './niaGateway':{normalizeGatewayUrl:(base)=>{if(base!=='https://nia.example')throw Error('untrusted base');return base}}};
const {parseAlignedSpeech}=loadTS('src/alignedSpeech.ts',stub);
const valid=()=>({audioPath:'/v1/speech/audio/123456789abc',format:'audio/mpeg',
 visemes:[{startMs:0,endMs:150,viseme:'sil'},{startMs:150,endMs:350,viseme:'aa'}]});
test('timed speech must refer to authenticated audio on the same Nia gateway',()=>{
 const packet=parseAlignedSpeech('https://nia.example','token_abc',valid());
 assert.equal(packet.audioUri,'https://nia.example/v1/speech/audio/123456789abc');
 assert.deepEqual(packet.audioHeaders,{Authorization:'Bearer token_abc'});
 assert.equal(packet.cues.length,2);
});
test('reject external audio URLs, unsupported formats and unaligned viseme cues',()=>{
 for(const value of [
  {...valid(),audioPath:'https://attacker.example/steal'},
  {...valid(),audioPath:'/v1/speech/audio/../../../password'},
  {...valid(),format:'audio/wav'},
  {...valid(),visemes:[{startMs:200,endMs:250,viseme:'aa'},{startMs:100,endMs:350,viseme:'PP'}]},
  {...valid(),visemes:[]}
 ])assert.throws(()=>parseAlignedSpeech('https://nia.example','token_abc',value));
});

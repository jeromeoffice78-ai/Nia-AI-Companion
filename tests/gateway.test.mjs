import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './loadTS.mjs';
const {normalizeGatewayUrl,chatWithGateway}=loadTS('src/niaGateway.ts');
const {parseHistory}=loadTS('src/history.ts');
const {secureUrl,fetchWithTimeout}=loadTS('src/network.ts');
test('reject malformed URLs before disclosing credentials',()=>{
 for(const value of ['https://','https://user:password@host.test','http://remote.test','https://host.test#secret','https://host.test?token=secret','https://host.test/v1/chat'])assert.throws(()=>normalizeGatewayUrl(value));
 assert.equal(normalizeGatewayUrl(' https://host.test/ '),'https://host.test');
 assert.equal(secureUrl('http://127.0.0.1:8080/v1/chat'),'http://127.0.0.1:8080/v1/chat');
});
test('gateway sends bounded context and reads the API answer',async()=>{
 const original=global.fetch;
 try{
  global.fetch=async(url,options)=>{
   assert.equal(url,'https://nia.test/v1/chat');
   assert.equal(options.headers.Authorization,'Bearer local-test');
   const body=JSON.parse(options.body);assert.equal(body.messages.length,40);assert.equal(body.mode,'business');
   assert.equal(body.flirty,false);assert.ok(options.signal);
   return Response.json({answer:'Ready',model:'test-model'});
  };
  assert.deepEqual(await chatWithGateway({baseUrl:'https://nia.test',clientToken:'local-test'},Array(60).fill({role:'user',content:'Hello'}),'business',false),{answer:'Ready',model:'test-model'});
 }finally{global.fetch=original;}
});
test('auth rejection, empty replies, malformed JSON and oversized input fail visibly',async()=>{
 const original=global.fetch,settings={baseUrl:'https://nia.test',clientToken:'local-test'},history=[{role:'user',content:'Hello'}];
 try{
  for(const response of [new Response('{}',{status:401}),new Response('not JSON'),Response.json({answer:'',model:'x'})]){
   global.fetch=async()=>response;await assert.rejects(chatWithGateway(settings,history,'companion',true));
  }
  await assert.rejects(chatWithGateway(settings,[{role:'user',content:'x'.repeat(12001)}],'companion',true));
 }finally{global.fetch=original;}
});
test('network timeout releases stalled fetches',async()=>{
 const original=global.fetch;
 try{
  global.fetch=async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));
  await assert.rejects(fetchWithTimeout('https://nia.test',{},10),/timed out/);
 }finally{global.fetch=original;}
});
test('corrupt saved data cannot become renderable history',()=>{
 for(const value of ['null','{}','[null]','[{"role":"admin","content":"x"}]','[{"role":"user","content":3}]'])assert.throws(()=>parseHistory(value));
 assert.deepEqual(parseHistory('[{"role":"user","content":"Hello"}]'),[{role:'user',content:'Hello'}]);
});

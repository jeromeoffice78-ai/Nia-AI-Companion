import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {loadTS} from './loadTS.mjs';

const service=readFileSync('native-overlay/NiaOverlayService.java','utf8');
const module=readFileSync('native-overlay/NiaOverlayModule.java','utf8');
function javaMethod(signature){
 const start=service.indexOf(signature);
 assert.notEqual(start,-1,'Missing native method '+signature);
 const end=service.indexOf('\n }',start);
 assert.notEqual(end,-1);
 return service.slice(start,end+3).replace('private static String speechStateScript','public static String speechStateScript');
}

test('native scalar validator rejects nonfinite values and scripts serialize safe closed-mouth states',()=>{
 const directory=mkdtempSync(join(tmpdir(),'nia-speech-native-'));
 try{
  // Execute the native validator and payload builder themselves with a tiny
  // JSONObject stand-in. Android's real JSONObject/Service compile is a CI gate.
  const whitelist=service.match(/private static final Set<String> VISEMES=[^\n]+;/)?.[0];
  assert.ok(whitelist);
  const code=`import java.util.*;
public class OverlaySpeechHarness {
 ${whitelist}
 static class JSONException extends Exception {}
 static class JSONObject {
  final Map<String,Object> values=new LinkedHashMap<>();
  void put(String key,Object value){values.put(key,value);}
  public String toString(){
   StringJoiner out=new StringJoiner(",","{","}");
   for(Map.Entry<String,Object> entry:values.entrySet()){
    Object value=entry.getValue();
    out.add("\\\""+entry.getKey()+"\\\":"+(value instanceof String?"\\\""+value+"\\\"":value));
   }
   return out.toString();
  }
 }
 ${javaMethod('public static boolean validSpeechState')}
 ${javaMethod('private static String speechStateScript')}
 public static void main(String[] args)throws Exception {
  for(String viseme:VISEMES){
   if(!validSpeechState(viseme,0)||!validSpeechState(viseme,1))throw new AssertionError("valid bounds");
   System.out.println(speechStateScript(viseme,.75,true));
  }
  for(double opening:new double[]{Double.NaN,Double.POSITIVE_INFINITY,Double.NEGATIVE_INFINITY,-.01,1.01}){
   if(validSpeechState("aa",opening))throw new AssertionError("invalid opening accepted");
  }
  for(String viseme:new String[]{null,"AA","", "aa');window.stolen=true;//"}){
   if(validSpeechState(viseme,.5))throw new AssertionError("invalid viseme accepted");
   boolean rejected=false;
   try{speechStateScript(viseme,.5,true);}catch(IllegalArgumentException expected){rejected=true;}
   if(!rejected)throw new AssertionError("invalid payload built");
  }
  System.out.println(speechStateScript("aa",1,false));
 }
}`;
  const path=join(directory,'OverlaySpeechHarness.java');
  writeFileSync(path,code);
  const result=spawnSync('java',[path],{encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.stderr||String(result.error));
  const scripts=result.stdout.trim().split('\n');
  const {VISEMES}=loadTS('src/visemes.ts');
  assert.equal(scripts.length,VISEMES.length+1);
  const frames=[];
  for(const script of scripts){
   const sandbox={window:{niaOverlay:{setSpeechState:frame=>frames.push(frame)}}};
   runInNewContext(script,sandbox);
   // The fixed receiver may be absent while the renderer initializes.
   runInNewContext(script,{window:{}});
  }
  assert.deepEqual(frames.slice(0,-1).map(frame=>frame.viseme).sort(),[...VISEMES].sort());
  for(const frame of frames){
   assert.deepEqual(Object.keys(frame).sort(),['opening','speaking','viseme']);
   assert.ok(Number.isFinite(frame.opening)&&frame.opening>=0&&frame.opening<=1);
   if(frame.viseme==='sil'||!frame.speaking)assert.equal(frame.opening,0);
  }
  assert.equal(frames.at(-1).speaking,false);
  assert.equal(frames.at(-1).viseme,'sil');
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('speech delivery targets only an existing ready overlay on the main thread',()=>{
 const method=javaMethod('public static boolean setSpeechState');
 assert.match(method,/Looper\.myLooper\(\)!=Looper\.getMainLooper\(\)/);
 assert.match(method,/service==null\|\|service\.destroyed\|\|service\.web==null\|\|!"ready"\.equals\(status\)/);
 assert.match(method,/web\.evaluateJavascript\(speechStateScript\(viseme,opening,speaking\),null\)/);
 assert.doesNotMatch(method,/startService|startForegroundService|new Intent|new NiaOverlayService/);
 assert.match(module,/@ReactMethod public void setSpeechState\(String viseme,double opening,boolean speaking,Promise promise\)/);
 assert.match(module,/mainHandler\.post\(\(\)->\{\s*try\{promise\.resolve\(NiaOverlayService\.setSpeechState/);
 assert.match(service,/onDestroy\(\)\{\s*resetSpeechState\(\)/);
 assert.match(service,/if\(activeService==this\)activeService=null/);
 assert.match(module,/NiaOverlayService\.resetSpeechState\(\);context\.stopService/);
 assert.doesNotMatch(service,/addJavascriptInterface/);
});

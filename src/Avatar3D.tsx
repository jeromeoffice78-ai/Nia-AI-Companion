import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,StyleSheet,useWindowDimensions,AppState} from 'react-native';
import {GLView} from 'expo-gl';
import {mountNiaGLB} from './loadNiaGLB';
import {niaBundledModel} from './niaModel';
import * as DocumentPicker from 'expo-document-picker';
import {VisemeCue} from './visemes';
import {DEMO_MOUTH_CUES,DEMO_CYCLE_MS} from './mouthDemo';
import {chooseAutonomousMotion,type Motion} from './avatarMotion';
const EMPTY_CUES:VisemeCue[]=[];
type Controller={diagnostics:{rigged:boolean;skinnedMeshes:number;boneCount:number;bodyRefinement:boolean;continuousPieces:number;lookPreview:boolean;morphTargets:string[];animations:string[]};play:(name:Motion)=>boolean;setSpeaking:(value:boolean)=>void;setVisemes:(cues:VisemeCue[])=>void;setPlaybackPosition:(value:number|null)=>void;setActive:(value:boolean)=>void;dispose:()=>void};
export default function Avatar3D({speaking:externalSpeaking=false,visemes=EMPTY_CUES,playbackMs=null}:{speaking?:boolean;visemes?:VisemeCue[];playbackMs?:number|null}){
 const {height}=useWindowDimensions();
 const avatarHeight=Math.max(240,Math.round(height*0.5));
 const [autonomous,setAutonomous]=useState(true);
 const [motion,setMotion]=useState<Motion>('Idle');
 const [speaking,setSpeaking]=useState(false);
 const [error,setError]=useState('');
 const [modelUri,setModelUri]=useState<string|null>(null);
 const [loadedName,setLoadedName]=useState('Nia test rig — appearance not approved');
 const [diagnostics,setDiagnostics]=useState('Waiting for model');
 const [staticPreview,setStaticPreview]=useState(false);
 const controller=useRef<Controller|null>(null);
 const disposed=useRef(false);
 const latestCues=useRef(visemes);
 const latestPlayback=useRef(playbackMs);
 const latestSpeaking=useRef(externalSpeaking||speaking);
 const latestMotion=useRef<Motion>('Idle');
 latestCues.current=visemes;
 latestPlayback.current=playbackMs;
 latestSpeaking.current=externalSpeaking||speaking;
 const loadGeneration=useRef(0);
 useEffect(()=>{disposed.current=false;return()=>{disposed.current=true;loadGeneration.current++;controller.current?.dispose();controller.current=null}},[]);
 useEffect(()=>{const subscription=AppState.addEventListener('change',state=>controller.current?.setActive(state==='active'));return()=>subscription.remove();},[]);
 useEffect(()=>{if(!autonomous)return;const timer=setInterval(()=>{
  if(AppState.currentState!=='active')return;
  const next=chooseAutonomousMotion(latestSpeaking.current,latestMotion.current,Math.random());
  if(controller.current?.play(next)){latestMotion.current=next;setMotion(next);}
 },10000);return()=>clearInterval(timer);},[autonomous]);
 // Speech starts a full-body gesture as well as any facial cues. This is motion,
 // not a claim of phoneme sync: Expo Speech supplies no timed audio phonemes.
 useEffect(()=>{
  if(!autonomous||!(externalSpeaking||speaking)||AppState.currentState!=='active')return;
  const next=chooseAutonomousMotion(true,latestMotion.current,Math.random());
  if(controller.current?.play(next)){latestMotion.current=next;setMotion(next);}
 },[autonomous,externalSpeaking,speaking]);
 useEffect(()=>{controller.current?.setSpeaking(externalSpeaking||speaking);},[externalSpeaking,speaking]);
 useEffect(()=>{controller.current?.setVisemes(visemes);},[visemes]);
 useEffect(()=>{controller.current?.setPlaybackPosition(playbackMs);},[playbackMs]);
 // Visible silent demonstration of the GLB facial morph targets. This timeline
 // has no recorded audio or phoneme alignment: it must never be used for speech.
 useEffect(()=>{
  if(!speaking||externalSpeaking)return;
  const start=()=>{if(AppState.currentState==='active')controller.current?.setVisemes(DEMO_MOUTH_CUES);};
  start();
  const timer=setInterval(start,DEMO_CYCLE_MS);
  return()=>{clearInterval(timer);controller.current?.setVisemes([]);};
 },[speaking,externalSpeaking]);
 async function chooseRig(){
  try{
   const selected=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});
   if(selected.canceled)return;
   const file=selected.assets[0];
   if(!/\.glb$/i.test(file.name))throw new Error('Select a .glb 3D rig file');
   loadGeneration.current++;
   controller.current?.dispose();controller.current=null;
   setLoadedName(file.name);setModelUri(file.uri);setStaticPreview(false);setDiagnostics('Loading selected GLB…');setError('');
  }catch(e){setError(String(e));}
 }
 async function onContextCreate(gl:any){
  const generation=++loadGeneration.current;
  try{
   const mounted=await mountNiaGLB(gl,modelUri||niaBundledModel);
   if(disposed.current||generation!==loadGeneration.current){mounted.dispose();return;}
   controller.current?.dispose();controller.current=mounted;mounted.setActive(AppState.currentState==='active');
   const d=mounted.diagnostics;
   const requiredClips=['Idle','Walk','Dance','Wave'];
   const requiredFace=['viseme_AA','viseme_EE','viseme_OH','viseme_FV','viseme_MBP','viseme_L','blinkLeft','blinkRight'];
   const animated=d.rigged&&d.boneCount>=20&&d.skinnedMeshes>0&&
     requiredClips.every(name=>d.animations.includes(name))&&
     requiredFace.every(name=>d.morphTargets.includes(name));
   if(!animated&&!modelUri){
    mounted.dispose();controller.current=null;
    setError('Bundled model is not a valid animated Nia rig. Production release remains blocked.');
    return;
   }
   setStaticPreview(!animated);
   setDiagnostics((animated?'Rigged internal animation test':'Static appearance preview — animation unavailable')+
     ' | bones: '+d.boneCount+' | skinned meshes: '+d.skinnedMeshes+
     (d.bodyRefinement?' | continuous body pieces: '+d.continuousPieces:'')+
     (d.lookPreview?' | high-ponytail styling preview':'')+
     ' | facial targets: '+d.morphTargets.join(', ')+' | animations: '+d.animations.join(', '));
   if(animated){
     mounted.setPlaybackPosition(latestPlayback.current);
     mounted.play(latestMotion.current);
     mounted.setSpeaking(latestSpeaking.current);
   }
   if(speaking&&!externalSpeaking)mounted.setVisemes(DEMO_MOUTH_CUES);
   else if(latestCues.current.length)mounted.setVisemes(latestCues.current);
  }catch(e){if(!disposed.current&&generation===loadGeneration.current){const details=e instanceof Error?(e.stack||e.message):String(e);setError(details);setDiagnostics('Avatar initialization error');}}
 }
 function select(next:Motion){if(staticPreview){setError('This imported model is appearance-only. Use a skinned animated rig to test movement.');return;}setAutonomous(false);if(controller.current&&!controller.current.play(next)){setError('Animation '+next+' is not available in this model');return;}latestMotion.current=next;setError('');setMotion(next);}
 function toggleSpeaking(){setSpeaking(v=>{controller.current?.setSpeaking(!v);return !v;});}
 return <View style={s.wrap}>
  <GLView key={modelUri||'bundled'} style={[s.canvas,{height:avatarHeight}]} onContextCreate={onContextCreate}/>
  <Pressable onPress={chooseRig} style={s.btn}><Text style={s.txt}>Import 3D GLB — animated rig or static appearance</Text></Pressable>
  {modelUri?<Pressable onPress={()=>{loadGeneration.current++;controller.current?.dispose();controller.current=null;setModelUri(null);setStaticPreview(false);setLoadedName('Nia test rig — appearance not approved');setDiagnostics('Loading bundled model…');setError('');}} style={s.btn}><Text style={s.txt}>Restore bundled model</Text></Pressable>:null}
  <Text style={s.caption}>Model: {loadedName}</Text>
  <Pressable disabled={staticPreview} onPress={()=>setAutonomous(v=>!v)} style={[s.btn,staticPreview&&s.disabled]}><Text style={s.txt}>Automatic motion selection: {staticPreview?'Unavailable — static model':autonomous?'On':'Off'}</Text></Pressable>
  {!staticPreview&&!autonomous?<Text style={s.caption}>Manual {motion} animation continues. Choose Idle for a resting pose.</Text>:null}
  <Text selectable style={s.caption}>Diagnostics: {diagnostics}</Text>
  {error?<Text style={s.error}>Model loading failed: {error}</Text>:null}
  <View style={s.row}>{(['Idle','Walk','Dance','Wave'] as Motion[]).map(v=>
   <Pressable key={v} disabled={staticPreview} onPress={()=>select(v)} style={[s.btn,motion===v&&!staticPreview&&s.selected,staticPreview&&s.disabled]}>
    <Text style={s.txt}>{v}</Text>
   </Pressable>)}</View>
  <Pressable disabled={staticPreview} onPress={toggleSpeaking} style={[s.btn,s.speech,staticPreview&&s.disabled]}><Text style={s.txt}>{speaking?'Stop silent mouth demo':'Test facial animation (silent)'}</Text></Pressable>
  <Text style={s.caption}>{staticPreview?'This imported model is a static 3D appearance preview. Body animation and lip-sync are disabled.':'Current animated test rig is not an approved realistic likeness.'} Production release remains blocked until the realistic rig, timed speech and physical device acceptance are verified.</Text>
 </View>;
}
const s=StyleSheet.create({wrap:{marginVertical:10},canvas:{height:270,borderRadius:12},row:{flexDirection:'row',justifyContent:'center',gap:10,marginTop:8},btn:{padding:10,backgroundColor:'#503953',borderRadius:8},selected:{backgroundColor:'#97568d'},txt:{color:'#fff'},caption:{color:'#d8b7d3',fontSize:12,marginTop:7,textAlign:'center'},error:{color:'#ffb6b6',marginTop:8},speech:{alignSelf:'center',marginTop:8},disabled:{opacity:0.35}});


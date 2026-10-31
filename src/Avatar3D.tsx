import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,StyleSheet,useWindowDimensions} from 'react-native';
import {GLView} from 'expo-gl';
import {mountNiaGLB} from './loadNiaGLB';
import {niaBundledModel} from './niaModel';
import * as DocumentPicker from 'expo-document-picker';
import {VisemeCue} from './visemes';
type Motion='Idle'|'Walk'|'Dance'|'Wave';
type Controller={diagnostics:{rigged:boolean;skinnedMeshes:number;boneCount:number;morphTargets:string[];animations:string[]};play:(name:Motion)=>boolean;setSpeaking:(value:boolean)=>void;setVisemes:(cues:VisemeCue[])=>void;dispose:()=>void};
export default function Avatar3D({speaking:externalSpeaking=false,visemes=[]}:{speaking?:boolean;visemes?:VisemeCue[]}){
 const {height}=useWindowDimensions();
 const avatarHeight=Math.max(240,Math.round(height*0.5));
 const [motion,setMotion]=useState<Motion>('Idle');
 const [speaking,setSpeaking]=useState(false);
 const [error,setError]=useState('');
 const [modelUri,setModelUri]=useState<string|null>(null);
 const [loadedName,setLoadedName]=useState('Bundled prototype');
 const [diagnostics,setDiagnostics]=useState('Waiting for model');
 const controller=useRef<Controller|null>(null);
 const disposed=useRef(false);
 const latestCues=useRef(visemes);
 const latestSpeaking=useRef(externalSpeaking||speaking);
 latestCues.current=visemes;
 latestSpeaking.current=externalSpeaking||speaking;
 const loadGeneration=useRef(0);
 useEffect(()=>{disposed.current=false;return()=>{disposed.current=true;loadGeneration.current++;controller.current?.dispose();controller.current=null}},[]);
 useEffect(()=>{controller.current?.setSpeaking(externalSpeaking||speaking);},[externalSpeaking,speaking]);
 useEffect(()=>{if(visemes.length)controller.current?.setVisemes(visemes);},[visemes]);
 async function chooseRig(){
  try{
   const selected=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});
   if(selected.canceled)return;
   const file=selected.assets[0];
   if(!/\.glb$/i.test(file.name))throw new Error('Select a .glb 3D rig file');
   loadGeneration.current++;
   controller.current?.dispose();controller.current=null;
   setLoadedName(file.name);setModelUri(file.uri);setDiagnostics('Loading selected GLB…');setError('');
  }catch(e){setError(String(e));}
 }
 async function onContextCreate(gl:any){
  const generation=++loadGeneration.current;
  try{
   const mounted=await mountNiaGLB(gl,modelUri||niaBundledModel);
   if(disposed.current||generation!==loadGeneration.current){mounted.dispose();return;}
   controller.current=mounted;
   const d=mounted.diagnostics;
   setDiagnostics((d.rigged?'Rigged':'Prototype')+' | bones: '+d.boneCount+' | skinned meshes: '+d.skinnedMeshes+' | facial targets: '+d.morphTargets.join(', ')+' | animations: '+d.animations.join(', '));
   mounted.play(motion);
   mounted.setSpeaking(latestSpeaking.current);
   if(latestCues.current.length)mounted.setVisemes(latestCues.current);
  }catch(e){if(!disposed.current&&generation===loadGeneration.current)setError(String(e));}
 }
 function select(next:Motion){if(controller.current&&!controller.current.play(next)){setError('Animation '+next+' is not available in this model');return;}setError('');setMotion(next);}
 function toggleSpeaking(){setSpeaking(v=>{controller.current?.setSpeaking(!v);return !v;});}
 return <View style={s.wrap}>
  <GLView key={modelUri||'bundled'} style={[s.canvas,{height:avatarHeight}]} onContextCreate={onContextCreate}/>
  <Pressable onPress={chooseRig} style={s.btn}><Text style={s.txt}>Import Nia appearance rig (.glb)</Text></Pressable>
  {modelUri?<Pressable onPress={()=>{loadGeneration.current++;controller.current?.dispose();controller.current=null;setModelUri(null);setLoadedName('Bundled prototype');setDiagnostics('Loading bundled model…');setError('');}} style={s.btn}><Text style={s.txt}>Restore bundled model</Text></Pressable>:null}
  <Text style={s.caption}>Model: {loadedName}</Text>
  <Text selectable style={s.caption}>Diagnostics: {diagnostics}</Text>
  {error?<Text style={s.error}>Model loading failed: {error}</Text>:null}
  <View style={s.row}>{(['Idle','Walk','Dance','Wave'] as Motion[]).map(v=>
   <Pressable key={v} onPress={()=>select(v)} style={[s.btn,motion===v&&s.selected]}>
    <Text style={s.txt}>{v}</Text>
   </Pressable>)}</View>
  <Pressable onPress={toggleSpeaking} style={[s.btn,s.speech]}><Text style={s.txt}>{speaking?'Stop mouth demo':'Test speaking animation'}</Text></Pressable>
  <Text style={s.caption}>Import the Nia v2 GLB to use its skeletal clips and facial blendshapes. The bundled prototype remains the fallback. Mouth movement follows speech playback state, not individual audio phonemes.</Text>
 </View>;
}
const s=StyleSheet.create({wrap:{marginVertical:10},canvas:{height:270,borderRadius:12},row:{flexDirection:'row',justifyContent:'center',gap:10,marginTop:8},btn:{padding:10,backgroundColor:'#503953',borderRadius:8},selected:{backgroundColor:'#97568d'},txt:{color:'#fff'},caption:{color:'#d8b7d3',fontSize:12,marginTop:7,textAlign:'center'},error:{color:'#ffb6b6',marginTop:8},speech:{alignSelf:'center',marginTop:8}});

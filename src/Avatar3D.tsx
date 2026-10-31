import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {GLView} from 'expo-gl';
import {mountNiaGLB} from './loadNiaGLB';
import {niaBundledModel} from './niaModel';
type Motion='Idle'|'Dance'|'Wave';
type Controller={play:(name:Motion)=>boolean;setSpeaking:(value:boolean)=>void;dispose:()=>void};
export default function Avatar3D({speaking:externalSpeaking=false}:{speaking?:boolean}){
 const [motion,setMotion]=useState<Motion>('Idle');
 const [speaking,setSpeaking]=useState(false);
 const [error,setError]=useState('');
 const controller=useRef<Controller|null>(null);
 const disposed=useRef(false);
 useEffect(()=>{disposed.current=false;return()=>{disposed.current=true;controller.current?.dispose();controller.current=null}},[]);
 useEffect(()=>{controller.current?.setSpeaking(externalSpeaking||speaking);},[externalSpeaking,speaking]);
 async function onContextCreate(gl:any){
  try{
   const mounted=await mountNiaGLB(gl,niaBundledModel);
   if(disposed.current){mounted.dispose();return;}
   controller.current=mounted;
   mounted.play(motion);
   mounted.setSpeaking(externalSpeaking||speaking);
  }catch(e){setError(String(e));}
 }
 function select(next:Motion){setMotion(next);controller.current?.play(next);}
 function toggleSpeaking(){setSpeaking(v=>{controller.current?.setSpeaking(!v);return !v;});}
 return <View style={s.wrap}>
  <GLView style={s.canvas} onContextCreate={onContextCreate}/>
  {error?<Text style={s.error}>Model loading failed: {error}</Text>:null}
  <View style={s.row}>{(['Idle','Dance','Wave'] as Motion[]).map(v=>
   <Pressable key={v} onPress={()=>select(v)} style={[s.btn,motion===v&&s.selected]}>
    <Text style={s.txt}>{v}</Text>
   </Pressable>)}</View>
  <Pressable onPress={toggleSpeaking} style={[s.btn,s.speech]}><Text style={s.txt}>{speaking?'Stop mouth demo':'Test speaking animation'}</Text></Pressable>
  <Text style={s.caption}>Articulated avatar with shoulder and hip pivots, Idle, Dance, Wave, blinking and mouth motion. Mouth movement follows speech playback state, not individual audio phonemes.</Text>
 </View>;
}
const s=StyleSheet.create({wrap:{marginVertical:10},canvas:{height:270,borderRadius:12},row:{flexDirection:'row',justifyContent:'center',gap:10,marginTop:8},btn:{padding:10,backgroundColor:'#503953',borderRadius:8},selected:{backgroundColor:'#97568d'},txt:{color:'#fff'},caption:{color:'#d8b7d3',fontSize:12,marginTop:7,textAlign:'center'},error:{color:'#ffb6b6',marginTop:8},speech:{alignSelf:'center',marginTop:8}});

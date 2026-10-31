import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {GLView} from 'expo-gl';
import {mountNiaGLB} from './loadNiaGLB';
import {niaBundledModel} from './niaModel';
type Motion='Idle'|'Dance';
type Controller={play:(name:Motion)=>boolean;dispose:()=>void};
export default function Avatar3D(){
 const [motion,setMotion]=useState<Motion>('Idle');
 const [error,setError]=useState('');
 const controller=useRef<Controller|null>(null);
 const disposed=useRef(false);
 useEffect(()=>{disposed.current=false;return()=>{disposed.current=true;controller.current?.dispose();controller.current=null}},[]);
 async function onContextCreate(gl:any){
  try{
   const mounted=await mountNiaGLB(gl,niaBundledModel);
   if(disposed.current){mounted.dispose();return;}
   controller.current=mounted;
   mounted.play(motion);
  }catch(e){setError(String(e));}
 }
 function select(next:Motion){setMotion(next);controller.current?.play(next);}
 return <View style={s.wrap}>
  <GLView style={s.canvas} onContextCreate={onContextCreate}/>
  {error?<Text style={s.error}>Model loading failed: {error}</Text>:null}
  <View style={s.row}>{(['Idle','Dance'] as Motion[]).map(v=>
   <Pressable key={v} onPress={()=>select(v)} style={[s.btn,motion===v&&s.selected]}>
    <Text style={s.txt}>{v}</Text>
   </Pressable>)}</View>
  <Text style={s.caption}>Bundled stylized GLB with embedded motion clips. Not yet photorealistic or lip-synced.</Text>
 </View>;
}
const s=StyleSheet.create({wrap:{marginVertical:10},canvas:{height:270,borderRadius:12},row:{flexDirection:'row',justifyContent:'center',gap:10,marginTop:8},btn:{padding:10,backgroundColor:'#503953',borderRadius:8},selected:{backgroundColor:'#97568d'},txt:{color:'#fff'},caption:{color:'#d8b7d3',fontSize:12,marginTop:7,textAlign:'center'},error:{color:'#ffb6b6',marginTop:8}});

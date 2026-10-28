import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {GLView} from 'expo-gl';
import {Renderer} from 'expo-three';
import * as THREE from 'three';
type Motion='idle'|'dance'|'wave';
export default function Avatar3D(){
 const [motion,setMotion]=useState<Motion>('idle');
 const motionRef=useRef<Motion>('idle');
 const disposeRef=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>{disposeRef.current?.()},[]);
 const select=(next:Motion)=>{motionRef.current=next;setMotion(next);};
 function onContextCreate(gl:any){
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x241b31);
  const camera=new THREE.PerspectiveCamera(45,gl.drawingBufferWidth/gl.drawingBufferHeight,0.1,100);
  camera.position.set(0,1.5,5.5);
  const renderer=new Renderer({gl});
  renderer.setSize(gl.drawingBufferWidth,gl.drawingBufferHeight);
  scene.add(new THREE.HemisphereLight(0xffffff,0x554466,2.2));
  const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(3,6,4);scene.add(light);
  const root=new THREE.Group();scene.add(root);
  const skin=new THREE.MeshStandardMaterial({color:0x956449,roughness:0.9});
  const shirt=new THREE.MeshStandardMaterial({color:0x9d4e91,roughness:0.75});
  const hair=new THREE.MeshStandardMaterial({color:0x18121b,roughness:0.9});
  const white=new THREE.MeshStandardMaterial({color:0xffffff});
  const dark=new THREE.MeshStandardMaterial({color:0x20161c});
  function sphere(parent:THREE.Group,x:number,y:number,z:number,sx:number,sy:number,sz:number,mat:THREE.Material){
   const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),mat);
   mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
  }
  sphere(root,0,0.1,0,0.54,0.8,0.35,shirt);
  sphere(root,0,1.23,0,0.45,0.59,0.43,skin);
  sphere(root,0,1.65,-0.05,0.49,0.28,0.46,hair);
  sphere(root,-0.17,1.3,0.4,0.08,0.07,0.035,white);
  sphere(root,0.17,1.3,0.4,0.08,0.07,0.035,white);
  sphere(root,-0.17,1.3,0.43,0.034,0.038,0.018,dark);
  sphere(root,0.17,1.3,0.43,0.034,0.038,0.018,dark);
  sphere(root,0,1.02,0.42,0.15,0.035,0.03,dark);
  const left=new THREE.Group();left.position.set(-0.57,0.62,0);root.add(left);
  sphere(left,-0.1,-0.35,0,0.16,0.47,0.18,skin);
  const right=new THREE.Group();right.position.set(0.57,0.62,0);root.add(right);
  sphere(right,0.1,-0.35,0,0.16,0.47,0.18,skin);
  const clock=new THREE.Clock();let active=true;let frame=0;
  const animate=()=>{
   if(!active)return;
   frame=requestAnimationFrame(animate);
   const t=clock.getElapsedTime(),m=motionRef.current;
   root.position.y=Math.sin(t*2)*(m==='dance'?0.12:0.025);
   root.rotation.y=m==='dance'?Math.sin(t*2.4)*0.35:Math.sin(t*0.45)*0.12;
   root.rotation.z=m==='dance'?Math.sin(t*3)*0.14:0;
   left.rotation.z=m==='dance'?Math.sin(t*4)*0.75:0.08;
   right.rotation.z=m==='wave'?-1.9+Math.sin(t*7)*0.35:m==='dance'?-Math.sin(t*4)*0.75:-0.08;
   renderer.render(scene,camera);gl.endFrameEXP();
  };
  animate();
  disposeRef.current=()=>{active=false;cancelAnimationFrame(frame);scene.traverse(o=>{
   if(o instanceof THREE.Mesh){o.geometry.dispose();}
  });renderer.dispose();};
 }
 return <View style={s.wrap}><GLView style={s.canvas} onContextCreate={onContextCreate}/>
  <View style={s.row}>{(['idle','dance','wave'] as Motion[]).map(v=><Pressable key={v} onPress={()=>select(v)} style={[s.btn,motion===v&&s.selected]}><Text style={s.txt}>{v}</Text></Pressable>)}</View>
  <Text style={s.caption}>Animated 3D prototype. It does not yet reproduce the original photo's likeness or facial expressions.</Text>
 </View>;
}
const s=StyleSheet.create({wrap:{marginVertical:10},canvas:{height:270,borderRadius:12},row:{flexDirection:'row',justifyContent:'center',gap:10,marginTop:8},btn:{padding:10,backgroundColor:'#503953',borderRadius:8},selected:{backgroundColor:'#97568d'},txt:{color:'#fff',textTransform:'capitalize'},caption:{color:'#d8b7d3',fontSize:12,marginTop:7,textAlign:'center'}});

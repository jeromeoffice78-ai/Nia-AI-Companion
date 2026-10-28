import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,Pressable,ScrollView,StyleSheet} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
type Message={role:'user'|'assistant';text:string};
export default function Home(){
 const [messages,setMessages]=useState<Message[]>([]);
 const [draft,setDraft]=useState('');
 useEffect(()=>{AsyncStorage.getItem('nia_messages').then(v=>{if(v)setMessages(JSON.parse(v))}).catch(()=>{})},[]);
 const send=async()=>{
  const text=draft.trim();if(!text)return;
  const next=[...messages,{role:'user' as const,text}];
  setMessages(next);setDraft('');
  await AsyncStorage.setItem('nia_messages',JSON.stringify(next));
 };
 return <View style={s.screen}><Text style={s.title}>Nia</Text><Text style={s.note}>Companion prototype · AI model not connected · 3D avatar not installed</Text>
 <ScrollView style={s.history}>{messages.map((m,i)=><Text key={i} style={s.msg}>{m.role==='user'?'You':'Nia'}: {m.text}</Text>)}</ScrollView>
 <TextInput style={s.input} value={draft} onChangeText={setDraft} placeholder="Write a message" placeholderTextColor="#aaa"/>
 <Pressable style={s.button} onPress={send}><Text style={s.buttonText}>Save message</Text></Pressable>
 <Pressable style={s.button} onPress={()=>Speech.speak('Hello, I am Nia. My AI conversation service is not connected yet.')}><Text style={s.buttonText}>Test voice</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#201724',paddingTop:65,padding:20},title:{fontSize:32,color:'#fff',fontWeight:'bold'},note:{color:'#e7bed8',marginVertical:12},history:{flex:1},msg:{color:'#fff',padding:10},input:{borderColor:'#ad86a5',borderWidth:1,borderRadius:10,padding:12,color:'#fff'},button:{backgroundColor:'#704566',padding:13,borderRadius:10,marginTop:10},buttonText:{color:'#fff',textAlign:'center'}});
import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,Pressable,ScrollView,StyleSheet,Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';
import {enableCheckIns,disableCheckIns,checkInsEnabled} from '../src/checkIns';
type Message={role:'user'|'assistant';content:string};
const MEMORY_KEY='nia_messages_v2';
export default function Home(){
 const [messages,setMessages]=useState<Message[]>([]);
 const [draft,setDraft]=useState('');
 const [endpoint,setEndpoint]=useState('');
 const [token,setToken]=useState('');
 const [model,setModel]=useState('local-model');
 const [setup,setSetup]=useState(false);
 const [busy,setBusy]=useState(false);
 const [speak,setSpeak]=useState(true);
 const [checkins,setCheckins]=useState(false);
 useEffect(()=>{
  AsyncStorage.multiGet([MEMORY_KEY,'nia_endpoint','nia_model']).then(entries=>{
   const history=entries[0][1];if(history){try{setMessages(JSON.parse(history))}catch{}}
   setEndpoint(entries[1][1]||'');
   setModel(entries[2][1]||'local-model');
  }).catch(()=>{});
  checkInsEnabled().then(setCheckins).catch(()=>{});
  SecureStore.getItemAsync('nia_api_token').then(v=>setToken(v||'')).catch(()=>{});
 },[]);
 async function saveConfig(){
  const e=endpoint.trim();
  if(e&&!/^https:\/\//i.test(e)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(e)){
   Alert.alert('Secure connection required','Use HTTPS for remote servers.');return;
  }
  await AsyncStorage.multiSet([['nia_endpoint',e],['nia_model',model.trim()||'local-model']]);
  await SecureStore.setItemAsync('nia_api_token',token);
  setSetup(false);
 }
 async function send(){
  const content=draft.trim();if(!content||busy)return;
  const history:Message[]=[...messages,{role:'user',content}];
  setMessages(history);setDraft('');
  await AsyncStorage.setItem(MEMORY_KEY,JSON.stringify(history));
  if(!endpoint){Alert.alert('AI not connected','Configure an OpenAI-compatible chat endpoint in Settings. Your message has been saved.');return;}
  setBusy(true);
  try{
   const response=await fetch(endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    body:JSON.stringify({model:model.trim()||'local-model',messages:[{role:'system',content:'You are Nia, an AI companion. Be warm, playful, considerate, and clear that you are AI. Do not claim to be conscious or to have human feelings. Respect the user’s boundaries.'},...history],stream:false})
   });
   if(!response.ok)throw new Error('HTTP '+response.status);
   const data=await response.json();
   const answer=data?.choices?.[0]?.message?.content;
   if(typeof answer!=='string'||!answer.trim())throw new Error('Invalid AI response');
   const updated:Message[]=[...history,{role:'assistant',content:answer}];
   setMessages(updated);await AsyncStorage.setItem(MEMORY_KEY,JSON.stringify(updated));
   if(speak)Speech.speak(answer,{language:'en-US'});
  }catch(e){Alert.alert('AI connection failed',String(e));}
  finally{setBusy(false);}
 }
 async function toggleCheckins(){
  try {if(checkins){await disableCheckIns();setCheckins(false);}else{await enableCheckIns();setCheckins(true);}}
  catch(e){Alert.alert('Notifications unavailable',String(e));}
 }
 async function clearHistory(){await AsyncStorage.removeItem(MEMORY_KEY);setMessages([]);}
 return <View style={s.screen}>
  <Text style={s.title}>Nia</Text>
  <Text style={s.note}>AI companion · {endpoint?'AI endpoint configured':'AI connection required'} · 3D avatar not yet installed</Text>
  <Pressable onPress={()=>setSetup(!setup)} style={s.secondary}><Text style={s.white}>{setup?'Close settings':'AI connection settings'}</Text></Pressable>
  {setup?<View>
    <TextInput value={endpoint} onChangeText={setEndpoint} style={s.input} autoCapitalize="none" placeholder="https://server/v1/chat/completions" placeholderTextColor="#bbb"/>
    <TextInput value={model} onChangeText={setModel} style={s.input} autoCapitalize="none" placeholder="Model name" placeholderTextColor="#bbb"/>
    <TextInput value={token} onChangeText={setToken} style={s.input} secureTextEntry placeholder="Optional API token" placeholderTextColor="#bbb"/>
    <Pressable onPress={saveConfig} style={s.button}><Text style={s.white}>Save settings</Text></Pressable>
    <Pressable onPress={()=>setSpeak(!speak)} style={s.secondary}><Text style={s.white}>Spoken replies: {speak?'On':'Off'}</Text></Pressable>
    <Pressable onPress={toggleCheckins} style={s.secondary}><Text style={s.white}>Daytime check-ins: {checkins?'On':'Off'}</Text></Pressable>
    <Pressable onPress={clearHistory} style={s.secondary}><Text style={s.white}>Delete conversation history</Text></Pressable>
   </View>:null}
  <ScrollView style={s.history}>{messages.map((m,i)=><Text key={i} style={s.msg}>{m.role==='user'?'You':'Nia'}: {m.content}</Text>)}</ScrollView>
  <TextInput style={s.input} value={draft} onChangeText={setDraft} placeholder="Message Nia" placeholderTextColor="#bbb" multiline/>
  <Pressable disabled={busy} style={s.button} onPress={send}><Text style={s.white}>{busy?'Thinking…':'Send'}</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#201724',paddingTop:65,padding:20},title:{fontSize:32,color:'#fff',fontWeight:'bold'},note:{color:'#e7bed8',marginVertical:12},history:{flex:1},msg:{color:'#fff',padding:10},input:{borderColor:'#ad86a5',borderWidth:1,borderRadius:10,padding:12,color:'#fff',marginTop:8},button:{backgroundColor:'#704566',padding:13,borderRadius:10,marginTop:10},secondary:{borderColor:'#704566',borderWidth:1,padding:10,borderRadius:10,marginTop:8},white:{color:'#fff',textAlign:'center'}});

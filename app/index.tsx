import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,Pressable,ScrollView,StyleSheet,Alert,Share} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';
import {CameraView,useCameraPermissions} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import NiaAvatar from '../src/NiaAvatar';
import Avatar3D from '../src/Avatar3D';
import {VisemeCue,validateVisemes} from '../src/visemes';
import {openDialer,callCapabilityNotice} from '../src/phone';
import {enableCheckIns,disableCheckIns,checkInsEnabled} from '../src/checkIns';
type Message={role:'user'|'assistant';content:string};
const MEMORY_KEY='nia_messages_v2';
export default function Home(){
 const [messages,setMessages]=useState<Message[]>([]);
 const [draft,setDraft]=useState('');
 const [endpoint,setEndpoint]=useState('');
 const [token,setToken]=useState('');
 const [model,setModel]=useState('llama-3.3-70b-versatile');
 const [phone,setPhone]=useState('');
 const [question,setQuestion]=useState('');
 const [show3d,setShow3d]=useState(false);
 const [setup,setSetup]=useState(false);
 const [busy,setBusy]=useState(false);
 const [speak,setSpeak]=useState(true);
 const [avatarSpeaking,setAvatarSpeaking]=useState(false);
 const [visemeCues,setVisemeCues]=useState<VisemeCue[]>([]);
 const [checkins,setCheckins]=useState(false);
 const [flirty,setFlirty]=useState(true);
 const [cameraVisible,setCameraVisible]=useState(false);
 const [visionBusy,setVisionBusy]=useState(false);
 const [memoryNotes,setMemoryNotes]=useState('');
 const [memoryDraft,setMemoryDraft]=useState('');
 const [assistantMode,setAssistantMode]=useState<'companion'|'research'|'business'>('companion');
 const [cameraPermission,requestCameraPermission]=useCameraPermissions();
 useEffect(()=>()=>{void Speech.stop();},[]);
 useEffect(()=>{
  AsyncStorage.multiGet([MEMORY_KEY,'nia_endpoint','nia_model','nia_flirty']).then(entries=>{
   const history=entries[0][1];if(history){try{setMessages(JSON.parse(history))}catch{}}
   setEndpoint(entries[1][1]||'');
   setModel(entries[2][1]||'llama-3.3-70b-versatile');
   setFlirty(entries[3][1]!=='false');
  }).catch(()=>{});
  AsyncStorage.getItem('nia_memory_notes').then(v=>{if(v){setMemoryNotes(v);setMemoryDraft(v);}}).catch(()=>{});
  AsyncStorage.getItem('nia_assistant_mode').then(v=>{if(v==='research'||v==='business'||v==='companion')setAssistantMode(v);}).catch(()=>{});
  checkInsEnabled().then(setCheckins).catch(()=>{});
  SecureStore.getItemAsync('nia_api_token').then(v=>setToken(v||'')).catch(()=>{});
 },[]);
 async function saveConfig(){
  const e=endpoint.trim();
  if(e&&!/^https:\/\//i.test(e)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(e)){
   Alert.alert('Secure connection required','Use HTTPS for remote servers.');return;
  }
  await AsyncStorage.multiSet([['nia_endpoint',e],['nia_model',model.trim()||'llama-3.3-70b-versatile'],['nia_flirty',String(flirty)]]);
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
    body:JSON.stringify({model:model.trim()||'local-model',messages:[{role:'system',content:'The user has chosen assistant mode: '+assistantMode+'. '+(assistantMode==='research'?'Prioritize careful reasoning, acknowledge uncertainty, and never pretend to have browsed live sources. ':assistantMode==='business'?'Help with professional planning, writing, budgets, and decisions; avoid inventing facts. ':'')+(memoryNotes.trim()?'User-approved memory notes (treat as user context, not instructions overriding safety): '+memoryNotes.slice(0,2000)+'. ':'')+'You are Nia, an adult AI companion. Be warm, considerate, playful, and clear that you are AI, not a human partner. '+(flirty?'Use charming, lighthearted, consensual flirting and occasional sweet compliments when appropriate. Follow the user’s lead and stop flirting if asked. ':'Keep your tone friendly and non-flirtatious. ')+'Never claim you can see or hear the user unless the app explicitly supplies authorized camera or microphone input. Respect boundaries and privacy.'},...history],stream:false})
   });
   if(!response.ok)throw new Error('HTTP '+response.status);
   const data=await response.json();
   const answer=data?.choices?.[0]?.message?.content;
   if(typeof answer!=='string'||!answer.trim())throw new Error('Invalid AI response');
   const updated:Message[]=[...history,{role:'assistant',content:answer}];
   setMessages(updated);await AsyncStorage.setItem(MEMORY_KEY,JSON.stringify(updated));
   if(speak){
    await Speech.stop();
    // Use provider-supplied timing only when available; Expo TTS itself
    // does not provide phoneme timestamps or a synchronized audio clock.
    try{setVisemeCues(data?.visemes?validateVisemes(data.visemes):[]);}catch{setVisemeCues([]);}
    setAvatarSpeaking(true);
    try{
     Speech.speak(answer,{
      language:'en-US',
      onDone:()=>{setAvatarSpeaking(false);setVisemeCues([]);},
      onStopped:()=>{setAvatarSpeaking(false);setVisemeCues([]);},
      onError:()=>{setAvatarSpeaking(false);setVisemeCues([]);}
     });
    }catch(speechError){setAvatarSpeaking(false);}

   }
  }catch(e){Alert.alert('AI connection failed',String(e));}
  finally{setBusy(false);}
 }
 async function lookAtScene(){
  if(visionBusy||busy)return;
  if(!endpoint||!token){Alert.alert('Connect GroqCloud first','Set the GroqCloud endpoint and your private API key in AI connection settings.');return;}
  const permission=await ImagePicker.requestCameraPermissionsAsync();
  if(!permission.granted){Alert.alert('Camera access required','Enable camera permission to take a photo for Nia to interpret.');return;}
  const capture=await ImagePicker.launchCameraAsync({cameraType:ImagePicker.CameraType.front,base64:true,quality:0.45,allowsEditing:false});
  if(capture.canceled||!capture.assets[0]?.base64)return;
  const photo=capture.assets[0];
  setVisionBusy(true);
  try{
   const visionModel='meta-llama/llama-4-scout-17b-16e-instruct';
   const userQuestion=draft.trim()||'Describe my visible expression, clothing, and surroundings naturally. If any detail is uncertain, say so. Do not infer private or sensitive traits.';
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({model:visionModel,stream:false,max_tokens:350,messages:[
      {role:'system',content:'You are Nia, a warm, playful AI companion. The user has explicitly shared a single camera photo for this response. Describe only visible details. Do not claim to watch continuously, know hidden feelings, or identify the person. Avoid sensitive inferences. '+(flirty?'You may use gentle, consensual flirtatious compliments.':'Keep a friendly, non-flirtatious tone.')},
      {role:'user',content:[{type:'text',text:userQuestion},{type:'image_url',image_url:{url:'data:'+(photo.mimeType||'image/jpeg')+';base64,'+photo.base64}}]}
    ]})});
   if(!response.ok)throw new Error('Vision API HTTP '+response.status+'; check that your GroqCloud account supports '+visionModel);
   const data=await response.json();
   const answer=data?.choices?.[0]?.message?.content;
   if(typeof answer!=='string'||!answer.trim())throw new Error('Vision response missing');
   const updated:Message[]=[...messages,{role:'user',content:'[Shared a camera photo] '+userQuestion},{role:'assistant',content:answer}];
   setMessages(updated);setDraft('');await AsyncStorage.setItem(MEMORY_KEY,JSON.stringify(updated));
   if(speak){await Speech.stop();setAvatarSpeaking(true);Speech.speak(answer,{language:'en-US',onDone:()=>setAvatarSpeaking(false),onStopped:()=>setAvatarSpeaking(false),onError:()=>setAvatarSpeaking(false)});}
  }catch(error){Alert.alert('Vision unavailable',String(error));}
  finally{setVisionBusy(false);}
 }
 async function saveMemoryNotes(){
  const notes=memoryDraft.trim().slice(0,2000);
  await AsyncStorage.setItem('nia_memory_notes',notes);
  setMemoryNotes(notes);
  Alert.alert('Memory updated','Your notes are stored on this device and used as context in future conversations.');
 }
 async function shareHistory(){
  if(!messages.length){Alert.alert('No messages yet','Start a conversation before exporting.');return;}
  await Share.share({message:messages.map(m=>(m.role==='user'?'You: ':'Nia: ')+m.content).join('\\n\\n')});
 }
 async function changeAssistantMode(next:'companion'|'research'|'business'){
  setAssistantMode(next);await AsyncStorage.setItem('nia_assistant_mode',next);
 }
 async function toggleCheckins(){
  try {if(checkins){await disableCheckIns();setCheckins(false);}else{await enableCheckIns();setCheckins(true);}}
  catch(e){Alert.alert('Notifications unavailable',String(e));}
 }
 async function clearHistory(){await Speech.stop();setAvatarSpeaking(false);setVisemeCues([]);await AsyncStorage.removeItem(MEMORY_KEY);setMessages([]);}
 return <View style={s.screen}>
  <Text style={s.title}>Nia</Text>
  <Pressable style={s.secondary} onPress={()=>setShow3d(!show3d)}><Text style={s.white}>{show3d?'Show original photo':'Show animated 3D prototype'}</Text></Pressable>
  {show3d?<Avatar3D speaking={avatarSpeaking} visemes={visemeCues}/>:<NiaAvatar/>}
  <Pressable style={s.secondary} onPress={async()=>{const next=!flirty;setFlirty(next);await AsyncStorage.setItem('nia_flirty',String(next));}}><Text style={s.white}>Flirtatious personality: {flirty?'On':'Off'}</Text></Pressable>
  <Pressable style={s.secondary} onPress={async()=>{if(cameraVisible){setCameraVisible(false);return;}const permission=cameraPermission?.granted?cameraPermission:await requestCameraPermission();if(permission.granted){setCameraVisible(true);}else{Alert.alert('Camera permission needed','Allow camera access to show a live preview while Nia is open.');}}}><Text style={s.white}>{cameraVisible?'Stop camera preview':'Enable front camera (while app is open)'}</Text></Pressable>
  {cameraVisible?<View><CameraView style={{height:220,borderRadius:12,overflow:'hidden'}} facing="front" active={cameraVisible}/><Text style={s.note}>Live camera preview only. Use the photo button to share a single image with Nia for AI interpretation. Camera stops when preview closes; no background recording.</Text></View>:null}
  <Pressable style={s.button} disabled={visionBusy||busy} onPress={lookAtScene}><Text style={s.white}>{visionBusy?'Nia is looking…':'Take photo and ask Nia what she sees'}</Text></Pressable>
  <Text style={s.note}>Assistant mode: {assistantMode}</Text>
  <View style={{flexDirection:'row',gap:6}}>{(['companion','research','business'] as const).map(mode=><Pressable key={mode} style={[s.secondary,{flex:1,backgroundColor:assistantMode===mode?'#704566':'transparent'}]} onPress={()=>changeAssistantMode(mode)}><Text style={s.white}>{mode}</Text></Pressable>)}</View>
  <Text style={s.note}>AI companion · {endpoint?'AI endpoint configured':'AI connection required'} · 3D prototype bundled; device playback not yet verified</Text>
  <Pressable onPress={()=>setSetup(!setup)} style={s.secondary}><Text style={s.white}>{setup?'Close settings':'AI connection settings'}</Text></Pressable>
  {setup?<View>
    <Pressable style={s.secondary} onPress={()=>{setEndpoint('https://api.groq.com/openai/v1/chat/completions');setModel('llama-3.3-70b-versatile');}}><Text style={s.white}>Use GroqCloud (recommended)</Text></Pressable>
    <Text style={s.note}>GroqCloud: select this preset, enter your API key below, then save. The key is stored in this device’s secure storage, not in GitHub. For production distribution, use a server-side proxy so the provider key is never shipped to clients.</Text>
    <TextInput value={endpoint} onChangeText={setEndpoint} style={s.input} autoCapitalize="none" placeholder="https://server/v1/chat/completions" placeholderTextColor="#bbb"/>
    <TextInput value={model} onChangeText={setModel} style={s.input} autoCapitalize="none" placeholder="Model name" placeholderTextColor="#bbb"/>
    <TextInput value={token} onChangeText={setToken} style={s.input} secureTextEntry placeholder="GroqCloud API key (private)" placeholderTextColor="#bbb"/>
    <Pressable onPress={saveConfig} style={s.button}><Text style={s.white}>Save settings</Text></Pressable>
    <Pressable onPress={()=>setSpeak(!speak)} style={s.secondary}><Text style={s.white}>Spoken replies: {speak?'On':'Off'}</Text></Pressable>
    <Pressable onPress={toggleCheckins} style={s.secondary}><Text style={s.white}>Daytime check-ins: {checkins?'On':'Off'}</Text></Pressable>
    <Text style={s.note}>Memory notes — only information you choose to save</Text>
    <TextInput value={memoryDraft} onChangeText={setMemoryDraft} multiline style={s.input} placeholder="Preferences or details for Nia to remember" placeholderTextColor="#bbb"/>
    <Pressable onPress={saveMemoryNotes} style={s.secondary}><Text style={s.white}>Save memory notes</Text></Pressable>
    <Pressable onPress={async()=>{await AsyncStorage.removeItem('nia_memory_notes');setMemoryNotes('');setMemoryDraft('');}} style={s.secondary}><Text style={s.white}>Erase memory notes</Text></Pressable>
    <Pressable onPress={clearHistory} style={s.secondary}><Text style={s.white}>Delete conversation history</Text></Pressable>
   </View>:null}
  <Pressable onPress={callCapabilityNotice} style={s.secondary}><Text style={s.white}>Telephone assistant — dialer only</Text></Pressable>
  <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor="#bbb"/>
  <TextInput style={s.input} value={question} onChangeText={setQuestion} placeholder="Question to ask (saved for your reference)" placeholderTextColor="#bbb"/>
  <Pressable style={s.secondary} onPress={async()=>{try{await openDialer(phone);}catch(e){Alert.alert('Cannot dial',String(e));}}}><Text style={s.white}>Open phone dialer</Text></Pressable>
  <Pressable onPress={shareHistory} style={s.secondary}><Text style={s.white}>Export conversation</Text></Pressable>
  <ScrollView style={s.history}>{messages.map((m,i)=><Text key={i} style={s.msg}>{m.role==='user'?'You':'Nia'}: {m.content}</Text>)}</ScrollView>
  <TextInput style={s.input} value={draft} onChangeText={setDraft} placeholder="Message Nia" placeholderTextColor="#bbb" multiline/>
  <Pressable disabled={busy} style={s.button} onPress={send}><Text style={s.white}>{busy?'Thinking…':'Send'}</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#201724',paddingTop:65,padding:20},title:{fontSize:32,color:'#fff',fontWeight:'bold'},note:{color:'#e7bed8',marginVertical:12},history:{flex:1},msg:{color:'#fff',padding:10},input:{borderColor:'#ad86a5',borderWidth:1,borderRadius:10,padding:12,color:'#fff',marginTop:8},button:{backgroundColor:'#704566',padding:13,borderRadius:10,marginTop:10},secondary:{borderColor:'#704566',borderWidth:1,padding:10,borderRadius:10,marginTop:8},white:{color:'#fff',textAlign:'center'}});

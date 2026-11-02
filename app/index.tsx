import React,{useEffect,useState,useRef} from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';
import {View,Text,TextInput,Pressable,ScrollView,StyleSheet,Alert,Share,AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';
import {useAudioRecorder,RecordingPresets,requestRecordingPermissionsAsync,setAudioModeAsync,createAudioPlayer} from 'expo-audio';
import {requestAlignedSpeech,AlignedSpeechUnavailable} from '../src/alignedSpeech';
import {transcribeAudio} from '../src/voice';
import {CameraView,useCameraPermissions} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Avatar3D from '../src/Avatar3D';
import {VisemeCue} from '../src/visemes';
import {secureUrl,fetchWithTimeout} from '../src/network';
import {loadConversation,saveConversation,deleteConversation} from '../src/secureHistory';
import {openDialer,callCapabilityNotice} from '../src/phone';
import {enableCheckIns,disableCheckIns,checkInsEnabled} from '../src/checkIns';
import {chatWithGateway,checkGateway,normalizeGatewayUrl} from '../src/niaGateway';

type Message={role:'user'|'assistant';content:string};
export default function Home(){
 const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
 const recordingRef=useRef(false);
 const [recording,setRecording]=useState(false);
 const [voiceBusy,setVoiceBusy]=useState(false);
 const [messages,setMessages]=useState<Message[]>([]);
 const [draft,setDraft]=useState('');
 const [endpoint,setEndpoint]=useState('');
 const [gatewayUrl,setGatewayUrl]=useState('');
 const [gatewayToken,setGatewayToken]=useState('');
 const [useGateway,setUseGateway]=useState(false);
 const [token,setToken]=useState('');
 const [model,setModel]=useState('llama-3.3-70b-versatile');
 const [phone,setPhone]=useState('');
 const [question,setQuestion]=useState('');
 const [setup,setSetup]=useState(false);
 const [busy,setBusy]=useState(false);
 const [speak,setSpeak]=useState(true);
 const [avatarSpeaking,setAvatarSpeaking]=useState(false);
 const [visemeCues,setVisemeCues]=useState<VisemeCue[]>([]);
 const [audioPositionMs,setAudioPositionMs]=useState<number|null>(null);
 const [checkins,setCheckins]=useState(false);
 const [flirty,setFlirty]=useState(true);
 const [cameraVisible,setCameraVisible]=useState(false);
 const [visionBusy,setVisionBusy]=useState(false);
 const [memoryNotes,setMemoryNotes]=useState('');
 const [memoryDraft,setMemoryDraft]=useState('');
 const [assistantMode,setAssistantMode]=useState<'companion'|'research'|'business'>('companion');
 const [cameraPermission,requestCameraPermission]=useCameraPermissions();
 const cameraRef=useRef<CameraView>(null);
 const operation=useRef(false);
 const historyVersion=useRef(0);
 const speechVersion=useRef(0);
 const alignedPlayer=useRef<{stop:()=>void}|null>(null);
 const [loaded,setLoaded]=useState(false);
 useEffect(()=>()=>{alignedPlayer.current?.stop();alignedPlayer.current=null;void Speech.stop();},[]);
 useEffect(()=>{
  const subscription=AppState.addEventListener('change',state=>{
   if(state!=='active'){
    speechVersion.current++;setCameraVisible(false);
    if(recordingRef.current){recordingRef.current=false;setRecording(false);void recorder.stop().then(()=>setAudioModeAsync({allowsRecording:false})).catch(()=>{});operation.current=false;}
    alignedPlayer.current?.stop();alignedPlayer.current=null;
    void Speech.stop();
    setAvatarSpeaking(false);setAudioPositionMs(null);
    setVisemeCues([]);
   }
  });
  return()=>subscription.remove();
 },[recorder]);
 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const [entries,apiToken,accessToken,enabled]=await Promise.all([
     AsyncStorage.multiGet(['nia_endpoint','nia_model','nia_flirty','nia_memory_notes','nia_assistant_mode','nia_gateway_url','nia_gateway_enabled']),
     SecureStore.getItemAsync('nia_api_token'),SecureStore.getItemAsync('nia_gateway_token'),checkInsEnabled()
    ]);
    if(!active)return;
    const values=Object.fromEntries(entries);
    setMessages(await loadConversation());
    setEndpoint(values.nia_endpoint||'');setModel(values.nia_model||'llama-3.3-70b-versatile');
    setFlirty(values.nia_flirty!=='false');
    const notes=values.nia_memory_notes||'';setMemoryNotes(notes);setMemoryDraft(notes);
    const mode=values.nia_assistant_mode;
    if(mode==='research'||mode==='business'||mode==='companion')setAssistantMode(mode);
    setGatewayUrl(values.nia_gateway_url||'');setUseGateway(values.nia_gateway_enabled==='true');
    setToken(apiToken||'');setGatewayToken(accessToken||'');setCheckins(enabled);setLoaded(true);
   }catch{Alert.alert('Saved data unavailable','Nia could not load your saved data. Restart after checking device storage. Existing data has not been overwritten.');}
  })();
  return()=>{active=false;historyVersion.current++;speechVersion.current++;};
 },[]);
 async function saveConfig(){
  try{
  const e=endpoint.trim();
  try{if(e)secureUrl(e);}catch(error){Alert.alert('Secure connection required',String(error));return;}
  await AsyncStorage.multiSet([['nia_endpoint',e],['nia_model',model.trim()||'llama-3.3-70b-versatile'],['nia_flirty',String(flirty)]]);
  await SecureStore.setItemAsync('nia_api_token',token);
  setSetup(false);
  }catch(error){Alert.alert('Settings not saved',String(error));}
 }
 async function say(answer:string){
  const version=++speechVersion.current;
  alignedPlayer.current?.stop();alignedPlayer.current=null;
  await Speech.stop();
  if(version!==speechVersion.current||AppState.currentState!=='active')return;
  setVisemeCues([]);setAudioPositionMs(null);setAvatarSpeaking(false);
  const done=()=>{
   if(version!==speechVersion.current)return;
   alignedPlayer.current?.stop();alignedPlayer.current=null;
   setAvatarSpeaking(false);setAudioPositionMs(null);setVisemeCues([]);
  };
  if(useGateway&&gatewayToken.trim()){
   try{
    // Audio and phoneme positions must come from the SAME synthesis.
    // Never use text-derived viseme timing for a separate Android TTS voice.
    const aligned=await requestAlignedSpeech(gatewayUrl,gatewayToken,answer);
    if(version!==speechVersion.current||AppState.currentState!=='active')return;
    const player=createAudioPlayer({uri:aligned.audioUri,headers:aligned.audioHeaders},{updateInterval:50});
    let closed=false;
    const subscription=player.addListener('playbackStatusUpdate',status=>{
     if(closed||version!==speechVersion.current)return;
     if(status.error||status.didJustFinish){done();return;}
     if(status.playing&&status.isLoaded&&Number.isFinite(status.currentTime))
      setAudioPositionMs(Math.max(0,Math.round(status.currentTime*1000)));
    });
    alignedPlayer.current={stop:()=>{
     if(closed)return;closed=true;subscription.remove();player.pause();player.remove();
    }};
    setAudioPositionMs(0);setVisemeCues(aligned.cues);setAvatarSpeaking(true);
    player.play();return;
   }catch(error){
    if(version!==speechVersion.current)return;
    alignedPlayer.current?.stop();alignedPlayer.current=null;
    if(!(error instanceof AlignedSpeechUnavailable&&error.unavailable))
     Alert.alert('Aligned voice unavailable','Using Android speech without synchronized lip movements. '+String(error));
   }
  }
  // Expo Speech does not expose real audio phoneme offsets: unaligned fallback.
  if(version!==speechVersion.current||AppState.currentState!=='active')return;
  setVisemeCues([]);setAudioPositionMs(null);setAvatarSpeaking(true);
  try{Speech.speak(answer,{language:'en-US',onDone:done,onStopped:done,onError:done});}catch{done();}
 }
 async function send(){
  const content=draft.trim();if(!content||operation.current||!loaded)return;
  if(content.length>12000){Alert.alert('Message too long','Use up to 12,000 characters per message.');return;}
  operation.current=true;setBusy(true);
  const version=historyVersion.current;
  const history:Message[]=[...messages,{role:'user',content}].slice(-200) as Message[];
  try{
   // A failed disk write must not leave the app locked or drop the draft.
   await saveConversation(history);
   setMessages(history);setDraft('');
   if(!useGateway&&!endpoint){Alert.alert('AI not connected','Configure an AI connection in Settings. Your message has been saved.');return;}
   let answer:string;
   if(useGateway){
    const result=await chatWithGateway({baseUrl:gatewayUrl,clientToken:gatewayToken},[...(memoryNotes.trim()?[{role:'user' as const,content:'User-approved memory notes: '+memoryNotes.slice(0,2000)}]:[]),...history.slice(-39).map(m=>({...m,content:m.content.slice(0,12000)}))],assistantMode,flirty);
    answer=result.answer;
   }else{
    const url=secureUrl(endpoint);
    const response=await fetchWithTimeout(url,{
     method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
     body:JSON.stringify({model:model.trim()||'local-model',messages:[{role:'system',content:
      'You are Nia, an adult AI companion. Be warm and truthful about being AI. Respect boundaries and real-world relationships. '+
      'Assistant mode: '+assistantMode+'. '+(flirty?'Light consensual flirting is welcome; stop if asked. ':'Keep a non-flirtatious tone. ')+
      (memoryNotes.trim()?'User-approved context: '+memoryNotes.slice(0,2000):'')},...history.slice(-40)],stream:false})
    });
    if(!response.ok)throw new Error('AI server returned HTTP '+response.status);
    const data=await response.json();answer=data?.choices?.[0]?.message?.content;
    if(typeof answer!=='string'||!answer.trim()||answer.length>16000)throw new Error('Invalid AI response');
   }
   if(version!==historyVersion.current)return;
   const updated:Message[]=[...history,{role:'assistant',content:answer}];
   await saveConversation(updated);setMessages(updated);
   // Timings for another audio recording cannot synchronize Expo Speech.
   if(speak)await say(answer);
  }catch(e){Alert.alert('Conversation unavailable',String(e));}
  finally{operation.current=false;setBusy(false);}
 }
 async function toggleVoice(){
  if(voiceBusy||!loaded)return;
  if(!recordingRef.current&&operation.current)return;
  if(useGateway&&!recordingRef.current){Alert.alert('Voice connection','Voice transcription currently requires the direct Groq-compatible connection. Gateway voice is not implemented.');return;}
  operation.current=true;setVoiceBusy(true);
  try{
   if(recordingRef.current){
    recordingRef.current=false;setRecording(false);await recorder.stop();
    await setAudioModeAsync({allowsRecording:false});
    if(!recorder.uri)throw new Error('No recording was saved.');
    const transcript=await transcribeAudio(recorder.uri,endpoint,token);setDraft(transcript);
   }else{
    secureUrl(endpoint);
    if(!token.trim())throw new Error('Save your AI connection token first.');
    const permission=await requestRecordingPermissionsAsync();
    if(!permission.granted)throw new Error('Microphone permission was not granted.');
    speechVersion.current++;alignedPlayer.current?.stop();alignedPlayer.current=null;await Speech.stop();setAvatarSpeaking(false);setAudioPositionMs(null);
    await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});
    if(AppState.currentState!=='active')throw new Error('Return to Nia before recording.');
    await recorder.prepareToRecordAsync();
    if(AppState.currentState!=='active')throw new Error('Recording was cancelled while Nia was backgrounded.');
    recorder.record();
    recordingRef.current=true;setRecording(true);operation.current=true;
   }
  }catch(error){recordingRef.current=false;setRecording(false);await recorder.stop().catch(()=>{});await setAudioModeAsync({allowsRecording:false}).catch(()=>{});Alert.alert('Voice unavailable',String(error));}
  finally{setVoiceBusy(false);if(!recordingRef.current)operation.current=false;}
 }
 async function lookAtScene(){
  if(operation.current||voiceBusy||!loaded)return;
  if(!endpoint||!token){Alert.alert('Connect GroqCloud first','Set the GroqCloud endpoint and your private API key in AI connection settings.');return;}
  operation.current=true;setVisionBusy(true);
  const version=historyVersion.current;
  try{
  const permission=await ImagePicker.requestCameraPermissionsAsync();
  if(!permission.granted){Alert.alert('Camera access required','Enable camera permission to take a photo for Nia to interpret.');return;}
  let photo:{base64?:string|null;mimeType?:string|null}|undefined;
  if(cameraVisible&&cameraRef.current){photo=await cameraRef.current.takePictureAsync({base64:true,quality:0.45,skipProcessing:false});}
  else{const capture=await ImagePicker.launchCameraAsync({cameraType:ImagePicker.CameraType.front,base64:true,quality:0.45,allowsEditing:false});if(capture.canceled)return;photo=capture.assets[0];}
  if(!photo?.base64)return;
   const visionModel='meta-llama/llama-4-scout-17b-16e-instruct';
   const userQuestion=draft.trim()||'Describe my visible expression, clothing, and surroundings naturally. If any detail is uncertain, say so. Do not infer private or sensitive traits.';
   const response=await fetchWithTimeout(secureUrl(endpoint),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({model:visionModel,stream:false,max_tokens:350,messages:[
      {role:'system',content:'You are Nia, a warm, playful AI companion. The user has explicitly shared a single camera photo for this response. Describe only visible details. Do not claim to watch continuously, know hidden feelings, or identify the person. Avoid sensitive inferences. '+(flirty?'You may use gentle, consensual flirtatious compliments.':'Keep a friendly, non-flirtatious tone.')},
      {role:'user',content:[{type:'text',text:userQuestion},{type:'image_url',image_url:{url:'data:'+(photo.mimeType||'image/jpeg')+';base64,'+photo.base64}}]}
    ]})});
   if(!response.ok)throw new Error('Vision API HTTP '+response.status+'; check that your GroqCloud account supports '+visionModel);
   const data=await response.json();
   const answer=data?.choices?.[0]?.message?.content;
   if(typeof answer!=='string'||!answer.trim()||answer.length>16000)throw new Error('Vision response missing or too large');
   if(version!==historyVersion.current)return;
   const updated:Message[]=[...messages,{role:'user',content:'[Shared a camera photo] '+userQuestion},{role:'assistant',content:answer}];
   await saveConversation(updated);setMessages(updated);setDraft('');
   if(speak)await say(answer);
  }catch(error){Alert.alert('Vision unavailable',String(error));}
  finally{operation.current=false;setVisionBusy(false);}
 }
 async function saveMemoryNotes(){
  const notes=memoryDraft.trim().slice(0,2000);
  await AsyncStorage.setItem('nia_memory_notes',notes);
  setMemoryNotes(notes);
  Alert.alert('Memory updated','Your notes are stored on this device and used as context in future conversations.');
 }
 async function shareHistory(){
  if(!messages.length){Alert.alert('No messages yet','Start a conversation before exporting.');return;}
  await Share.share({message:messages.map(m=>(m.role==='user'?'You: ':'Nia: ')+m.content).join('\n\n')});
 }
 async function changeAssistantMode(next:'companion'|'research'|'business'){
  setAssistantMode(next);await AsyncStorage.setItem('nia_assistant_mode',next);
 }
 async function toggleCheckins(){
  try {if(checkins){await disableCheckIns();setCheckins(false);}else{await enableCheckIns();setCheckins(true);}}
  catch(e){Alert.alert('Notifications unavailable',String(e));}
 }
 async function clearHistory(){if(operation.current)return;historyVersion.current++;speechVersion.current++;alignedPlayer.current?.stop();alignedPlayer.current=null;await Speech.stop();setAvatarSpeaking(false);setAudioPositionMs(null);setVisemeCues([]);await deleteConversation();setMessages([]);}
 return <SafeAreaView style={s.screen} edges={['top','bottom']}><ScrollView style={s.screen} contentContainerStyle={s.screenContent} keyboardShouldPersistTaps="handled">
  <Text style={s.title}>Nia</Text>
  <Avatar3D speaking={avatarSpeaking} visemes={visemeCues} playbackMs={audioPositionMs}/>
  <Pressable style={s.secondary} onPress={async()=>{const next=!flirty;setFlirty(next);await AsyncStorage.setItem('nia_flirty',String(next));}}><Text style={s.white}>Flirtatious personality: {flirty?'On':'Off'}</Text></Pressable>
  <Pressable style={s.secondary} onPress={async()=>{if(cameraVisible){setCameraVisible(false);return;}const permission=cameraPermission?.granted?cameraPermission:await requestCameraPermission();if(permission.granted){setCameraVisible(true);}else{Alert.alert('Camera permission needed','Allow camera access to show a live preview while Nia is open.');}}}><Text style={s.white}>{cameraVisible?'Stop camera preview':'Enable front camera (while app is open)'}</Text></Pressable>
  {cameraVisible?<View><CameraView ref={cameraRef} style={{height:220,borderRadius:12,overflow:'hidden'}} facing="front" active={cameraVisible}/><Text style={s.note}>Live camera preview only. Use the photo button to share a single image with Nia for AI interpretation. Camera stops when preview closes; no background recording.</Text></View>:null}
  <Pressable style={s.button} disabled={visionBusy||busy} onPress={lookAtScene}><Text style={s.white}>{visionBusy?'Nia is looking…':'Take photo and ask Nia what she sees'}</Text></Pressable>
  <Text style={s.note}>Assistant mode: {assistantMode}</Text>
  <View style={{flexDirection:'row',gap:6}}>{(['companion','research','business'] as const).map(mode=><Pressable key={mode} style={[s.secondary,{flex:1,backgroundColor:assistantMode===mode?'#704566':'transparent'}]} onPress={()=>changeAssistantMode(mode)}><Text style={s.white}>{mode}</Text></Pressable>)}</View>
  <Text style={s.note}>AI companion · {(useGateway?gatewayUrl:endpoint)?'AI endpoint configured':'AI connection required'} · production rig required for release</Text>
  <Pressable onPress={()=>setSetup(!setup)} style={s.secondary}><Text style={s.white}>{setup?'Close settings':'AI connection settings'}</Text></Pressable>
  {setup?<View>
    <Text style={s.note}>Nia secure gateway (optional; server must be deployed separately)</Text>
    <TextInput value={gatewayUrl} onChangeText={setGatewayUrl} style={s.input} autoCapitalize="none" placeholder="https://your-nia-api.example" placeholderTextColor="#bbb"/>
    <TextInput value={gatewayToken} onChangeText={setGatewayToken} style={s.input} secureTextEntry placeholder="Gateway client access token" placeholderTextColor="#bbb"/>
    <Pressable style={s.secondary} onPress={async()=>{try{const url=useGateway?gatewayUrl:normalizeGatewayUrl(gatewayUrl);if(!useGateway&&!gatewayToken.trim())throw new Error('Enter the gateway access token.');await AsyncStorage.setItem('nia_gateway_url',url);await SecureStore.setItemAsync('nia_gateway_token',gatewayToken);await AsyncStorage.setItem('nia_gateway_enabled',String(!useGateway));setGatewayUrl(url);setUseGateway(!useGateway);}catch(e){Alert.alert('Gateway configuration',String(e));}}}><Text style={s.white}>Secure gateway: {useGateway?'Enabled (tap to disable)':'Disabled (tap to enable)'}</Text></Pressable>
    <Pressable style={s.secondary} onPress={async()=>{try{Alert.alert('Gateway diagnostics',(await checkGateway(gatewayUrl))?'API health check passed':'API health check failed');}catch(e){Alert.alert('Gateway diagnostics',String(e));}}}><Text style={s.white}>Test gateway connection</Text></Pressable>
    <Pressable style={s.secondary} onPress={()=>{setEndpoint('https://api.groq.com/openai/v1/chat/completions');setModel('llama-3.3-70b-versatile');}}><Text style={s.white}>Use GroqCloud (recommended)</Text></Pressable>
    <Text style={s.note}>GroqCloud: select this preset, enter your API key below, then save. The key is stored in this device’s secure storage, not in GitHub. For production distribution, use a server-side proxy so the provider key is never shipped to clients.</Text>
    <TextInput value={endpoint} onChangeText={setEndpoint} style={s.input} autoCapitalize="none" placeholder="https://server/v1/chat/completions" placeholderTextColor="#bbb"/>
    <TextInput value={model} onChangeText={setModel} style={s.input} autoCapitalize="none" placeholder="Model name" placeholderTextColor="#bbb"/>
    <TextInput value={token} onChangeText={setToken} style={s.input} secureTextEntry placeholder="GroqCloud API key (private)" placeholderTextColor="#bbb"/>
    <Pressable onPress={saveConfig} style={s.button}><Text style={s.white}>Save settings</Text></Pressable>
    <Pressable onPress={()=>setSpeak(!speak)} style={s.secondary}><Text style={s.white}>Spoken replies: {speak?'On':'Off'}</Text></Pressable>
    <Text style={s.note}>Timed lip sync requires a gateway providing audio and matching viseme timing from one synthesis; Android device speech remains unaligned.</Text>
    <Pressable onPress={toggleCheckins} style={s.secondary}><Text style={s.white}>Daytime check-ins: {checkins?'On':'Off'}</Text></Pressable>
    <Text style={s.note}>Memory notes — only information you choose to save</Text>
    <TextInput value={memoryDraft} onChangeText={setMemoryDraft} multiline style={s.input} placeholder="Preferences or details for Nia to remember" placeholderTextColor="#bbb"/>
    <Pressable onPress={saveMemoryNotes} style={s.secondary}><Text style={s.white}>Save memory notes</Text></Pressable>
    <Pressable onPress={async()=>{await AsyncStorage.removeItem('nia_memory_notes');setMemoryNotes('');setMemoryDraft('');}} style={s.secondary}><Text style={s.white}>Erase memory notes</Text></Pressable>
    <Pressable disabled={busy||visionBusy} onPress={clearHistory} style={s.secondary}><Text style={s.white}>Delete conversation history</Text></Pressable>
   </View>:null}
  <Pressable onPress={callCapabilityNotice} style={s.secondary}><Text style={s.white}>Telephone assistant — dialer only</Text></Pressable>
  <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor="#bbb"/>
  <TextInput style={s.input} value={question} onChangeText={setQuestion} placeholder="Question to ask (saved for your reference)" placeholderTextColor="#bbb"/>
  <Pressable style={s.secondary} onPress={async()=>{try{await openDialer(phone);}catch(e){Alert.alert('Cannot dial',String(e));}}}><Text style={s.white}>Open phone dialer</Text></Pressable>
  <Pressable onPress={shareHistory} style={s.secondary}><Text style={s.white}>Export conversation</Text></Pressable>
  <View style={s.history}>{messages.map((m,i)=><Text key={i} style={s.msg}>{m.role==='user'?'You':'Nia'}: {m.content}</Text>)}</View>
  <Pressable style={s.secondary} disabled={voiceBusy||busy||visionBusy||!loaded} onPress={toggleVoice}><Text style={s.white}>{recording?'Stop recording and transcribe':voiceBusy?'Processing voice…':'Record voice message'}</Text></Pressable>
  <Text style={s.note}>Recorded speech becomes a draft for you to review and send.</Text>
  <TextInput style={s.input} value={draft} onChangeText={setDraft} placeholder="Message Nia" placeholderTextColor="#bbb" multiline/>
  <Pressable disabled={busy||visionBusy||voiceBusy||recording||!loaded} style={s.button} onPress={send}><Text style={s.white}>{busy?'Thinking…':'Send'}</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#201724'},screenContent:{paddingTop:16,paddingHorizontal:20,paddingBottom:28,flexGrow:1},title:{fontSize:32,color:'#fff',fontWeight:'bold'},note:{color:'#e7bed8',marginVertical:12},history:{flex:1},msg:{color:'#fff',padding:10},input:{borderColor:'#ad86a5',borderWidth:1,borderRadius:10,padding:12,color:'#fff',marginTop:8},button:{backgroundColor:'#704566',padding:13,borderRadius:10,marginTop:10},secondary:{borderColor:'#704566',borderWidth:1,padding:10,borderRadius:10,marginTop:8},white:{color:'#fff',textAlign:'center'}});


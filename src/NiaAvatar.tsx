import React,{useEffect,useState} from 'react';
import {View,Text,Image,Pressable,StyleSheet,Alert,useWindowDimensions} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY='nia_original_avatar_uri';
export default function NiaAvatar(){
 const [uri,setUri]=useState<string|null>(null);
 const {height}=useWindowDimensions();
 const avatarHeight=Math.max(240,Math.round(height*0.5));
 useEffect(()=>{AsyncStorage.getItem(KEY).then(setUri).catch(()=>{});},[]);
 async function choose(){
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,quality:1});
  if(result.canceled||!result.assets?.[0]?.uri)return;
  const selected=result.assets[0].uri;
  try{await AsyncStorage.setItem(KEY,selected);setUri(selected);}
  catch(e){Alert.alert('Could not save photo',String(e));}
 }
 return <View style={styles.container}>
  {uri?<Image source={{uri}} style={[styles.photo,{height:avatarHeight}]} resizeMode="contain" accessibilityLabel="User-selected Nia character photo"/>:
  <View style={[styles.empty,{height:avatarHeight}]}><Text style={styles.label}>Nia's original character photo has not been added to this installation.</Text></View>}
  <Pressable style={styles.button} onPress={choose}><Text style={styles.label}>{uri?'Change original photo':'Select original Nia photo'}</Text></Pressable>
  <Text style={styles.caption}>This displays the selected original image. A rigged, animated 3D avatar is not installed yet.</Text>
 </View>;
}
const styles=StyleSheet.create({container:{alignItems:'center',marginVertical:8},photo:{width:'100%',height:230,borderRadius:12},empty:{height:120,justifyContent:'center',padding:16},button:{padding:12,borderColor:'#ad86a5',borderWidth:1,borderRadius:10,marginTop:8},label:{color:'#fff',textAlign:'center'},caption:{color:'#d4aeca',fontSize:12,marginTop:8,textAlign:'center'}});

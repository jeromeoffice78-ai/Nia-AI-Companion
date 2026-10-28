import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = 'nia_checkins_enabled';
const IDS_KEY = 'nia_checkin_ids';
const DAY_SECONDS = 24 * 60 * 60;

export async function disableCheckIns():Promise<void> {
 const stored=await AsyncStorage.getItem(IDS_KEY);
 const ids:string[]=stored?JSON.parse(stored):[];
 for(const id of ids) {
  try {await Notifications.cancelScheduledNotificationAsync(id);}catch {}
 }
 await AsyncStorage.multiSet([[IDS_KEY,'[]'],[ENABLED_KEY,'false']]);
}

export async function enableCheckIns():Promise<number> {
 const permission=await Notifications.requestPermissionsAsync();
 if(!permission.granted)throw new Error('Notification permission not granted');
 await disableCheckIns();
 if(process.env.EXPO_OS === 'android'){
  await Notifications.setNotificationChannelAsync('nia-checkins',{
   name:'Nia check-ins',importance:Notifications.AndroidImportance.DEFAULT,
  });
 }
 const ids:string[]=[];
 // Schedule one notification per day for the next 7 days. The times vary
 // deterministically and remain between 9:00 and 20:59 local time.
 for(let day=1;day<=7;day++){
  const at=new Date();
  at.setDate(at.getDate()+day);
  at.setHours(9+((day*7)%12), (day*17)%60,0,0);
  const id=await Notifications.scheduleNotificationAsync({
   content:{title:'Nia',body:'Would you like to talk for a while?',data:{type:'checkin'}},
   trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:at,channelId:'nia-checkins'},
  });
  ids.push(id);
 }
 await AsyncStorage.multiSet([[IDS_KEY,JSON.stringify(ids)],[ENABLED_KEY,'true']]);
 return ids.length;
}
export async function checkInsEnabled():Promise<boolean>{
 return (await AsyncStorage.getItem(ENABLED_KEY))==='true';
}

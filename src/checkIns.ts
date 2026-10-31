import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = 'nia_checkins_enabled';
const IDS_KEY = 'nia_checkin_ids';

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
 // Seven recurring weekly notifications: one per weekday, each at a
 // deterministic daytime hour. Unlike one-time DATE triggers, these do not
 // silently stop after the first week.
 for(let day=1;day<=7;day++){
  const hour=9+((day*7)%12);
  const minute=(day*17)%60;
  const id=await Notifications.scheduleNotificationAsync({
   content:{title:'Nia',body:'Would you like to talk for a while?',data:{type:'checkin'}},
   trigger:{type:Notifications.SchedulableTriggerInputTypes.WEEKLY,weekday:day,hour,minute,channelId:'nia-checkins'},
  });
  ids.push(id);
 }
 await AsyncStorage.multiSet([[IDS_KEY,JSON.stringify(ids)],[ENABLED_KEY,'true']]);
 return ids.length;
}
export async function checkInsEnabled():Promise<boolean>{
 return (await AsyncStorage.getItem(ENABLED_KEY))==='true';
}

import * as Linking from 'expo-linking';
import {Alert} from 'react-native';
export type CallDraft={phone:string;question:string};
export function sanitizePhone(value:string):string{
 const v=value.trim();
 if(!/^\+?[0-9() .-]{7,25}$/.test(v))throw new Error('Enter a valid telephone number.');
 const digits=v.replace(/\D/g,'');
 if(digits.length<7||digits.length>15)throw new Error('Telephone number must contain 7–15 digits.');
 return (v.startsWith('+')?'+':'')+digits;
}
export async function openDialer(phone:string):Promise<void>{
 const normalized=sanitizePhone(phone);
 const url='tel:'+normalized;
 const supported=await Linking.canOpenURL(url);
 if(!supported)throw new Error('This device cannot open a telephone dialer.');
 await Linking.openURL(url);
}
export function callCapabilityNotice(){
 Alert.alert('Telephone assistant','Nia can open your device dialer with a number you choose. She cannot yet speak to the other party, record calls, or place unattended calls. Those capabilities require a separate telephony service, permission, and consent.');
}

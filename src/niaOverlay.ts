import {NativeModules,Platform} from 'react-native';
import {OverlaySpeechFrame} from './overlaySpeech';
type OverlayNative={hasPermission:()=>Promise<boolean>;requestPermission:()=>Promise<boolean>;show:()=>Promise<boolean>;hide:()=>Promise<boolean>;getStatus:()=>Promise<string>;setSpeechState:(viseme:string,opening:number,speaking:boolean)=>Promise<boolean>};
function getOverlay():OverlayNative{
 if(Platform.OS!=='android'||!NativeModules.NiaOverlay)throw new Error('Floating Nia requires the native Android APK build.');
 return NativeModules.NiaOverlay as OverlayNative;
}
export async function showNiaOverlay():Promise<'shown'|'permission-required'>{
 const native=getOverlay();
 if(!await native.hasPermission()){await native.requestPermission();return 'permission-required';}
 await native.show();return 'shown';
}
export async function hideNiaOverlay():Promise<void>{await getOverlay().hide();}
export async function niaOverlayStatus():Promise<string>{return getOverlay().getStatus();}
export async function sendNiaOverlaySpeech(frame:OverlaySpeechFrame):Promise<boolean>{
 return getOverlay().setSpeechState(frame.viseme,frame.opening,frame.speaking);
}
export async function clearNiaOverlaySpeech():Promise<boolean>{
 return sendNiaOverlaySpeech({viseme:'sil',opening:0,speaking:false});
}

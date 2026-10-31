import {NativeModules,Platform} from 'react-native';
type OverlayNative={hasPermission:()=>Promise<boolean>;requestPermission:()=>Promise<boolean>;show:()=>Promise<boolean>;hide:()=>Promise<boolean>};
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

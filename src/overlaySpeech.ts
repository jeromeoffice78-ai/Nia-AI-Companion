import {validateVisemes,visemeAt,mouthOpenForViseme,VisemeCue,Viseme} from './visemes';
export type OverlaySpeechFrame={viseme:Viseme;opening:number;speaking:boolean};
/** Only a measured audio clock and its own aligned timeline can move the mouth. */
export function overlaySpeechFrame(cues:readonly VisemeCue[],playbackMs:number|null,speaking:boolean):OverlaySpeechFrame{
 const silent:OverlaySpeechFrame={viseme:'sil',opening:0,speaking:false};
 if(speaking!==true||playbackMs===null||!Number.isFinite(playbackMs)||playbackMs<0||!cues.length)return silent;
 if(cues.length>2500)throw new Error('Overlay speech timeline exceeds limit.');
 const validated=validateVisemes(cues);
 if(validated.at(-1)!.endMs>120000)throw new Error('Overlay speech timeline exceeds duration limit.');
 const viseme=visemeAt(validated,playbackMs);
 return {viseme,opening:mouthOpenForViseme(viseme),speaking:viseme!=='sil'};
}

/** Timed viseme cues supplied by an aligned TTS engine.
 * Expo Speech does not expose phoneme timestamps, so this module never
 * fabricates alignment from text.
 */
export type Viseme='sil'|'PP'|'FF'|'TH'|'DD'|'kk'|'CH'|'SS'|'nn'|'RR'|'aa'|'E'|'ih'|'oh'|'ou';
export type VisemeCue={startMs:number;endMs:number;viseme:Viseme};
export const VISEMES:readonly Viseme[]=['sil','PP','FF','TH','DD','kk','CH','SS','nn','RR','aa','E','ih','oh','ou'];
export function validateVisemes(value:unknown):VisemeCue[]{
 if(!Array.isArray(value))throw new Error('Viseme timeline must be an array');
 let previousEnd=0;
 return value.map((item,index)=>{
  if(!item||typeof item!=='object')throw new Error('Invalid viseme cue '+index);
  const cue=item as Partial<VisemeCue>;
  if(typeof cue.startMs!=='number'||typeof cue.endMs!=='number'||
   !Number.isFinite(cue.startMs)||!Number.isFinite(cue.endMs)||
   cue.startMs<previousEnd||cue.endMs<=cue.startMs||
   !VISEMES.includes(cue.viseme as Viseme))throw new Error('Invalid viseme timing '+index);
  previousEnd=cue.endMs;
  return {startMs:cue.startMs,endMs:cue.endMs,viseme:cue.viseme as Viseme};
 });
}
export function visemeAt(cues:readonly VisemeCue[],timeMs:number):Viseme{
 if(!Number.isFinite(timeMs)||timeMs<0)return 'sil';
 for(const cue of cues)if(timeMs>=cue.startMs&&timeMs<cue.endMs)return cue.viseme;
 return 'sil';
}
export function mouthOpenForViseme(viseme:Viseme):number{
 const openings:Record<Viseme,number>={
  sil:0,PP:0.03,FF:0.14,TH:0.24,DD:0.24,kk:0.32,
  CH:0.25,SS:0.12,nn:0.13,RR:0.33,aa:1,E:0.55,
  ih:0.36,oh:0.67,ou:0.30
 };
 return openings[viseme];
}

import {normalizeGatewayUrl} from './niaGateway';
import {fetchWithTimeout} from './network';
import {validateVisemes,VisemeCue} from './visemes';

/** A server-issued audio source and time-aligned phoneme shapes for the SAME
 * synthesized recording. No text-derived/estimated mouth timing is accepted.
 * The audio endpoint must be same-origin and use the Nia gateway auth token.
 */
export type AlignedSpeech={audioUri:string;audioHeaders:Record<string,string>;cues:VisemeCue[]};
export class AlignedSpeechUnavailable extends Error{
 constructor(message:string,public readonly unavailable:boolean=false){super(message);this.name='AlignedSpeechUnavailable';}
}
export function parseAlignedSpeech(baseUrl:string,token:string,result:unknown):AlignedSpeech{
 const base=normalizeGatewayUrl(baseUrl);
 if(!token.trim())throw new Error('Gateway token is required for aligned speech');
 if(!result||typeof result!=='object')throw new Error('Invalid aligned speech response');
 const data=result as {audioPath?:unknown;visemes?:unknown;format?:unknown};
 if(typeof data.audioPath!=='string'||!/^\/v1\/speech\/audio\/[A-Za-z0-9_-]{12,100}$/.test(data.audioPath))
  throw new Error('Speech audio must be a same-origin, authenticated gateway resource');
 if(data.format!=='audio/mpeg')throw new Error('Aligned speech requires supported MPEG audio');
 const cues=validateVisemes(data.visemes);
 if(!cues.length||cues.length>2500||cues[cues.length-1].endMs>120000)
  throw new Error('Aligned speech timeline is empty or too long');
 return {audioUri:base+data.audioPath,audioHeaders:{Authorization:'Bearer '+token},cues};
}
export async function requestAlignedSpeech(baseUrl:string,token:string,text:string):Promise<AlignedSpeech>{
 const base=normalizeGatewayUrl(baseUrl);
 if(!token.trim()||!text.trim()||text.length>4000)throw new Error('Invalid aligned speech request');
 const res=await fetchWithTimeout(base+'/v1/speech',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({text:text.trim()})
 },35000);
 if(res.status===404||res.status===501||res.status===503)
  throw new AlignedSpeechUnavailable('Aligned speech is not configured on the Nia gateway',true);
 if(!res.ok)throw new AlignedSpeechUnavailable('Aligned speech gateway HTTP '+res.status);
 return parseAlignedSpeech(base,token,await res.json());
}

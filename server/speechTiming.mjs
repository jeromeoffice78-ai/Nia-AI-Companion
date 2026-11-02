/** Azure viseme IDs mapped to Nia's existing 8-face-target mouth rig.
 * Coarse lip-shape mapping; exact facial fidelity requires an approved face rig.
 * Events are timed using offsets from the SAME synthesized audio.
 */
export const idToViseme=Object.freeze([
 'sil','aa','aa','oh','E','RR','ih','ou','oh','ou','oh',
 'ih','kk','RR','nn','SS','CH','TH','FF','DD','kk','PP'
]);
export function timingToCues(events,durationMs){
 if(!Array.isArray(events)||events.length<1||events.length>2500)throw Error('Missing or excessive Azure viseme events');
 const ordered=events.map(e=>({timeMs:Number(e.timeMs),id:Number(e.id)})).sort((a,b)=>a.timeMs-b.timeMs);
 const cues=[];
 let previous=0;
 for(let i=0;i<ordered.length;i++){
  const item=ordered[i],start=Math.round(item.timeMs);
  if(!Number.isFinite(start)||start<0||start>120000||!Number.isInteger(item.id)||item.id<0||item.id>=idToViseme.length)
   throw Error('Invalid Azure viseme event');
  if(start<previous)throw Error('Nonmonotonic Azure visemes');
  if(start>previous)cues.push({startMs:previous,endMs:start,viseme:'sil'});
  const next=ordered[i+1]?.timeMs;
  const end=Math.min(120000,Math.max(start+1,Math.round(next??durationMs??(start+180))));
  if(end<=start)throw Error('Non-positive viseme interval');
  cues.push({startMs:start,endMs:end,viseme:idToViseme[item.id]});
  previous=end;
 }
 return cues;
}

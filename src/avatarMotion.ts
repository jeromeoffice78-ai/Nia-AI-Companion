/** Select actual rig animations during conversation and idle periods.
 * Avoid replaying the active clip so each autonomous change is visible.
 * Viseme/audio alignment is separate from skeletal motion.
 */
export type Motion='Idle'|'Walk'|'Dance'|'Wave';
const SPEAKING:readonly Motion[]=['Idle','Walk','Wave'];
const IDLE:readonly Motion[]=['Idle','Walk','Dance','Wave'];
export function chooseAutonomousMotion(speaking:boolean,current:Motion,random:number):Motion{
 if(!Number.isFinite(random)||random<0||random>=1)throw new RangeError('Random sample must be in [0,1)');
 const candidates=(speaking?SPEAKING:IDLE).filter(name=>name!==current);
 return candidates[Math.floor(random*candidates.length)];
}

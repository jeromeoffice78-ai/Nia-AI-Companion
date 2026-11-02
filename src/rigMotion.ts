/** Additive skeletal motion layered on the imported rig's animation clips.
 * This works with the named GLB bones; it does NOT repair disconnected source mesh
 * geometry or establish appearance likeness and phoneme synchronization.
 */
export type BodyMotion='Idle'|'Walk'|'Dance'|'Wave';
export type AxisOffsets=readonly [number,number,number];
export type BodyPose={hips:readonly [number,number,number];rotations:Record<string,AxisOffsets>};
const ROTATION_BONES=['Hips','Spine','Chest','UpperChest','Neck',
 'LeftShoulder','RightShoulder','LeftLowerArm','RightLowerArm',
 'LeftHand','RightHand','LeftUpperLeg','RightUpperLeg',
 'LeftLowerLeg','RightLowerLeg','LeftFoot','RightFoot'] as const;
export const REQUIRED_BODY_BONES:readonly string[]=ROTATION_BONES;
export function computeBodyPose(mode:BodyMotion,timeSeconds:number):BodyPose{
 if(!Number.isFinite(timeSeconds))throw new RangeError('Animation time must be finite');
 const t=Math.max(0,timeSeconds),s=Math.sin,c=Math.cos;
 const rotations:Record<string,AxisOffsets>={};
 for(const name of ROTATION_BONES)rotations[name]=[0,0,0];
 let hips:readonly [number,number,number]=[0,0,0];
 if(mode==='Idle'){
  const breath=s(t*1.7);
  rotations.Spine=[0.012*breath,0,0.006*breath];
  rotations.Neck=[0.01*s(t*.8),0,0];
  rotations.LeftShoulder=[0,0,0.012*breath];
  rotations.RightShoulder=[0,0,-0.012*breath];
 }else if(mode==='Walk'){
  const beat=t*5.6,step=s(beat),opposite=s(beat+Math.PI);
  hips=[0.018*step,0.012*(1-c(2*beat)),0];
  rotations.Hips=[0,0.07*step,0.025*step];
  rotations.Spine=[0.035*step,-0.06*step,-0.045*step];
  rotations.Chest=[0,0.045*step,0.028*step];
  rotations.Neck=[-0.015*step,0,0];
  rotations.LeftShoulder=[0,0.045*step,-0.03*step];
  rotations.RightShoulder=[0,-0.045*step,0.03*step];
  rotations.LeftLowerArm=[0,0,0.24+0.08*step];
  rotations.RightLowerArm=[0,0,-0.24-0.08*step];
  rotations.LeftUpperLeg=[0.28*step,0,0];
  rotations.RightUpperLeg=[0.28*opposite,0,0];
  rotations.LeftLowerLeg=[0.26*Math.max(0,-step),0,0];
  rotations.RightLowerLeg=[0.26*Math.max(0,-opposite),0,0];
  rotations.LeftFoot=[-0.12*step,0,0];
  rotations.RightFoot=[-0.12*opposite,0,0];
 }else if(mode==='Dance'){
  const beat=t*7,side=s(beat),bounce=(1-c(2*beat))/2;
  const leftPulse=Math.max(0,s(beat)),rightPulse=Math.max(0,s(beat+Math.PI));
  hips=[0.065*side,0.038*bounce,0];
  rotations.Hips=[0,0.18*side,0.10*side];
  rotations.Spine=[0.07*bounce,-0.13*side,-0.11*side];
  rotations.Chest=[0.06*bounce,0.15*side,0.09*side];
  rotations.UpperChest=[-0.045*bounce,0.08*side,0.065*side];
  rotations.Neck=[0.035*s(beat+0.6),-0.025*side,0];
  rotations.LeftShoulder=[0.12*s(beat+0.3),0,-0.12*side];
  rotations.RightShoulder=[0.12*s(beat+0.3),0,0.12*side];
  rotations.LeftLowerArm=[-0.07*bounce,0,0.25+0.27*leftPulse];
  rotations.RightLowerArm=[-0.07*bounce,0,-0.25-0.27*rightPulse];
  rotations.LeftHand=[0.04*side,0,0.16*side];
  rotations.RightHand=[-0.04*side,0,-0.16*side];
  rotations.LeftUpperLeg=[0.23*side,0,0];
  rotations.RightUpperLeg=[-0.23*side,0,0];
  rotations.LeftLowerLeg=[0.19+0.25*leftPulse,0,0];
  rotations.RightLowerLeg=[0.19+0.25*rightPulse,0,0];
  rotations.LeftFoot=[-0.16*leftPulse,0,0.04*side];
  rotations.RightFoot=[-0.16*rightPulse,0,-0.04*side];
 }else if(mode==='Wave'){
  const wave=s(t*7.5);
  rotations.Hips=[0,0.02*wave,0];
  rotations.Spine=[0,0.035*wave,0.018*wave];
  rotations.Chest=[0,0.045*wave,0.02*wave];
  rotations.Neck=[0.012*wave,0,0];
  rotations.RightShoulder=[0,0,-0.08*wave];
  rotations.RightLowerArm=[0,0,-0.85-0.14*wave];
  rotations.RightHand=[0,0,-0.25*wave];
  rotations.LeftLowerArm=[0,0,0.12];
 }else{
  throw new RangeError('Unknown body motion');
 }
 return {hips,rotations};
}

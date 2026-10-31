import {sanitizePhone} from './phone';
/** Consent-gated outbound call request. This does not place calls by itself.
 * A configured HTTPS telephony backend must authenticate the user and
 * enforce authorization, disclosure, provider policies and rate limits.
 */
export type CallAuthorization={
 phone:string;purpose:string;approved:boolean;discloseAI:boolean;
};
export function validateCallAuthorization(value:CallAuthorization):CallAuthorization{
 const phone=sanitizePhone(value.phone);
 const purpose=value.purpose.trim();
 if(!value.approved)throw new Error('Explicit approval is required before calling.');
 if(!value.discloseAI)throw new Error('AI identity disclosure is required.');
 if(!purpose||purpose.length>500)throw new Error('Provide a call purpose (1–500 characters).');
 return {phone,purpose,approved:true,discloseAI:true};
}
export async function requestAuthorizedCall(
 backendUrl:string,authorization:CallAuthorization,accessToken:string
):Promise<{requestId:string;status:string}>{
 const payload=validateCallAuthorization(authorization);
 if(!/^https:\/\//i.test(backendUrl))throw new Error('A secure HTTPS calling backend is required.');
 if(!accessToken.trim())throw new Error('Calling backend authentication is required.');
 const response=await fetch(backendUrl,{
  method:'POST',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessToken},
  body:JSON.stringify(payload)
 });
 if(!response.ok)throw new Error('Calling service rejected request: '+response.status);
 const data:unknown=await response.json();
 if(!data||typeof data!=='object')throw new Error('Invalid calling service response');
 const result=data as Record<string,unknown>;
 if(typeof result.requestId!=='string'||typeof result.status!=='string')throw new Error('Invalid calling service response');
 return {requestId:result.requestId,status:result.status};
}

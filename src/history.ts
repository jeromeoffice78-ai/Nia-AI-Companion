import type {NiaMessage} from './niaGateway';
export function parseHistory(raw:string):NiaMessage[]{
 const value:unknown=JSON.parse(raw);
 if(!Array.isArray(value)||value.some(m=>!m||typeof m!=='object'||
  !['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>16000)){
  throw new Error('Invalid saved conversation');
 }
 return value.slice(-200) as NiaMessage[];
}

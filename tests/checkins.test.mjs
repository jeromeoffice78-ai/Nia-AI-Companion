import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './loadTS.mjs';
test('partly scheduled notifications are cancelled on failure',async()=>{
 const saved=new Map(),cancelled=[];let created=0;
 const storage={getItem:async k=>saved.get(k)||null,setItem:async(k,v)=>saved.set(k,v),multiSet:async pairs=>pairs.forEach(([k,v])=>saved.set(k,v))};
 const notifications={requestPermissionsAsync:async()=>({granted:true}),getAllScheduledNotificationsAsync:async()=>[],SchedulableTriggerInputTypes:{WEEKLY:'weekly'},scheduleNotificationAsync:async()=>{if(++created===3)throw Error('OS scheduling failed');return 'id-'+created;},cancelScheduledNotificationAsync:async id=>cancelled.push(id)};
 const module=loadTS('src/checkIns.ts',{'expo-notifications':notifications,'@react-native-async-storage/async-storage':{default:storage}});
 await assert.rejects(module.enableCheckIns(),/OS scheduling failed/);
 assert.deepEqual(cancelled,['id-1','id-2']);assert.equal(saved.get('nia_checkins_enabled'),'false');
});

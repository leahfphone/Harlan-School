import {validateResponses} from './response-payload.js';
import {auth,db} from './firebase-client.js';
import {loadAssignmentWork,saveAssignmentDraft} from './assignment-submission.js';
import {readBackup,writeBackup,removeBackup} from './device-backup.js';
export async function createLessonDraftStore({chapter,lessonId,questions}) {
 await auth.authStateReady();
 const user=auth.currentUser,uid=user?.uid||null,durable=!!user&&!user.isAnonymous;
 const assignmentId='math6-ch'+chapter+'-'+(/^\d+$/.test(lessonId)?'lesson'+lessonId:lessonId);
 // Legacy anonymous drafts retain their original device key. Durable accounts
 // never read that key or another account's work.
 const key=durable?'harlan-'+uid+'-ch'+chapter+'-'+lessonId:'harlan-ch'+chapter+'-'+lessonId;
 let closed=false,timer=null,pending=Promise.resolve();
 function sameUser(){return (auth.currentUser?.uid||null)===uid;}
 function asResponses(value){return questions.map((question,i)=>({number:i+1,question,answer:value.answers?.[i]||'',work:value.notes?.[i]||'',checks:value.history?.[i]||[]}));}
 async function persist(value){
  if(closed||!durable||!sameUser())return;
  await saveAssignmentDraft({auth,db,assignmentId,responses:asResponses(value)});
 }
 return {
  async read(){
   let local=readBackup(key)||{};
   try{validateResponses(asResponses(local));}catch{local={};}
   if(!durable)return local;
   try{
    const remote=await loadAssignmentWork({auth,db,assignmentId});
    if(!sameUser())return {};
    if(!remote)return local;
    const rows=questions.map((q,i)=>remote.responses.find(r=>r.number===i+1&&r.question===q));
    return {answers:rows.map(r=>r?.answer||''),notes:rows.map(r=>r?.work||''),history:rows.map(r=>r?.checks||[])};
   }catch{return sameUser()?local:{};}
  },
  save(value){
   if(closed||(!sameUser()&&durable))return false;
   const saved=writeBackup(key,value);clearTimeout(timer);
   if(durable)timer=setTimeout(()=>{pending=persist(value).catch(()=>{});},600);
   return saved;
  },
  async flush(value){
   clearTimeout(timer);const local=writeBackup(key,value);await pending;
   if(closed||!sameUser())throw new Error('Sign-in changed. Reload this lesson.');
   if(durable)await persist(value);
   else if(!local)throw new Error('Device storage is unavailable.');
  },
  submitted(){closed=true;clearTimeout(timer);removeBackup(key);},
  close(){closed=true;clearTimeout(timer);}
 };
}

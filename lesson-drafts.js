import {validateResponses} from './response-payload.js';
import {auth,db} from './firebase-client.js';
import {signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {studentAccessMode} from './student-access.js';
import {loadAssignmentWork,saveAssignmentDraft} from './assignment-submission.js';
import {readBackup,writeBackup,removeBackup} from './device-backup.js';
export async function createLessonDraftStore({chapter,lessonId,questions}) {
 await auth.authStateReady();
 // Reuse the existing browser identity; no email/password or sign-in screen.
 if(!auth.currentUser)await signInAnonymously(auth);
 const user=auth.currentUser,uid=user.uid;
 let accessError=null,mode;
 try{mode=await studentAccessMode({auth,db});}catch(e){accessError=e;}
 const durable=mode==='assigned';
 const assignmentId='math6-ch'+chapter+'-'+(/^\d+$/.test(lessonId)?'lesson'+lessonId:lessonId);
 // Approved browser sessions and durable accounts isolate backups by UID.
 // Unenrolled legacy work keeps its existing device key.
 const key=durable?'harlan-'+uid+'-ch'+chapter+'-'+lessonId:'harlan-ch'+chapter+'-'+lessonId;
 let closed=false,timer=null,pending=Promise.resolve();
 function sameUser(){return (auth.currentUser?.uid||null)===uid;}
 function asResponses(value){return questions.map((question,i)=>({number:i+1,question,answer:value.answers?.[i]||'',work:value.notes?.[i]||'',checks:value.history?.[i]||[]}));}
 async function persist(value){
  if(closed||!durable||!sameUser())return;
  await saveAssignmentDraft({auth,db,assignmentId,responses:asResponses(value)});
 }
 return {
  accountSaved:durable,
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
   if(accessError)throw accessError;
   if(durable)await persist(value);
   else if(!local)throw new Error('Device storage is unavailable.');
  },
  submitted(){closed=true;clearTimeout(timer);removeBackup(key);},
  close(){closed=true;clearTimeout(timer);}
 };
}

// Shared classwork bridge: preserve legacy anonymous delivery while enabling
// durable accounts, teacher grading, and correction attempts on both chapters.
import {auth,db} from './firebase-client.js';
import {signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {doc,getDoc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {chapter4Status,submitChapter4,chapter4AssignmentId} from './math-chapter-4-submission-adapter.js';
import {chapter5Status,submitChapter5,chapter5AssignmentId} from './math-chapter-5-submission-adapter.js';
const chapters={4:{status:chapter4Status,submit:submitChapter4,id:chapter4AssignmentId},5:{status:chapter5Status,submit:submitChapter5,id:chapter5AssignmentId}};
export async function configureMathSubmission({chapter,lessonId,lessonTitle,questions,inputs,notes,histories,checkButtons,save,status,submitButton,saveButton}) {
 const adapter=chapters[chapter],key=uid=>'math'+chapter+'-delivered-'+uid+'-'+lessonId;
 let delivered=false,busy=false,initialized=false,initialUid=null;
 const lock=()=>{submitButton.disabled=!initialized||busy||delivered;saveButton.disabled=delivered;for(const field of [...inputs,...notes,...checkButtons])field.disabled=delivered||busy;};
 lock();
 submitButton.onclick=async()=>{
  if(!initialized||busy||delivered)return;
  busy=true;lock();
  try{
   save();status.textContent='Connecting to teacher dashboard…';
   if(initialUid && auth.currentUser?.uid!==initialUid)throw new Error('Sign-in changed. Reload this lesson before submitting.');
   const user=auth.currentUser||(await signInAnonymously(auth)).user;
   if(user.isAnonymous){
    const responses=questions.map((question,i)=>({number:i+1,question,answer:inputs[i].value,work:notes[i].value,checks:histories[i]}));
    await setDoc(doc(db,'submissions','math'+chapter+'_'+lessonId+'_'+user.uid),{student:'Harlan',studentUid:user.uid,testTitle:'Math 6 Chapter '+chapter+' — '+lessonTitle,submittedAt:serverTimestamp(),responses});
   }else{
    await adapter.submit({auth,db,lessonId,questions,answers:inputs.map(x=>x.value),work:notes.map(x=>x.value),checks:histories});
   }
   delivered=true;status.textContent='Submitted successfully to teacher dashboard.';
   // This marker only improves the legacy UI; Rules enforce immutability.
   try{localStorage.setItem(key(user.uid),'yes');}catch{}
  }catch(e){status.textContent='Submission was NOT sent. Your device draft remains available. '+(e.code||e.message);}
  finally{busy=false;lock();}
 };
 try{
  if(!adapter)throw new Error('Unknown math chapter');adapter.id(lessonId);
  await auth.authStateReady();initialUid=auth.currentUser?.uid||null;
  if(auth.currentUser){
   delivered=localStorage.getItem(key(auth.currentUser.uid))==='yes';
   if(!auth.currentUser.isAnonymous){
    const assignment=await getDoc(doc(db,'assignments',adapter.id(lessonId)));
    if(!assignment.exists()||assignment.data().type!=='classwork')throw new Error('This lesson is unavailable for your account.');
    const info=await adapter.status({auth,db,lessonId});delivered=['submitted','graded'].includes(info.status);
   }
  }
  initialized=true;if(delivered)status.textContent='This lesson has already been submitted. Wait for your teacher to return it before correcting.';
 }catch(e){status.textContent='Submission is unavailable. Your device draft remains available. '+(e.code||e.message);}
 lock();
}

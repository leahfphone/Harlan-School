import {signInWithEmailAndPassword,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {auth,db,environmentLabel} from './firebase-client.js';
import {validateResponses} from './response-payload.js';
import {submissionStatus,submitAssignment,saveAssignmentDraft,loadAssignmentDraft} from './assignment-submission.js';
const $=id=>document.getElementById(id),say=s=>$('status').textContent=s;
$('environment').textContent=environmentLabel;
let allowed=false,busy=false,generation=0,loaded=null;
function lock(){['question','answer','shown'].forEach(id=>$(id).disabled=!allowed||busy);$('submit').disabled=$('save').disabled=!allowed||busy;}
function invalidate(){generation++;allowed=false;loaded=null;lock();$('state').textContent='Not checked';}
function draftKey(target){return 'harlan-preview-'+target.uid+'-'+target.assignmentId;}
function responses(){return [{number:1,question:$('question').value,answer:$('answer').value,work:$('shown').value,checks:[]}];}
$('assignment').oninput=()=>{invalidate();$('answer').value='';$('shown').value='';say('Check this assignment before working.');};
$('signin').onclick=async()=>{try{await signInWithEmailAndPassword(auth,$('email').value,$('password').value);$('password').value='';}catch(e){say('Sign-in failed: '+e.code);}};
$('signout').onclick=()=>signOut(auth);
onAuthStateChanged(auth,u=>{invalidate();$('answer').value='';$('shown').value='';say(u?'Signed in as '+u.email+'. Check assignment status.':'Student sign-in required.');});
$('load').onclick=async()=>{
 invalidate();const version=generation,uid=auth.currentUser?.uid,id=$('assignment').value.trim();
 try{
  if(!uid||auth.currentUser.isAnonymous)throw new Error('Student sign-in required');
  const assignment=await getDoc(doc(db,'assignments',id));
  if(!assignment.exists()||!assignment.data().published)throw new Error('Assignment unavailable');
  if(assignment.data().type!=='classwork')throw new Error('Tests require the teacher-controlled assessment page.');
  const info=await submissionStatus({auth,db,assignmentId:id});
  if(version!==generation||auth.currentUser?.uid!==uid)return;
  loaded={uid,assignmentId:id};allowed=['not_submitted','returned'].includes(info.status);
  $('state').textContent='Status: '+info.status+(info.attempt?' | Attempt: '+info.attempt:'');
  if(allowed){
   const saved=await loadAssignmentDraft({auth,db,assignmentId:id});
   if(version!==generation)return;
   let restored=saved?.responses;
   if(!restored){try{restored=validateResponses(JSON.parse(localStorage.getItem(draftKey(loaded))||'null'));}catch{}}
   const r=restored?.[0];
   $('question').value=r?.question||'Explain how you found your answer.';$('answer').value=r?.answer||'';$('shown').value=r?.work||'';
  }
  lock();say(allowed?'Ready for work.':'Work locked until teacher returns it.');
 }catch(e){if(version===generation){invalidate();say('Could not open assignment: '+(e.code||e.message));}}
};
$('save').onclick=async()=>{
 if(!allowed||!loaded||busy)return;const target={...loaded},version=generation,data=responses();busy=true;lock();
 try{
  localStorage.setItem(draftKey(target),JSON.stringify(data));
  await saveAssignmentDraft({auth,db,assignmentId:target.assignmentId,responses:data});
  if(version===generation)say('Draft saved to your account. You can continue on another device.');
 }catch(e){if(version===generation)say('Account draft not saved. A backup remains on this device. '+(e.code||e.message));}
 finally{busy=false;lock();}
};
$('submit').onclick=async()=>{
 if(!allowed||!loaded||busy)return;
 if(!confirm('Submit this work to the teacher? You cannot change it until it is returned.'))return;
 const target={...loaded},version=generation,data=responses();busy=true;lock();
 try{
  localStorage.setItem(draftKey(target),JSON.stringify(data));
  await submitAssignment({auth,db,assignmentId:target.assignmentId,responses:data});
  localStorage.removeItem(draftKey(target));
  if(version===generation){allowed=false;$('state').textContent='Status: submitted';say('Submitted to teacher successfully.');}
 }catch(e){if(version===generation)say('Not submitted. Your device backup remains available. '+(e.code||e.message));}
 finally{busy=false;lock();}
};
lock();

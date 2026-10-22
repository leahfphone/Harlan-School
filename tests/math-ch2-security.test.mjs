import test,{after,beforeEach} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp} from 'firebase/firestore';
const rules=await readFile(new URL('../firestore.universal.draft.rules',import.meta.url),'utf8');
const env=await initializeTestEnvironment({projectId:'demo-harlan-math2',firestore:{rules,host:'127.0.0.1',port:8080}});
after(()=>env.cleanup());
const enrolled=(uid)=>env.authenticatedContext(uid,{email:uid+'@student.test',firebase:{sign_in_provider:'password'}}).firestore();
const teacher=env.authenticatedContext('teacher',{email:'lphone@jcatoday.org',email_verified:true}).firestore();
const student=enrolled('harlan1'),other=enrolled('other1');
const state=(db=student,uid='harlan1')=>doc(db,'assignmentStates',uid+'_math-ch2-test');
const attempt=(db=student,uid='harlan1',n=1)=>doc(state(db,uid),'attempts',String(n));
const responses=Array.from({length:37},(_,i)=>({number:i+1,question:'Question '+(i+1),answer:'',work:''}));
const submit=async(db=student,uid='harlan1',data=responses)=>{
 const {writeBatch}=await import('firebase/firestore');
 const batch=writeBatch(db);
 batch.set(state(db,uid),{studentUid:uid,assignmentId:'math-ch2-test',status:'submitted',currentAttempt:1,updatedAt:serverTimestamp()});
 batch.set(attempt(db,uid),{studentUid:uid,assignmentId:'math-ch2-test',attemptNumber:1,responses:data,submittedAt:serverTimestamp()});
 return batch.commit();
};
beforeEach(async()=>{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'studentAccess','harlan1'),{active:true});
  await setDoc(doc(db,'studentAccess','other1'),{active:false});
  await setDoc(doc(db,'assignments','math-ch2-test'),{published:true,type:'assessment'});
  await setDoc(doc(db,'secureAssessmentContent','math-ch2-test'),{questions:Array(37).fill('Private question')});
  await setDoc(doc(db,'assessmentReleases','math-ch2-test'),{released:false});
 });
});
test('locked questions and first submission denied',async()=>{await assertFails(getDoc(doc(student,'secureAssessmentContent','math-ch2-test')));await assertFails(submit());});
test('teacher releases and enrolled student submits once',async()=>{await setDoc(doc(teacher,'assessmentReleases','math-ch2-test'),{released:true});await assertSucceeds(getDoc(doc(student,'secureAssessmentContent','math-ch2-test')));await assertSucceeds(submit());await assertFails(submit());await assertFails(updateDoc(attempt(),{responses:[]}));await assertFails(deleteDoc(attempt()));});
test('inactive student and forged ownership denied',async()=>{await setDoc(doc(teacher,'assessmentReleases','math-ch2-test'),{released:true});await assertFails(submit(other,'other1'));await assertFails(submit(student,'other1'));});
test('student cannot release or read another student submission',async()=>{await assertFails(setDoc(doc(student,'assessmentReleases','math-ch2-test'),{released:true}));await setDoc(doc(teacher,'assessmentReleases','math-ch2-test'),{released:true});await assertSucceeds(submit());await assertFails(getDoc(state(other)));await assertSucceeds(getDoc(state(student)));await assertSucceeds(getDoc(state(teacher)));});
test('relocking prevents new submission',async()=>{await setDoc(doc(teacher,'assessmentReleases','math-ch2-test'),{released:true});await setDoc(doc(teacher,'assessmentReleases','math-ch2-test'),{released:false});await assertFails(submit());});

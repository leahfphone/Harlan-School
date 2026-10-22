// Run against a local Firestore emulator only:
// npm install --no-save firebase @firebase/rules-unit-testing
// firebase emulators:exec --only firestore "node --test tests/firestore-workflow.test.mjs"
// Requires firebase-tools installed and firestore emulator configured.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,writeBatch,serverTimestamp,updateDoc} from 'firebase/firestore';

const rules=await readFile(new URL('../firestore.universal.draft.rules',import.meta.url),'utf8');
const env=await initializeTestEnvironment({
  projectId:'harlan-rules-emulator',
  firestore:{rules,host:'127.0.0.1',port:8080}
});
after(async()=>env.cleanup());
const teacher=env.authenticatedContext('teacher-uid',{email:'lphone@jcatoday.org',email_verified:true});
const student=env.authenticatedContext('harlan-uid',{email:'student@example.test',firebase:{sign_in_provider:'password'}});
const stranger=env.authenticatedContext('other-uid',{email:'other@example.test',firebase:{sign_in_provider:'password'}});
const anonymous=env.authenticatedContext('anon-uid',{firebase:{sign_in_provider:'anonymous'}});
const tdb=teacher.firestore(),sdb=student.firestore(),odb=stranger.firestore(),adb=anonymous.firestore();
const assignmentId='math6-ch4-lesson31';
const stateId='harlan-uid_'+assignmentId;

await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'studentAccess','harlan-uid'),{active:true});
  await setDoc(doc(db,'assignments',assignmentId),{published:true,type:'classwork'});
  await setDoc(doc(db,'assignments','history-secure-test'),{published:true,type:'assessment'});
  await setDoc(doc(db,'secureAssessmentContent','history-secure-test'),{questions:['example question']});
  await setDoc(doc(db,'assessmentAnswerKeys','history-secure-test'),{answers:['private']});
  await setDoc(doc(db,'assessmentReleases','history-secure-test'),{released:false});
});
test('unreleased test content denied to student',async()=>{
  await assertFails(getDoc(doc(sdb,'secureAssessmentContent','history-secure-test')));
  await assertSucceeds(getDoc(doc(tdb,'secureAssessmentContent','history-secure-test')));
});
test('teacher-only answer key',async()=>{
  await assertFails(getDoc(doc(sdb,'assessmentAnswerKeys','history-secure-test')));
  await assertSucceeds(getDoc(doc(tdb,'assessmentAnswerKeys','history-secure-test')));
});
test('unenrolled and anonymous accounts cannot submit',async()=>{
  await assertFails(setDoc(doc(odb,'assignmentStates','other-uid_'+assignmentId),{
    studentUid:'other-uid',assignmentId,status:'submitted',currentAttempt:1,updatedAt:serverTimestamp()
  }));
  await assertFails(setDoc(doc(adb,'assignmentStates','anon-uid_'+assignmentId),{
    studentUid:'anon-uid',assignmentId,status:'submitted',currentAttempt:1,updatedAt:serverTimestamp()
  }));
});
test('first attempt must be in same atomic batch',async()=>{
  await assertFails(setDoc(doc(sdb,'assignmentStates',stateId),{
    studentUid:'harlan-uid',assignmentId,status:'submitted',currentAttempt:1,updatedAt:serverTimestamp()
  }));
  const batch=writeBatch(sdb);
  batch.set(doc(sdb,'assignmentStates',stateId),{
    studentUid:'harlan-uid',assignmentId,status:'submitted',currentAttempt:1,updatedAt:serverTimestamp()
  });
  batch.set(doc(sdb,'assignmentStates',stateId,'attempts','1'),{
    studentUid:'harlan-uid',assignmentId,attemptNumber:1,
    responses:[{number:1,question:'Example',answer:'42'}],submittedAt:serverTimestamp()
  });
  await assertSucceeds(batch.commit());
});
test('student cannot overwrite attempt or mark returned',async()=>{
  await assertFails(updateDoc(doc(sdb,'assignmentStates',stateId),{status:'returned'}));
  await assertFails(updateDoc(doc(sdb,'assignmentStates',stateId,'attempts','1'),{
    responses:[{answer:'changed'}]
  }));
  await assertFails(getDoc(doc(odb,'assignmentStates',stateId)));
});
test('teacher may return; second attempt remains separate',async()=>{
  await assertSucceeds(updateDoc(doc(tdb,'assignmentStates',stateId),{
    status:'returned',updatedAt:serverTimestamp()
  }));
  const batch=writeBatch(sdb);
  batch.update(doc(sdb,'assignmentStates',stateId),{
    studentUid:'harlan-uid',assignmentId,status:'submitted',currentAttempt:2,updatedAt:serverTimestamp()
  });
  batch.set(doc(sdb,'assignmentStates',stateId,'attempts','2'),{
    studentUid:'harlan-uid',assignmentId,attemptNumber:2,
    responses:[{number:1,question:'Example',answer:'corrected'}],submittedAt:serverTimestamp()
  });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(tdb,'assignmentStates',stateId,'attempts','1')));
});
test('released test visible but answer key remains denied',async()=>{
  await assertSucceeds(setDoc(doc(tdb,'assessmentReleases','history-secure-test'),{released:true}));
  await assertSucceeds(getDoc(doc(sdb,'secureAssessmentContent','history-secure-test')));
  await assertFails(getDoc(doc(sdb,'assessmentAnswerKeys','history-secure-test')));
});

test('teacher can record partial credit; student cannot alter feedback',async()=>{
  const feedbackRef=doc(tdb,'assignmentStates',stateId,'feedback','attempt_2');
  await assertSucceeds(setDoc(feedbackRef,{
    attemptNumber:2,score:7.5,maxScore:10,comments:'Correct method; arithmetic error.',
    graderUid:'teacher-uid',gradedAt:serverTimestamp()
  }));
  await assertSucceeds(getDoc(doc(sdb,'assignmentStates',stateId,'feedback','attempt_2')));
  await assertFails(updateDoc(doc(sdb,'assignmentStates',stateId,'feedback','attempt_2'),{score:10}));
});

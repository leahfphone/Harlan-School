import test,{after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,writeBatch,serverTimestamp,updateDoc,deleteDoc} from 'firebase/firestore';

// Execute the shipped browser helpers against the same SDK version in Node.
const helperUrls=new Map();
async function helperUrl(file){
 if(helperUrls.has(file))return helperUrls.get(file);
 let source=(await readFile(new URL('../'+file,import.meta.url),'utf8'))
   .replaceAll('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js',import.meta.resolve('firebase/firestore'));
 for(const match of [...source.matchAll(/from ['"]\.\/([^'"]+)['"]/g)])source=source.replace(match[0],"from '"+await helperUrl(match[1])+"'");
 const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');helperUrls.set(file,url);return url;
}
async function helper(file){return import(await helperUrl(file));}
const {encodeResponses,decodeResponses,validateResponses}=await helper('response-payload.js');
const {submitAssignment,submissionStatus}=await helper('assignment-submission.js');
const {gradeAssignment,returnForCorrections,loadTeacherReview}=await helper('assignment-teacher.js');
const rules=await readFile(process.env.WORKFLOW_RULES || new URL('../firestore.universal.draft.rules',import.meta.url),'utf8');
const env=await initializeTestEnvironment({projectId:'demo-harlan-rules',firestore:{rules,host:'127.0.0.1',port:8080}});
after(()=>env.cleanup());
const context=(uid,claims={})=>env.authenticatedContext(uid,{email:'student@example.test',email_verified:false,firebase:{sign_in_provider:'password'},...claims}).firestore();
const tdb=context('teacher-uid',{email:'lphone@jcatoday.org',email_verified:true});
const sdb=context('harlan-uid'),odb=context('other-uid');
const adb=context('anonuid',{firebase:{sign_in_provider:'anonymous'}});
const udb=env.unauthenticatedContext().firestore();
const aid='math6-ch4-lesson31',sid='harlan-uid_'+aid;
const sref=(db=sdb)=>doc(db,'assignmentStates',sid);
const student={auth:{currentUser:{uid:'harlan-uid',isAnonymous:false}},db:sdb,assignmentId:aid};
const teacher={auth:{currentUser:{uid:'teacher-uid',isAnonymous:false}},db:tdb,studentUid:'harlan-uid',assignmentId:aid};
const responses=[{number:1,question:'Example',answer:'42',work:'Example method'}];
const submit=(args={})=>submitAssignment({...student,responses,...args});
const grade=(args={})=>gradeAssignment({...teacher,score:7.5,maxScore:10,comments:'Partial credit',...args});
const returned=()=>returnForCorrections(teacher);
const rawAttempt=(db,uid,id=aid,n=1,extra={})=>{
  const batch=writeBatch(db),ref=doc(db,'assignmentStates',uid+'_'+id);
  batch.set(ref,{studentUid:uid,assignmentId:id,status:'submitted',currentAttempt:n,updatedAt:serverTimestamp()});
  batch.set(doc(ref,'attempts',String(n)),{studentUid:uid,assignmentId:id,attemptNumber:n,...encodeResponses(responses),submittedAt:serverTimestamp(),...extra});
  return batch.commit();
};
beforeEach(async()=>{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  for(const uid of ['harlan-uid','second-uid'])await setDoc(doc(db,'studentAccess',uid),{active:true});
  await setDoc(doc(db,'studentAccess','disabled-uid'),{active:false});
  await setDoc(doc(db,'assignments',aid),{published:true,type:'classwork',title:'Math practice',subject:'Math'});
  await setDoc(doc(db,'assignments','secure-test'),{published:true,type:'assessment',title:'Private test',subject:'History'});
  for(const id of [aid,'secure-test'])await setDoc(doc(db,'assignmentAccess',id,'students','harlan-uid'),{active:true});
  await setDoc(doc(db,'secureAssessmentContent','secure-test'),{questions:['Private question']});
  await setDoc(doc(db,'assessmentAnswerKeys','secure-test'),{answers:['Private key']});
  await setDoc(doc(db,'assessmentReleases','secure-test'),{released:false});
  await setDoc(doc(db,'protectedAssessments','history-test-1'),{questions:['Legacy question']});
 });
});
test('actual helper reads absent state and atomically submits first attempt',async()=>{
 assert.deepEqual(await submissionStatus(student),{status:'not_submitted',attempt:0});
 assert.deepEqual(await submit(),{status:'submitted',attempt:1});
 const a=(await getDoc(doc(sref(),'attempts','1'))).data();
 assert.deepEqual(decodeResponses(a).responses,validateResponses(responses));assert.ok(a.submittedAt.toMillis()>0);
});
test('atomicity: neither state alone nor orphan attempt is allowed',async()=>{
 await assertFails(setDoc(sref(),{studentUid:'harlan-uid',assignmentId:aid,status:'submitted',currentAttempt:1,updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(sref(),'attempts','1'),{studentUid:'harlan-uid',assignmentId:aid,attemptNumber:1,responses,submittedAt:serverTimestamp()}));
});
test('unenrolled, disabled, anonymous and signed-out users cannot submit',async()=>{
 for(const [db,uid] of [[odb,'other-uid'],[context('disabled-uid'),'disabled-uid'],[adb,'anonuid'],[udb,'signed-out']])await assertFails(rawAttempt(db,uid));
});
test('locked submissions and historical attempts cannot be overwritten or deleted',async()=>{
 await submit();await assert.rejects(submit(),/locked/);
 for(const status of ['returned','graded'])await assertFails(updateDoc(sref(),{status}));
 await assertFails(updateDoc(doc(sref(),'attempts','1'),{responses:[]}));
 await assertFails(deleteDoc(doc(sref(tdb),'attempts','1')));
 await assertFails(rawAttempt(sdb,'harlan-uid',aid,2));
});
test('actual partial grading, return, correction, regrade preserve original history',async()=>{
 await submit();const original=(await getDoc(doc(sref(),'attempts','1'))).data();
 assert.deepEqual(await grade(),{status:'graded',attempt:1});
 await assert.rejects(submit(),/locked/);await returned();
 assert.deepEqual(await submit({responses:[{answer:'corrected'}]}),{status:'submitted',attempt:2});
 await grade({score:9});
 const review=await loadTeacherReview(teacher);
 assert.equal(review.attempts.length,2);assert.equal(review.feedback.length,2);
 assert.equal(review.feedback[0].score,7.5);assert.equal(review.feedback[1].score,9);
 assert.deepEqual((await getDoc(doc(sref(),'attempts','1'))).data(),original);
 await assertFails(updateDoc(doc(sref(),'feedback','attempt_1'),{score:10}));
 await assertFails(updateDoc(doc(sref(tdb),'feedback','attempt_1'),{score:10}));
});
test('invalid grades and grades without a submission are rejected',async()=>{
 await assert.rejects(grade(),/submitted/);await submit();
 for(const args of [{score:NaN},{score:-1},{score:11},{maxScore:0},{score:'7'},{comments:'x'.repeat(10001)}])await assert.rejects(grade(args));
 const ref=doc(sref(tdb),'feedback','attempt_1');
 for(const extra of [{score:-1},{score:11},{score:'7'},{maxScore:0},{comments:42},{comments:'x'.repeat(10001)},{graderUid:'spoofed'},{gradedAt:new Date(0)},{attemptNumber:2},{extra:true}]){
  const batch=writeBatch(tdb);
  batch.set(ref,{attemptNumber:1,score:7.5,maxScore:10,comments:'',graderUid:'teacher-uid',gradedAt:serverTimestamp(),...extra});
  batch.update(sref(tdb),{status:'graded',updatedAt:serverTimestamp()});
  await assertFails(batch.commit());
 }
 assert.equal((await getDoc(sref())).data().status,'submitted');
});
test('teacher cannot rewrite identity or advance attempt; grading requires atomic feedback',async()=>{
 await submit();
 for(const change of [{studentUid:'other-uid'},{assignmentId:'other'},{currentAttempt:2},{status:'graded',updatedAt:serverTimestamp()}])await assertFails(updateDoc(sref(tdb),change));
 await assertSucceeds(returned());
 await assertFails(updateDoc(sref(tdb),{status:'returned',updatedAt:serverTimestamp()}));
});
test('concurrent submissions and grading yield one winner without overwrites',async()=>{
 let outcomes=await Promise.allSettled([submit(),submit()]);
 assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
 outcomes=await Promise.allSettled([grade(),grade({score:8})]);
 assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
 assert.equal((await loadTeacherReview(teacher)).feedback.length,1);
});
test('student cannot read another student state, attempts or feedback',async()=>{
 await submit();await grade();
 for(const db of [odb,context('second-uid'),adb,udb]){
  for(const path of [[],['attempts','1'],['feedback','attempt_1']])await assertFails(getDoc(path.length?doc(sref(db),...path):sref(db)));
 }
});
test('clients cannot grant enrollment or teacher privileges; unverified teacher denied',async()=>{
 for(const collection of ['teacherAccess','studentAccess'])await assertFails(setDoc(doc(sdb,collection,'harlan-uid'),{active:true}));
 const db=context('fake-teacher',{email:'lphone@jcatoday.org',email_verified:false});
 await assertFails(setDoc(doc(db,'assessmentReleases','secure-test'),{released:true}));
 await assertFails(getDoc(doc(db,'assessmentAnswerKeys','secure-test')));
});
test('protected assessment content and submissions require teacher release; keys stay private',async()=>{
 await assertFails(getDoc(doc(sdb,'secureAssessmentContent','secure-test')));
 await assertFails(rawAttempt(sdb,'harlan-uid','secure-test'));
 await assertFails(setDoc(doc(sdb,'assessmentReleases','secure-test'),{released:true}));
 await setDoc(doc(tdb,'assessmentReleases','secure-test'),{released:true});
 await assertSucceeds(getDoc(doc(sdb,'secureAssessmentContent','secure-test')));
 await assertSucceeds(rawAttempt(sdb,'harlan-uid','secure-test'));
 for(const db of [sdb,odb,adb,udb])await assertFails(getDoc(doc(db,'assessmentAnswerKeys','secure-test')));
 for(const db of [odb,adb,context('disabled-uid'),udb])await assertFails(getDoc(doc(db,'secureAssessmentContent','secure-test')));
 await assertSucceeds(getDoc(doc(tdb,'assessmentAnswerKeys','secure-test')));
});
test('unpublished and revoked assignments block first submissions and corrections',async()=>{
 await submit();await returned();
 await updateDoc(doc(tdb,'assignments',aid),{published:false});
 await assertFails(submit());
 await assertFails(rawAttempt(context('second-uid'),'second-uid'));
});
test('forged metadata, timestamps, empty responses and extra grade fields are denied',async()=>{
 for(const extra of [{responseCount:0},{responseCount:151},{responsesJson:'x'.repeat(200001)},{responsesJson:42},{score:10},{submittedAt:new Date(0)},{attemptNumber:1.5},{studentUid:'other-uid'}])await assertFails(rawAttempt(sdb,'harlan-uid',aid,1,extra));
});
const legacyData=(title,count)=>({student:'Harlan',studentUid:'anonuid',testTitle:title,submittedAt:serverTimestamp(),responses:Array(count).fill({answer:'sample'})});
test('legacy Canada Test 2 format, teacher read and immutable submission remain intact',async()=>{
 const ref=doc(adb,'submissions','anonuid');
 await assertFails(setDoc(ref,legacyData('Canada — Test 2',72)));
 await assertSucceeds(setDoc(ref,legacyData('Canada — Test 2',73)));
 await assertFails(getDoc(ref));await assertSucceeds(getDoc(doc(tdb,'submissions','anonuid')));
 await assertFails(updateDoc(ref,{student:'Changed'}));await assertFails(deleteDoc(ref));
});
test('legacy History Test 1 remains locked until released and uses original format',async()=>{
 const ref=doc(adb,'submissions','test1_anonuid');
 await assertFails(setDoc(ref,legacyData('History & Geography — Test 1',61)));
 await assertFails(getDoc(doc(adb,'protectedAssessments','history-test-1')));
 await setDoc(doc(tdb,'assessmentReleases','history-test-1'),{released:true});
 await assertSucceeds(getDoc(doc(adb,'protectedAssessments','history-test-1')));
 await assertFails(setDoc(ref,legacyData('History & Geography — Test 1',60)));
 await assertSucceeds(setDoc(ref,legacyData('History & Geography — Test 1',61)));
 await assertFails(setDoc(ref,legacyData('History & Geography — Test 1',61)));
});
test('existing Math Chapter 4 anonymous submission remains accepted',async()=>{
 await assertSucceeds(setDoc(doc(adb,'submissions','math4_31_anonuid'),legacyData('Math 6 Chapter 4 — Lesson 31',3)));
});

test('released assessment is locked again after revocation, including corrections',async()=>{
 await setDoc(doc(tdb,'assessmentReleases','secure-test'),{released:true});
 await submit({assignmentId:'secure-test'});
 await returnForCorrections({...teacher,assignmentId:'secure-test'});
 await updateDoc(doc(tdb,'assessmentReleases','secure-test'),{released:false});
 await assertFails(getDoc(doc(sdb,'secureAssessmentContent','secure-test')));
 await assertFails(submit({assignmentId:'secure-test'}));
});
test('trusted teacherAccess provisioning authorizes a second teacher',async()=>{
 await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'teacherAccess','second-teacher'),{active:true}));
 const db=context('second-teacher');await submit();
 await assertSucceeds(gradeAssignment({...teacher,db,auth:{currentUser:{uid:'second-teacher'}},score:5,maxScore:10,comments:'Second teacher'}));
});
test('returned correction requires a new attempt and the state update in one batch',async()=>{
 await submit();await returned();
 await assertFails(updateDoc(sref(),{status:'submitted',currentAttempt:2,updatedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(sref(),'attempts','2'),{studentUid:'harlan-uid',assignmentId:aid,attemptNumber:2,responses,submittedAt:serverTimestamp()}));
 await assertSucceeds(submit());
});

test('active enrollment alone cannot access an unassigned assignment or released assessment',async()=>{
 const db=context('second-uid');
 await setDoc(doc(tdb,'assessmentReleases','secure-test'),{released:true});
 for(const id of [aid,'secure-test']){
  await assertFails(getDoc(doc(db,'assignments',id)));
  await assertFails(rawAttempt(db,'second-uid',id));
 }
 await assertFails(getDoc(doc(db,'secureAssessmentContent','secure-test')));
 await assertFails(setDoc(doc(db,'assignmentAccess',aid,'students','second-uid'),{active:true}));
});
test('teacher grants and revokes assignment membership; revocation locks corrections and history',async()=>{
 const {setAssignmentAccess}=await helper('assignment-teacher.js');
 await setAssignmentAccess({...teacher,active:true});await submit();await returned();
 await setAssignmentAccess({...teacher,active:false});
 await assertFails(submit());await assertFails(getDoc(sref()));
 await assertFails(getDoc(doc(sref(),'attempts','1')));
 await setAssignmentAccess({...teacher,active:true});await assertSucceeds(submit());
});
test('public assignment metadata cannot include protected content, keys, or invalid fields',async()=>{
 const ref=doc(tdb,'assignments',aid);
 for(const extra of [{questions:['secret']},{answers:['key']},{html:'secret'},{type:'unknown'},{title:'x'.repeat(151)},{published:'yes'},{availableAt:'tomorrow'}])await assertFails(updateDoc(ref,extra));
 // Admin-created unsafe documents must also fail student reads.
 await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'assignments',aid),{answerKey:'secret'}));
 await assertFails(getDoc(doc(sdb,'assignments',aid)));await assertFails(submit());
});
test('scheduled assignments do not accept early submissions',async()=>{
 await updateDoc(doc(tdb,'assignments',aid),{availableAt:new Date(Date.now()+3600000)});
 await assertFails(submit());
});
test('new protected content cannot use the legacy released-content escape path',async()=>{
 await setDoc(doc(tdb,'protectedAssessments','new-test'),{html:'Private content'});
 await setDoc(doc(tdb,'assessmentReleases','new-test'),{released:true});
 await assertFails(getDoc(doc(adb,'protectedAssessments','new-test')));
 await assertFails(getDoc(doc(sdb,'protectedAssessments','new-test')));
});
test('response validation bounds nested work, check history, numbers and total bytes',async()=>{
 const invalid=[[],[{answer:42}],[{answer:'x'.repeat(4001)}],[{work:'x'.repeat(8001)}],[{question:'x'.repeat(2001)}],[{number:0}],[{number:1},{number:1}],[{score:10}],[{checks:Array(21).fill({})}],[{checks:[{answer:'x',correct:'yes',checkedAt:'bad'}]}],Array(150).fill({answer:'x'.repeat(4000)}).map((r,i)=>({...r,number:i+1}))];
 for(const value of invalid)await assert.rejects(submit({responses:value}));
 await assertSucceeds(submit({responses:Array.from({length:150},(_,i)=>({number:i+1,answer:'answer'}))}));
});
test('malformed direct student JSON is treated as invalid text, never trusted or rendered as HTML',async()=>{
 await rawAttempt(sdb,'harlan-uid',aid,1,{responsesJson:'<script>bad</script>'});
 const review=await loadTeacherReview(teacher);
 assert.deepEqual(review.attempts[0].responses,[]);assert.match(review.attempts[0].responseError,/invalid response/);
 await returned();await assertSucceeds(submit());
});
test('teacher dashboard lists assignments with subject and student identity',async()=>{
 await submit();const {listTeacherWork}=await helper('assignment-teacher.js');
 const rows=await listTeacherWork({db:tdb});assert.equal(rows.length,1);assert.equal(rows[0].assignment.subject,'Math');
 await assertFails(listTeacherWork({db:sdb}));
});
test('Math Chapter 5 existing page payload is supported only for valid lesson IDs and owning anonymous UID',async()=>{
 await assertFails(setDoc(doc(adb,'submissions','math5_41_anonuid'),legacyData('Math 6 Chapter 5 — Practice',3)));
 for(const [id,count] of Object.entries({'41':7,'42':3,'43':7,'44':7,'45':6,'46':8,review:3,cumulative:3}))await assertSucceeds(setDoc(doc(adb,'submissions','math5_'+id+'_anonuid'),legacyData('Math 6 Chapter 5 — Practice',count)));
 for(const id of ['40','47','unknown'])await assertFails(setDoc(doc(adb,'submissions','math5_'+id+'_anonuid'),legacyData('Math 6 Chapter 5 — Practice',3)));
 await assertFails(setDoc(doc(adb,'submissions','math5_41_someoneelse'),legacyData('Math 6 Chapter 5 — Practice',3)));
 await assertFails(setDoc(doc(sdb,'submissions','math5_41_harlan-uid'),{...legacyData('Math 6 Chapter 5 — Practice',3),studentUid:'harlan-uid'}));
});
test('Chapter 4/5 adapters use the new validated submission workflow',async()=>{
 for(const chapter of [4,5]){
  const module=await helper('math-chapter-'+chapter+'-submission-adapter.js');
  const lessonId=chapter===4?'31':'41',id=module['chapter'+chapter+'AssignmentId'](lessonId);
  if(chapter===5){
   await setDoc(doc(tdb,'assignments',id),{title:'Math 5',subject:'Math',type:'classwork',published:true});
   await setDoc(doc(tdb,'assignmentAccess',id,'students','harlan-uid'),{active:true});
  }
  await assertSucceeds(module['submitChapter'+chapter]({...student,lessonId,questions:['Example'],answers:['42'],work:['Method'],checks:[[]]}));
 }
});

test('account drafts persist across sessions, remain private and are removed atomically on submit',async()=>{
 const {saveAssignmentDraft,loadAssignmentDraft}=await helper('assignment-submission.js');
 await saveAssignmentDraft({...student,responses});
 const anotherSession={...student,db:context('harlan-uid')};
 assert.equal((await loadAssignmentDraft(anotherSession)).responses[0].answer,'42');
 await assertFails(getDoc(doc(sref(context('second-uid')),'drafts','current')));
 await submit();assert.equal(await loadAssignmentDraft(anotherSession),null);
 await assertFails(saveAssignmentDraft({...student,responses}));
 await returned();await assertSucceeds(saveAssignmentDraft({...student,responses:[{answer:'corrected draft'}]}));
});
test('draft save cannot race a submission to leave editable locked work',async()=>{
 const {saveAssignmentDraft}=await helper('assignment-submission.js');
 await Promise.allSettled([saveAssignmentDraft({...student,responses}),submit()]);
 const {loadAssignmentDraft}=await helper('assignment-submission.js');
 assert.equal(await loadAssignmentDraft(student),null);
 await assertFails(saveAssignmentDraft({...student,responses}));
});

test('stale teacher review cannot grade or return a later unseen correction attempt',async()=>{
 await submit();await returned();await submit();
 await assert.rejects(grade({expectedAttempt:1}),/Submission changed/);
 await assert.rejects(returnForCorrections({...teacher,expectedAttempt:1}),/Submission changed/);
 await assertSucceeds(grade({expectedAttempt:2}));
});

test('disabled teacher grants and anonymous teacher identities cannot access protected data',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'teacherAccess','disabled-teacher'),{active:false});
  await setDoc(doc(db,'teacherAccess','anonuid'),{active:true});
 });
 for(const db of [context('disabled-teacher'),adb]){
  await assertFails(getDoc(doc(db,'assessmentAnswerKeys','secure-test')));
  await assertFails(setDoc(doc(db,'assignmentAccess',aid,'students','harlan-uid'),{active:true}));
 }
});

test('returned work can prefill a correction without modifying its original attempt',async()=>{
 const {loadAssignmentWork}=await helper('assignment-submission.js');
 await submit();assert.equal(await loadAssignmentWork(student),null);
 await returned();const work=await loadAssignmentWork(student);
 assert.equal(work.source,'returned');assert.equal(work.responses[0].answer,'42');
 assert.equal((await getDoc(doc(sref(),'attempts','1'))).data().responseCount,1);
});

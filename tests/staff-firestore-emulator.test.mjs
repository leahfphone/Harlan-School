import test,{after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,serverTimestamp} from 'firebase/firestore';

const projectId='demo-harlan-staff';
const env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
after(async()=>env.cleanup());
const primary=env.authenticatedContext('primary',{email:'lphone@jcatoday.org',email_verified:true});
const amber=env.authenticatedContext('amber',{email:'aduncan@jcatoday.org',email_verified:true});
const science=env.authenticatedContext('science',{email:'jthompson@jcatoday.org',email_verified:true});
const life=env.authenticatedContext('life',{email:'cleiser@jcatoday.org',email_verified:true});
const stranger=env.authenticatedContext('stranger',{email:'outsider@example.org',email_verified:true});
const student=env.authenticatedContext('student',{firebase:{sign_in_provider:'anonymous'}});
const db=c=>c.firestore();
await env.withSecurityRulesDisabled(async ctx=>{
 const admin=db(ctx);
 for(const [id,email,role,subjects] of [['amber','aduncan@jcatoday.org','assistant_admin',[]],['science','jthompson@jcatoday.org','teacher',['science']],['life','cleiser@jcatoday.org','teacher',['life-skills']]])
 await setDoc(doc(admin,'staffAccess',id),{email,role,subjects,active:true});
 await setDoc(doc(admin,'classResources','science-draft'),{subject:'science',title:'Science practice',type:'assignment',content:'Explain photosynthesis'});
 await setDoc(doc(admin,'classResources','life-draft'),{subject:'life-skills',title:'Life practice',type:'assignment',content:'Explain a budget'});
 await setDoc(doc(admin,'publishedResources','science-draft'),{subject:'science',title:'Science practice',type:'assignment',content:'Explain photosynthesis'});
 await setDoc(doc(admin,'classSubmissions','science-draft_student'),{resourceId:'science-draft',subject:'science',studentUid:'student',student:'Student',responses:[{answer:'Example'}],submittedAt:new Date()});
});
test('primary and assistant can read both subjects',async()=>{
 for(const ctx of [primary,amber])for(const id of ['science-draft','life-draft'])await assertSucceeds(getDoc(doc(db(ctx),'classResources',id)));
});
test('science and life teachers are restricted by subject',async()=>{
 await assertSucceeds(getDoc(doc(db(science),'classResources','science-draft')));
 await assertFails(getDoc(doc(db(science),'classResources','life-draft')));
 await assertSucceeds(getDoc(doc(db(life),'classResources','life-draft')));
 await assertFails(getDoc(doc(db(life),'classResources','science-draft')));
});
test('students cannot read drafts, submissions or grades',async()=>{
 for(const path of ['classResources/science-draft','classSubmissions/science-draft_student','classGrades/science-draft_student'])await assertFails(getDoc(doc(db(student),path)));
 await assertSucceeds(getDoc(doc(db(student),'publishedResources','science-draft')));
});
test('outsiders cannot read staff resources',async()=>{
 await assertFails(getDoc(doc(db(stranger),'classResources','science-draft')));
 await assertFails(getDoc(doc(db(stranger),'classSubmissions','science-draft_student')));
});
test('teacher cannot grade a different subject',async()=>{
 await assertFails(setDoc(doc(db(life),'classGrades','science-draft_student'),{score:75,feedback:'No access',gradedBy:'life',gradedAt:serverTimestamp()}));
 await assertSucceeds(setDoc(doc(db(science),'classGrades','science-draft_student'),{score:90,feedback:'Good work',gradedBy:'science',gradedAt:serverTimestamp()}));
});
test('published resource subject must match source draft',async()=>{
 await assertFails(setDoc(doc(db(primary),'publishedResources','life-draft'),{subject:'science',title:'Incorrect subject',type:'assignment',content:'Incorrect'}));
});
test('anonymous student cannot impersonate another UID',async()=>{
 await assertFails(setDoc(doc(db(student),'classSubmissions','science-draft_other'),{resourceId:'science-draft',subject:'science',studentUid:'student',student:'Student',responses:[{answer:'Hi'}],submittedAt:serverTimestamp()}));
});

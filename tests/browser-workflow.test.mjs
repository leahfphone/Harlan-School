// Runs against local demo emulators only. Never seeds or opens the live app.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,relative} from 'node:path';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDocs,collection} from 'firebase/firestore';
import {chromium} from 'playwright';

const root=resolve(new URL('..',import.meta.url).pathname),project='demo-harlan-rules';
const artifacts=resolve(process.env.BROWSER_ARTIFACTS||'.runtime/browser-results');await mkdir(artifacts,{recursive:true});
const env=await initializeTestEnvironment({projectId:project,firestore:{host:'127.0.0.1',port:8080,rules:await readFile(resolve(root,'firestore.universal.draft.rules'),'utf8')}});
const server=createServer(async(req,res)=>{
 try{
  const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(relative(root,path).startsWith('..')||relative(root,path).split('/').some(p=>p.startsWith('.'))){res.writeHead(404);res.end();return;}
  const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser;const blocked=[],errors=[];
async function signup(email){
 const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'LocalTest123!',returnSecureToken:true})});
 const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data.localId;
}
async function signIn(page,email){
 await page.locator('#email').fill(email);await page.locator('#password').fill('LocalTest123!');await page.locator('#signin').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Signed in'));
}
async function text(page,id,part){await page.waitForFunction(({id,part})=>document.getElementById(id)?.textContent.includes(part),{id,part});}
async function context(){
 const ctx=await browser.newContext({viewport:{width:1100,height:900}});
 ctx.setDefaultTimeout(15000);
 await ctx.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(!['127.0.0.1','localhost','www.gstatic.com'].includes(url.hostname)){blocked.push(url.origin);return route.abort();}
  return route.continue();
 });
 ctx.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());});
 return ctx;
}
try{
 await env.clearFirestore();
 const studentUid=await signup('student@local.test'),teacherUid=await signup('teacher@local.test');
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'studentAccess',studentUid),{active:true,displayName:'Local Student'});
  await setDoc(doc(db,'teacherAccess',teacherUid),{active:true});
  for(const [id,subject] of [['math6-ch4-lesson31','Math'],['history-classwork','History']]){
   await setDoc(doc(db,'assignments',id),{title:id==='history-classwork'?'History classwork':'Math classwork',subject,type:'classwork',published:true});
   await setDoc(doc(db,'assignmentAccess',id,'students',studentUid),{active:true});
  }
  await setDoc(doc(db,'assignments','secure-browser-test'),{title:'Protected browser test',subject:'History',type:'assessment',published:true});
  await setDoc(doc(db,'assignmentAccess','secure-browser-test','students',studentUid),{active:true});
  await setDoc(doc(db,'assessmentReleases','secure-browser-test'),{released:false});
  await setDoc(doc(db,'secureAssessmentContent','secure-browser-test'),{questions:['Private fixture question']});
  await setDoc(doc(db,'assessmentAnswerKeys','secure-browser-test'),{answers:['Private fixture key']});
 });
 const executablePath=process.env.CHROME_EXECUTABLE||undefined;
 browser=await chromium.launch({headless:true,executablePath});
 const studentCtx=await context(),teacherCtx=await context();
 const student=await studentCtx.newPage(),teacher=await teacherCtx.newPage();
 await student.goto(base+'/student-assignment-preview.html');await signIn(student,'student@local.test');
 await student.locator('#load').click();await text(student,'status','Ready for work');
 await student.locator('#answer').fill('<img src=x onerror=alert(1)> 42');await student.locator('#shown').fill('Added 40 and 2.');
 await student.locator('#save').click();await text(student,'status','Draft saved to your account');
 await student.reload();await text(student,'status','Signed in');await student.locator('#load').click();await text(student,'status','Ready for work');
 assert.equal(await student.locator('#answer').inputValue(),'<img src=x onerror=alert(1)> 42');
 console.log('PASS student durable sign-in, account draft and reload');
 await student.locator('#submit').click();await text(student,'status','Submitted to teacher successfully');assert.equal(await student.locator('#answer').isDisabled(),true);
 console.log('PASS first submission locks editing');
 await teacher.goto(base+'/teacher-review-preview.html');await signIn(teacher,'teacher@local.test');
 await text(teacher,'workItems','Local Student');await teacher.locator('#workItems button').first().click();await text(teacher,'status','Assignment loaded');
 assert.equal(await teacher.locator('#attempts img').count(),0);assert.match(await teacher.locator('#attempts').innerText(),/img src=x/);
 await teacher.locator('#grade').click();await text(teacher,'status','Invalid grade');
 await teacher.locator('#score').fill('7.5');await teacher.locator('#max').fill('10');await teacher.locator('#comments').fill('Good method; partial credit.');await teacher.locator('#grade').click();await text(teacher,'status','Grade saved');await text(teacher,'attempts','7.5/10');
 console.log('PASS dashboard, safe text rendering, blank-grade rejection and partial credit');
 await teacher.locator('#return').click();await text(teacher,'status','Returned for corrections');
 await student.locator('#load').click();await text(student,'status','Ready for work');await student.locator('#answer').fill('Corrected answer');await student.locator('#shown').fill('Corrected work');await student.locator('#submit').click();await text(student,'status','Submitted to teacher successfully');
 await teacher.locator('#load').click();await text(teacher,'summary','Current attempt: 2');
 assert.equal(await teacher.locator('#score').inputValue(),'');assert.equal(await teacher.locator('#comments').inputValue(),'');
 assert.equal(await teacher.locator('#attempts article').count(),2);await text(teacher,'attempts','7.5/10');await text(teacher,'attempts','Corrected answer');
 console.log('PASS correction submission preserves both attempts and original grade');
 await teacher.emulateMedia({media:'print'});assert.equal(await teacher.locator('#grading').isVisible(),false);assert.equal(await teacher.locator('#attempts').isVisible(),true);
 await teacher.pdf({path:resolve(artifacts,'teacher-attempt-history.pdf'),format:'Letter',printBackground:true});await teacher.emulateMedia({media:'screen'});
 await teacher.screenshot({path:resolve(artifacts,'teacher-review.png'),fullPage:true});
 console.log('PASS printable attempt and feedback history');
 await teacher.locator('#uid').fill('different-student');assert.equal(await teacher.locator('#review').isVisible(),false);
 await teacher.locator('#uid').fill(studentUid);await teacher.locator('#revoke').click();await text(teacher,'status','Assignment access revoked');
 await student.locator('#load').click();await text(student,'status','Could not open assignment');assert.equal(await student.locator('#submit').isDisabled(),true);
 await teacher.locator('#grant').click();await text(teacher,'status','Assignment access granted');
 await student.locator('#assignment').fill('history-classwork');assert.equal(await student.locator('#submit').isDisabled(),true);await student.locator('#load').click();await text(student,'status','Ready for work');await student.locator('#answer').fill('History response');await student.locator('#submit').click();await text(student,'status','Submitted to teacher successfully');
 await teacher.locator('#refresh').click();await text(teacher,'workItems','History classwork');await teacher.locator('#subject').selectOption('Math');assert.equal(await teacher.locator('#workItems button').count(),1);assert.match(await teacher.locator('#workItems').innerText(),/Math classwork/);
 console.log('PASS assignment revocation, stale selection locking and subject filter');
 await student.setViewportSize({width:390,height:844});await student.screenshot({path:resolve(artifacts,'student-mobile.png'),fullPage:true});
 const overflow=await student.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false);
 console.log('PASS narrow-screen student layout');
 const legacyCtx=await context(),legacy=await legacyCtx.newPage();await legacy.goto(base+'/math-chapter-5-activity.html?lesson=41');
 await legacy.locator('#submit').click();await text(legacy,'status','Submitted successfully to teacher dashboard');
 assert.equal(await legacy.locator('#submit').isDisabled(),true);assert.equal(await legacy.getByLabel('Answer 1',{exact:true}).isDisabled(),true);await legacy.reload();await text(legacy,'status','already been submitted');
 await env.withSecurityRulesDisabled(async ctx=>{
  const submissions=await getDocs(collection(ctx.firestore(),'submissions'));
  assert.equal(submissions.size,1);assert.equal(submissions.docs[0].data().responses.length,7);
 });
 console.log('PASS existing Math Chapter 5 page submits seven lesson responses and locks duplicate delivery');
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'assignments','math6-ch5-lesson41'),{title:'Chapter 5 lesson 41',subject:'Math',type:'classwork',published:true});
  await setDoc(doc(db,'assignmentAccess','math6-ch5-lesson41','students',studentUid),{active:true});
 });
 await student.goto(base+'/math-chapter-5-activity.html?lesson=41');await student.locator('#submit').click();await text(student,'status','Submitted successfully to teacher dashboard');
 assert.equal(await student.getByLabel('Answer 1',{exact:true}).isDisabled(),true);
 await teacher.locator('#refresh').click();await teacher.locator('#subject').selectOption('Math');await text(teacher,'workItems','Chapter 5 lesson 41');
 console.log('PASS signed-in Math Chapter 5 page routes to the universal teacher grading workflow');
 await teacher.locator('#assignment').fill('math6-ch4-lesson31');await teacher.locator('#load').click();await text(teacher,'status','Assignment loaded');
 await teacher.locator('#return').click();await text(teacher,'status','Returned for corrections');
 await student.goto(base+'/math-chapter-4-activity.html?lesson=31');await student.getByLabel('Answer 1',{exact:true}).fill('Correction from actual Chapter 4 lesson');
 await student.locator('#submit').click();await text(student,'status','Submitted successfully to teacher dashboard');assert.equal(await student.getByLabel('Answer 1',{exact:true}).isDisabled(),true);
 await teacher.locator('#load').click();await text(teacher,'summary','Current attempt: 3');assert.equal(await teacher.locator('#attempts article').count(),3);
 await legacy.goto(base+'/math-chapter-4-activity.html?lesson=31');await legacy.locator('#submit').click();await text(legacy,'status','Submitted successfully to teacher dashboard');
 console.log('PASS actual Math Chapter 4 page supports durable corrections and preserves anonymous delivery');
 async function protectedRead(page,collection){
  return page.evaluate(async collection=>{
   const {db}=await import('/firebase-client.js');
   const {getDoc,doc}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
   try{return {allowed:true,data:(await getDoc(doc(db,collection,'secure-browser-test'))).data()};}
   catch(e){return {allowed:false,code:e.code};}
  },collection);
 }
 assert.equal((await protectedRead(student,'secureAssessmentContent')).allowed,false);
 await teacher.evaluate(async()=>{
  const {db}=await import('/firebase-client.js');const {setDoc,doc}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  await setDoc(doc(db,'assessmentReleases','secure-browser-test'),{released:true});
 });
 assert.deepEqual((await protectedRead(student,'secureAssessmentContent')).data.questions,['Private fixture question']);
 assert.equal((await protectedRead(student,'assessmentAnswerKeys')).allowed,false);
 await teacher.locator('#assignment').fill('secure-browser-test');await teacher.locator('#revoke').click();await text(teacher,'status','Assignment access revoked');
 assert.equal((await protectedRead(student,'secureAssessmentContent')).allowed,false);
 console.log('PASS real browser credentials enforce protected assessment release, answer-key isolation and membership revocation');
 assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);
 console.log('PASS no production network requests or browser exceptions');
}finally{
 await browser?.close();await env.cleanup();await new Promise(resolve=>server.close(resolve));
}

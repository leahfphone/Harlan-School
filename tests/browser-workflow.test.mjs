// Runs against local demo emulators only. Never seeds or opens the live app.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,relative} from 'node:path';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDocs,collection} from 'firebase/firestore';
import {chromium,webkit} from 'playwright';

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
let browser,pageCounter=0;const blocked=[],errors=[],clicks=[],transitions=[];
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
 // Keep local WebChannel connections unintercepted. The guard intercepts
 // and blocks every non-allowlisted destination.
 await ctx.route(url=>!['127.0.0.1','localhost','www.gstatic.com'].includes(url.hostname),route=>{
  blocked.push(new URL(route.request().url()).origin);return route.abort();
 });
 await ctx.addInitScript(()=>document.addEventListener('click',e=>{if(e.target.id)console.log('acceptance-click:'+e.target.id);},true));
 ctx.on('page',page=>{
  const id=++pageCounter;
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())transitions.push({id,at:Date.now(),kind:'navigation'});});
  page.on('console',m=>{if(m.text().startsWith('acceptance-click:')){clicks.push(m.text());if(/:(signin|signout)$/.test(m.text()))transitions.push({id,at:Date.now(),kind:'identity'});}});
  page.on('pageerror',e=>errors.push({id,at:Date.now(),message:e.message}));
  page.on('dialog',dialog=>dialog.accept());
 });
 return ctx;
}
try{
 await env.clearFirestore();
 const authReset=await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-harlan-rules/accounts',{method:'DELETE'});assert.ok(authReset.ok,'Local Auth emulator reset failed');
 const studentUid=await signup('student@local.test'),teacherUid=await signup('teacher@local.test'),secondUid=await signup('second@local.test');
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'studentAccess',studentUid),{active:true,displayName:'Local Student'});
  await setDoc(doc(db,'teacherAccess',teacherUid),{active:true});
  await setDoc(doc(db,'studentAccess',secondUid),{active:true,displayName:'Second Student'});
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
 const engine=process.env.BROWSER_ENGINE||'chromium';
 assert.ok(['chromium','webkit'].includes(engine),'Unsupported test engine');
 const executablePath=engine==='chromium'?(process.env.CHROME_EXECUTABLE||undefined):undefined;
 browser=await ({chromium,webkit})[engine].launch({headless:true,executablePath});
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
 if(engine==='chromium')await teacher.pdf({path:resolve(artifacts,'teacher-attempt-history.pdf'),format:'Letter',printBackground:true});
 else await teacher.screenshot({path:resolve(artifacts,'teacher-print.png'),fullPage:true});await teacher.emulateMedia({media:'screen'});
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
 // The exact Lesson 31 replacement has its own 29-exercise acceptance suite.
 // Use still-supported Chapter 5 Lesson 43 to exercise the legacy/durable bridge here.
 await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'assignments','math6-ch5-lesson43'),{title:'Math legacy bridge',subject:'Math',type:'classwork',published:true});await setDoc(doc(db,'assignmentAccess','math6-ch5-lesson43','students',studentUid),{active:true});});
 await student.goto(base+'/math-chapter-5-activity.html?lesson=43');await student.locator('#submit').click();await text(student,'status','Submitted successfully to teacher dashboard');
 await teacher.locator('#assignment').fill('math6-ch5-lesson43');await teacher.locator('#load').click();await text(teacher,'status','Assignment loaded');
 await teacher.locator('#return').click();await text(teacher,'status','Returned for corrections');
 await student.goto(base+'/math-chapter-5-activity.html?lesson=43');await student.getByLabel('Answer 1',{exact:true}).fill('Correction from actual Chapter 4 lesson');
 await student.locator('#submit').click();await text(student,'status','Submitted successfully to teacher dashboard');assert.equal(await student.getByLabel('Answer 1',{exact:true}).isDisabled(),true);
 await teacher.locator('#load').click();await text(teacher,'summary','Current attempt: 2');assert.equal(await teacher.locator('#attempts article').count(),2);
 await legacy.goto(base+'/math-chapter-5-activity.html?lesson=43');await legacy.locator('#submit').click();await text(legacy,'status','Submitted successfully to teacher dashboard');
 console.log('PASS remaining Math Chapter 5 page supports durable corrections and preserves anonymous delivery');
 // Approve the existing browser identity, then use the actual lesson with no sign-in UI.
 const existingUid=await legacy.evaluate(async()=>{const {auth}=await import('/firebase-client.js');return auth.currentUser.uid;});
 await legacy.goto(base+'/browser-setup.html');await text(legacy,'status','Browser code for your teacher');assert.equal(await legacy.locator('#code').innerText(),existingUid);assert.equal(await legacy.locator('input[type="password"]').count(),0);
 await legacy.goto(base+'/math-chapter-5-activity.html?lesson=43');await text(legacy,'status','already been submitted');
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();await setDoc(doc(db,'studentAccess',existingUid),{active:true,allowAnonymous:true,displayName:'Existing browser student'});
  await setDoc(doc(db,'assignmentAccess','math6-ch5-lesson43','students',existingUid),{active:true});
 });
 await legacy.reload();await legacy.getByLabel('Answer 1',{exact:true}).fill('First existing-browser answer');
 await legacy.locator('#save').click();await text(legacy,'status','to your account');
 await legacy.reload();assert.equal(await legacy.getByLabel('Answer 1',{exact:true}).inputValue(),'First existing-browser answer');
 await legacy.locator('#submit').click();await text(legacy,'status','Submitted successfully to teacher dashboard');
 await teacher.locator('#uid').fill(existingUid);await teacher.locator('#assignment').fill('math6-ch5-lesson43');await teacher.locator('#load').click();await text(teacher,'summary','Current attempt: 1');
 await teacher.locator('#score').fill('7.5');await teacher.locator('#max').fill('10');await teacher.locator('#comments').fill('Browser-session partial credit');await teacher.locator('#grade').click();await text(teacher,'status','Grade saved');
 await teacher.locator('#return').click();await text(teacher,'status','Returned for corrections');
 await legacy.reload();assert.equal(await legacy.getByLabel('Answer 1',{exact:true}).inputValue(),'First existing-browser answer');
 await legacy.getByLabel('Answer 1',{exact:true}).fill('Existing-browser correction');await legacy.locator('#submit').click();await text(legacy,'status','Submitted successfully to teacher dashboard');
 await teacher.locator('#load').click();await text(teacher,'summary','Current attempt: 2');assert.equal(await teacher.locator('#attempts article').count(),2);await text(teacher,'attempts','7.5/10');
 assert.equal(await legacy.evaluate(async()=>{const {auth}=await import('/firebase-client.js');return auth.currentUser.uid;}),existingUid);
 assert.equal(await legacy.locator('input[type="password"]').count(),0);
 await teacher.locator('#revoke').click();await text(teacher,'status','Assignment access revoked');
 await legacy.reload();await text(legacy,'status','Submission is unavailable');assert.equal(await legacy.locator('#submit').isDisabled(),true);
 await teacher.locator('#uid').fill(studentUid);
 console.log('PASS existing browser access needs no login and supports saved drafts, partial credit, corrections, immutable history and revocation');
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

 // A browser storage exception must not block a server write or turn its
 // acknowledgement into a false failure notice.
 const storageCtx=await context();
 await storageCtx.addInitScript(()=>{
  const nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;
  Storage.prototype.setItem=function(key,value){if(String(key).startsWith('harlan-preview-'))throw new Error('Device storage unavailable');return nativeSet.call(this,key,value);};
  Storage.prototype.removeItem=function(key){if(String(key).startsWith('harlan-preview-'))throw new Error('Device storage unavailable');return nativeRemove.call(this,key);};
 });
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'assignments','storage-test'),{title:'Storage test',subject:'Math',type:'classwork',published:true});
  await setDoc(doc(db,'assignmentAccess','storage-test','students',studentUid),{active:true});
 });
 const storagePage=await storageCtx.newPage();await storagePage.goto(base+'/student-assignment-preview.html');await signIn(storagePage,'student@local.test');await storagePage.locator('#assignment').fill('storage-test');await storagePage.locator('#load').click();await text(storagePage,'status','Ready for work');
 await storagePage.locator('#answer').fill('Server delivery despite storage failure');await storagePage.locator('#save').click();await text(storagePage,'status','Draft saved to your account');
 await storagePage.locator('#submit').click();await text(storagePage,'status','Submitted to teacher successfully');
 assert.equal(await storagePage.locator('#submit').isDisabled(),true);
 console.log('PASS device-storage errors cannot block or misreport acknowledged account saves/submissions');
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  const id='math6-ch5-lesson42';await setDoc(doc(db,'assignments',id),{title:'Account draft test',subject:'Math',type:'classwork',published:true});
  for(const uid of [studentUid,secondUid])await setDoc(doc(db,'assignmentAccess',id,'students',uid),{active:true});
 });
 await student.goto(base+'/math-chapter-5-activity.html?lesson=42');await student.getByLabel('Answer 1',{exact:true}).fill('Private student draft');await student.locator('#save').click();await text(student,'status','Progress saved to your account');
 const anotherDevice=await context(),devicePage=await anotherDevice.newPage();await devicePage.goto(base+'/student-account.html');await signIn(devicePage,'student@local.test');await devicePage.goto(base+'/math-chapter-5-activity.html?lesson=42');
 await devicePage.waitForFunction(()=>document.querySelector('[aria-label="Answer 1"]')?.value==='Private student draft');
 await student.goto(base+'/student-account.html');await student.locator('#signout').click();await text(student,'status','Student sign-in required');await signIn(student,'second@local.test');await student.goto(base+'/math-chapter-5-activity.html?lesson=42');
 await student.waitForFunction(()=>!document.querySelector('#submit').disabled);assert.equal(await student.getByLabel('Answer 1',{exact:true}).inputValue(),'');
 console.log('PASS actual math drafts resume across devices and remain isolated when accounts switch');
 await devicePage.locator('#submit').click();await text(devicePage,'status','Submitted successfully to teacher dashboard');
 await teacher.locator('#uid').fill(studentUid);await teacher.locator('#assignment').fill('math6-ch5-lesson42');await teacher.locator('#load').click();await text(teacher,'status','Assignment loaded');await teacher.locator('#return').click();await text(teacher,'status','Returned for corrections');
 await devicePage.reload();await devicePage.waitForFunction(()=>!document.querySelector('#submit').disabled);assert.equal(await devicePage.getByLabel('Answer 1',{exact:true}).inputValue(),'Private student draft');
 console.log('PASS returned math work reopens as a starting point for a new immutable attempt');
 await devicePage.locator('#status').evaluate(node=>console.log('acceptance-click:signout'));
 await devicePage.evaluate(async()=>{const {auth}=await import('/firebase-client.js');const {signOut}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');await signOut(auth);});
 await text(devicePage,'status','Sign-in changed');assert.equal(await devicePage.getByLabel('Answer 1',{exact:true}).inputValue(),'');assert.equal(await devicePage.locator('#submit').isDisabled(),true);
 console.log('PASS signing out clears private lesson fields and disables submission');
 await teacher.locator('#signout').click();await text(teacher,'status','Teacher sign-in required');assert.equal(await teacher.locator('#attempts').innerText(),'');assert.equal(await teacher.locator('#comments').inputValue(),'');
 console.log('PASS teacher sign-out removes private review data from the page');
 // WebKit emits native access-control errors for local emulator streams that
 // navigation or a sign-in change cancels. Require a matching transition and
 // exact local Firestore RPC scope; every other exception still fails the run.
 const expectedCancellation=e=>engine==='webkit'
  && /^\/?127\.0\.0\.1:8080\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel\?/.test(e.message)
  && e.message.endsWith(' due to access control checks.')
  && transitions.some(t=>t.id===e.id&&Math.abs(t.at-e.at)<1500);
 const unexpected=errors.filter(e=>!expectedCancellation(e));
 await writeFile(resolve(artifacts,'browser-events.json'),JSON.stringify({errors,transitions,unexpected},null,2));
 assert.deepEqual(blocked,[]);assert.deepEqual(unexpected,[]);
 console.log('PASS no production network requests or unexpected application exceptions');
 if(errors.length)console.log('INFO '+errors.length+' verified local stream cancellations during navigation/sign-in changes');
}catch(error){
 if(browser){
  let index=0;
  for(const ctx of browser.contexts())for(const page of ctx.pages()){
   console.error('BROWSER FAILURE',JSON.stringify({clicks,url:page.url(),status:await page.locator('#status').textContent({timeout:1000}).catch(()=>null)}));
   await page.screenshot({path:resolve(artifacts,'failure-'+(++index)+'.png'),fullPage:true}).catch(()=>{});
  }
 }
 throw error;
}finally{
 await browser?.close();await env.cleanup();await new Promise(resolve=>server.close(resolve));
}

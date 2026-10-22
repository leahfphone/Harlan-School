import {textbookLessons} from './math-textbook-content.js';
import {auth,db} from './firebase-client.js';
import {signInAnonymously,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {readBackup,writeBackup,removeBackup} from './device-backup.js';
import {studentAccessMode} from './student-access.js';
import {submitAssignment,submissionStatus,loadAssignmentWork,saveAssignmentDraft} from './assignment-submission.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const chapter=params.get('chapter')||'4',lessonId=params.get('lesson')||'31',lesson=textbookLessons[chapter+':'+lessonId];
let uid=null,allowed=false,busy=false,invalidated=false,timer,saveQueue=Promise.resolve();const fields=[];
const say=s=>{$('status').textContent=s;};
function lock(){for(const f of fields)for(const el of [f.answer,f.work])el.disabled=!allowed||busy||invalidated;$('save-top').disabled=$('save').disabled=$('submit').disabled=!allowed||busy||invalidated;}
function speak(text){if(!window.speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.82;speechSynthesis.speak(u);}
$('jump').onchange=()=>document.getElementById('exercise-'+$('jump').value)?.scrollIntoView({block:'start'});
$('save-top').onclick=()=>$('save').click();
$('stop').onclick=()=>window.speechSynthesis?.cancel();
const ns='http://www.w3.org/2000/svg';function svgEl(name,attrs={},content){const el=document.createElementNS(ns,name);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(content!==undefined)el.textContent=content;return el;}
function diagram(d){
 const svg=svgEl('svg',{viewBox:'0 0 650 260',role:'img','aria-label':d.title||'Textbook diagram'});svg.append(svgEl('title',{},d.title||'Textbook diagram'));
 const text=(x,y,s)=>svg.append(svgEl('text',{x,y,'text-anchor':'middle'},s));
 const line=(x1,y1,x2,y2)=>svg.append(svgEl('line',{x1,y1,x2,y2,stroke:'#17212b','stroke-width':2}));
 if(d.type==='venn'){
  text(325,26,d.title);svg.append(svgEl('circle',{cx:265,cy:150,r:95,fill:'#d9edf8',stroke:'#17212b','stroke-width':2}),svgEl('circle',{cx:385,cy:150,r:95,fill:'#f6efc6','fill-opacity':.65,stroke:'#17212b','stroke-width':2}));
  text(230,52,d.leftLabel);text(420,52,d.rightLabel);for(const [list,x]of[[d.left,225],[d.middle,325],[d.right,425]])list.forEach((s,i)=>text(x,105+i*32,s));
 }else if(d.type==='factorTree'){
  text(325,45,d.top);line(315,58,235,105);line(335,58,415,105);text(225,130,d.left);text(425,130,d.right);
  // Only the originally printed first split is supplied. Further factors are student work.
 }else if(d.type==='numberLine'){
  line(25,115,625,115);for(let n=d.min;n<=d.max;n++){const x=25+(n-d.min)*600/(d.max-d.min);line(x,106,x,124);text(x,153,String(n));}
 }
 return svg;
}
function responses(){return fields.map(({q,answer,work})=>({number:q.number,question:'Page '+q.page+' — '+q.direction+'\n'+q.prompt+(q.given?'\n'+q.given:'')+(q.choices?'\nChoices: '+q.choices.join('; '):''),answer:answer.value,work:work.value,checks:[]}));}
function sameUser(){return !invalidated&&auth.currentUser?.uid===uid;}
async function persist(){if(!allowed||!sameUser())throw Error('Access changed. Reload this lesson.');await saveAssignmentDraft({auth,db,assignmentId:lesson.assignmentId,responses:responses()});}
function backupKey(){return 'textbook-'+uid+'-'+lesson.assignmentId;}
function autosave(){if(sameUser())writeBackup(backupKey(),responses());clearTimeout(timer);timer=setTimeout(()=>{saveQueue=saveQueue.then(()=>persist()).catch(()=>{if(sameUser())say('Save not confirmed. Your answers are still on this page. Tap Save progress to try again.');});},800);}
async function run(){
 if(!lesson?.verified)throw Error('This textbook exercise is not ready yet.');
 $('title').textContent='Lesson '+lesson.lesson+' — '+lesson.title;$('source').textContent='Textbook pages '+lesson.pages.join('–')+' • Exercises 1–'+lesson.questions.length;
 $('back').href='math-chapter-'+chapter+'.html';$('back').textContent='← Chapter '+chapter;
 for(const q of lesson.questions){
  const card=document.createElement('section');card.className='card';card.id='exercise-'+q.number;const option=document.createElement('option');option.value=String(q.number);option.textContent=String(q.number);$('jump').append(option);const h=document.createElement('h2');h.textContent='Exercise '+q.number;
  const direction=document.createElement('p');direction.className='direction';direction.textContent=q.direction;const prompt=document.createElement('p');prompt.textContent=q.prompt;
  const page=document.createElement('p');page.className='page';page.textContent='Textbook page '+q.page;
  const read=document.createElement('button');read.type='button';read.textContent='Read exercise '+q.number;read.onclick=()=>speak(q.direction+' '+q.prompt+(q.given?' '+q.given:'')+(q.choices?' Choices: '+q.choices.join(', '):''));
  card.append(h,page,direction,prompt);
  if(q.given){const given=document.createElement('p');given.className='given';given.textContent=q.given;card.append(given);}
  if(q.choices){const list=document.createElement('ul');list.className='choices';for(const choice of q.choices){const li=document.createElement('li');li.textContent=choice;list.append(li);}card.append(list);}
  if(q.diagram){const figure=document.createElement('div');figure.className='figure';figure.append(diagram(q.diagram));card.append(figure);}
  card.append(read);
  const answer=document.createElement('textarea'),work=document.createElement('textarea');answer.id='answer-'+q.number;answer.maxLength=4000;work.id='work-'+q.number;work.maxLength=8000;
  for(const [el,label]of[[answer,'Answer '+q.number],[work,'Work for exercise '+q.number]]){const l=document.createElement('label');l.htmlFor=el.id;l.textContent=label;el.oninput=autosave;card.append(l,el);}
  if(q.drawing){const instruction=document.createElement('p');instruction.textContent='Use paper for the diagram or factor tree, and describe its parts in your work box.';card.append(instruction);}
  fields.push({q,answer,work});$('questions').append(card);
 }
 lock();await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth);uid=auth.currentUser.uid;
 onAuthStateChanged(auth,u=>{if(u?.uid!==uid){invalidated=true;allowed=false;clearTimeout(timer);for(const f of fields)f.answer.value=f.work.value='';say('Browser access changed. Reload this lesson.');lock();}});
 if(await studentAccessMode({auth,db})!=='assigned')throw Error('Your teacher needs to enable this textbook lesson for this browser.');
 const info=await submissionStatus({auth,db,assignmentId:lesson.assignmentId});allowed=['not_submitted','returned'].includes(info.status);
 if(allowed){const saved=await loadAssignmentWork({auth,db,assignmentId:lesson.assignmentId});if(!sameUser())return;const rows=saved?.responses||readBackup(backupKey())||[];for(const f of fields){const r=Array.isArray(rows)?rows.find(r=>r.number===f.q.number):null;if(r){f.answer.value=r.answer;f.work.value=r.work;}}}
 say(allowed?(info.status==='returned'?'Your teacher returned this work. Make your corrections and submit again.':'Ready for your textbook exercises.'):'This work has been submitted. Wait for your teacher to return it for corrections.');lock();
}
$('save').onclick=async()=>{if(!allowed||busy)return;busy=true;lock();clearTimeout(timer);try{await saveQueue;await persist();say('Progress saved to your account.');}catch(e){say('Save not confirmed. Your answers are still on this page. '+(e.code||e.message));}finally{busy=false;lock();}};
$('submit').onclick=async()=>{if(!allowed||busy)return;busy=true;lock();clearTimeout(timer);try{await saveQueue;if(!sameUser())throw Error('Access changed. Reload this lesson.');await submitAssignment({auth,db,assignmentId:lesson.assignmentId,responses:responses()});allowed=false;removeBackup(backupKey());say('Submitted successfully to teacher dashboard.');}catch(e){say('Delivery is not confirmed. Your answers are still on this page. '+(e.code||e.message));}finally{busy=false;lock();}};
run().catch(e=>{allowed=false;lock();say('Textbook submission is unavailable. '+(e.code||e.message));});

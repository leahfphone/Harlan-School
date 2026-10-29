import {mathNarrationText,mathNumberProblemText,isWrittenMathPrompt} from './math-narration.js';
import {diagram,diagramDescription} from './math-textbook-diagrams.js';
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
function lock(){for(const f of fields){for(const el of [f.answer,f.work])el.disabled=!allowed||busy||invalidated;for(const b of document.querySelectorAll('#exercise-'+f.q.number+' .choice-button'))b.disabled=!allowed||busy||invalidated;}$('save-top').disabled=$('save').disabled=$('submit').disabled=!allowed||busy||invalidated;}
function speak(text){if(!window.speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.82;speechSynthesis.speak(u);}
$('jump').onchange=()=>document.getElementById('exercise-'+$('jump').value)?.scrollIntoView({block:'start'});
$('save-top').onclick=()=>$('save').click();
$('stop').onclick=()=>window.speechSynthesis?.cancel();
function responses(){return fields.map(({q,answer,work})=>({number:q.number,question:'Page '+q.page+' — '+q.direction+'\n'+q.prompt+(q.given?'\n'+q.given:'')+(q.choices?'\nChoices: '+q.choices.join('; '):'')+(q.diagram?'\n'+diagramDescription(q.diagram):''),answer:answer.value,work:work.value,checks:[]}));}
function sameUser(){return !invalidated&&auth.currentUser?.uid===uid;}
async function persist(){if(!allowed||!sameUser())throw Error('Access changed. Reload this lesson.');await saveAssignmentDraft({auth,db,assignmentId:lesson.assignmentId,responses:responses()});}
function backupKey(){return 'textbook-'+uid+'-'+lesson.assignmentId;}
function autosave(){if(sameUser())writeBackup(backupKey(),responses());clearTimeout(timer);timer=setTimeout(()=>{saveQueue=saveQueue.then(()=>persist()).catch(()=>{if(sameUser())say('Save not confirmed. Your answers are still on this page. Tap Save progress to try again.');});},800);}
async function run(){
 if(!lesson?.verified)throw Error('This textbook exercise is not ready yet.');
 $('title').textContent=(/^\d+$/.test(lesson.lesson)?'Lesson '+lesson.lesson+' — ':'')+lesson.title;$('source').textContent='Textbook pages '+lesson.pages.join('–')+' • Exercises 1–'+lesson.questions.length;
 $('back').href='math-chapter-'+chapter+'.html';$('back').textContent='← Chapter '+chapter;
 for(const q of lesson.questions){
  const card=document.createElement('section');card.className='card';card.id='exercise-'+q.number;const option=document.createElement('option');option.value=String(q.number);option.textContent=String(q.number);$('jump').append(option);const h=document.createElement('h2');h.textContent='Exercise '+q.number;
  const direction=document.createElement('p');direction.className='direction';direction.textContent=q.direction;const prompt=document.createElement('p');prompt.className='math-problem';const expression=document.createElement('span');expression.textContent=q.prompt;prompt.append(expression);const numberText=mathNumberProblemText(q);if(numberText){const speaker=document.createElement('button');speaker.type='button';speaker.className='number-read';speaker.setAttribute('aria-label','Read the number problem for exercise '+q.number);speaker.title='Read this number problem';speaker.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';speaker.onclick=()=>speak(numberText);prompt.append(speaker);}
  const page=document.createElement('p');page.className='page';page.textContent='Textbook page '+q.page;
  const read=document.createElement('button');read.type='button';read.textContent=isWrittenMathPrompt(q.prompt)?'Read question':'Read directions';read.setAttribute('aria-label',read.textContent+' for exercise '+q.number);read.onclick=()=>speak(mathNarrationText(q));
  card.append(h,page,direction,prompt);
  if(q.given){const given=document.createElement('p');given.className='given';given.textContent=q.given;card.append(given);}
  if(q.choices){const list=document.createElement('div');list.className='choices selectable-choices';list.setAttribute('role','group');list.setAttribute('aria-label','Select answer choices for exercise '+q.number);const buttons=[];for(const choice of q.choices){const b=document.createElement('button');b.type='button';b.className='choice-button';b.textContent=choice;b.setAttribute('aria-pressed','false');b.onclick=()=>{if(!allowed||busy||invalidated)return;const answer=document.getElementById('answer-'+q.number);if(!answer)return;const selected=b.getAttribute('aria-pressed')!=='true';const multi=/choose two|select two|pick two|two facts|two numbers|two answers/i.test(q.direction+' '+q.prompt);if(!multi)for(const other of buttons)other.setAttribute('aria-pressed','false');b.setAttribute('aria-pressed',String(selected));const chosen=buttons.filter(x=>x.getAttribute('aria-pressed')==='true').map(x=>x.textContent);answer.value=chosen.join('; ');answer.dispatchEvent(new Event('input',{bubbles:true}));};buttons.push(b);list.append(b);}card.append(list);card.dataset.selectableChoices='true';}
  if(q.diagram){const figure=document.createElement('div');figure.className='figure';figure.append(diagram(q.diagram));card.append(figure);}
  card.append(read);
  const answer=document.createElement('textarea'),work=document.createElement('textarea');answer.id='answer-'+q.number;answer.maxLength=4000;work.id='work-'+q.number;work.maxLength=8000;
  for(const [el,label]of[[answer,'Answer '+q.number],[work,'Work for exercise '+q.number]]){const l=document.createElement('label');l.htmlFor=el.id;l.textContent=label;el.oninput=autosave;card.append(l,el);}
  if(q.drawing){const instruction=document.createElement('p');instruction.textContent='Use paper for the diagram or factor tree, and describe its parts in your work box.';card.append(instruction);}
  if(q.choices){const sync=()=>{const selected=answer.value.split(';').map(x=>x.trim()).filter(Boolean);for(const b of card.querySelectorAll('.choice-button'))b.setAttribute('aria-pressed',String(selected.includes(b.textContent)));};answer.addEventListener('input',sync);card.syncChoices=sync;}
  fields.push({q,answer,work});$('questions').append(card);
 }
 lock();await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth);uid=auth.currentUser.uid;
 onAuthStateChanged(auth,u=>{if(u?.uid!==uid){invalidated=true;allowed=false;clearTimeout(timer);for(const f of fields)f.answer.value=f.work.value='';say('Browser access changed. Reload this lesson.');lock();}});
 if(await studentAccessMode({auth,db})!=='assigned')throw Error('Your teacher needs to enable this textbook lesson for this browser.');
 const info=await submissionStatus({auth,db,assignmentId:lesson.assignmentId});allowed=['not_submitted','returned'].includes(info.status);
 if(allowed){const saved=await loadAssignmentWork({auth,db,assignmentId:lesson.assignmentId});if(!sameUser())return;const rows=saved?.responses||readBackup(backupKey())||[];for(const f of fields){const r=Array.isArray(rows)?rows.find(r=>r.number===f.q.number):null;if(r){f.answer.value=r.answer;f.work.value=r.work;f.answer.dispatchEvent(new Event('input',{bubbles:false}));}}}
 say(allowed?(info.status==='returned'?'Your teacher returned this work. Make your corrections and submit again.':'Ready for your textbook exercises.'):'This work has been submitted. Wait for your teacher to return it for corrections.');lock();
}
$('save').onclick=async()=>{if(!allowed||busy)return;busy=true;lock();clearTimeout(timer);try{await saveQueue;await persist();say('Progress saved to your account.');}catch(e){say('Save not confirmed. Your answers are still on this page. '+(e.code||e.message));}finally{busy=false;lock();}};
$('submit').onclick=async()=>{if(!allowed||busy)return;busy=true;lock();clearTimeout(timer);try{await saveQueue;if(!sameUser())throw Error('Access changed. Reload this lesson.');await submitAssignment({auth,db,assignmentId:lesson.assignmentId,responses:responses()});allowed=false;removeBackup(backupKey());say('Submitted successfully to teacher dashboard.');}catch(e){say('Delivery is not confirmed. Your answers are still on this page. '+(e.code||e.message));}finally{busy=false;lock();}};
run().catch(e=>{allowed=false;lock();say('Textbook submission is unavailable. '+(e.code||e.message));});

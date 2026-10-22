import {textbookLessons} from './math-textbook-content.js';
import {diagram} from './math-textbook-diagrams.js';
import {signInWithEmailAndPassword,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {auth,db,environmentLabel} from './firebase-client.js';
import {loadTeacherReview,gradeAssignment,returnForCorrections,listTeacherWork,setAssignmentAccess} from './assignment-teacher.js';
const $=id=>document.getElementById(id),say=s=>$('status').textContent=s;
$('environment').textContent=environmentLabel;
let loaded=null,generation=0,busy=false,rows=[],reviewedKey=null,observedIdentity=undefined;
const ref=()=>({studentUid:$('uid').value.trim(),assignmentId:$('assignment').value.trim()});
function invalidate(){generation++;loaded=null;$('review').hidden=true;}
for(const id of ['uid','assignment'])$(id).oninput=invalidate;
$('signin').onclick=async()=>{try{await signInWithEmailAndPassword(auth,$('email').value,$('password').value);$('password').value='';}catch(e){say('Sign-in failed: '+e.code);}};
$('signout').onclick=()=>signOut(auth);
onAuthStateChanged(auth,async u=>{const identity=u?u.uid+':'+u.isAnonymous:null;if(identity===observedIdentity)return;observedIdentity=identity;invalidate();reviewedKey=null;rows=[];$('attempts').replaceChildren();$('summary').textContent='';for(const id of ['score','max','comments'])$(id).value='';renderList();say(u?'Signed in: '+u.email:'Teacher sign-in required');if(u)await refresh();});
function renderList(){
 $('workItems').replaceChildren();const subject=$('subject').value,status=$('statusFilter').value;
 const matching=rows.filter(r=>(!subject||r.assignment.subject===subject)&&(!status||r.status===status));
 for(const row of matching){
  const b=document.createElement('button');b.style.display='block';b.style.margin='12px 0';
  b.textContent=row.studentName+' — '+(row.assignment.title||row.assignmentId)+' — '+row.status+' — '+(row.updatedAt?.toDate?.().toLocaleString()||'');
  b.onclick=()=>{if(busy)return;$('uid').value=row.studentUid;$('assignment').value=row.assignmentId;load();};$('workItems').append(b);
 }
 if(!matching.length)$('workItems').textContent='No matching submissions.';
}
async function refresh(){
 const uid=auth.currentUser?.uid,version=generation;
 try{
  const result=await listTeacherWork({db});if(auth.currentUser?.uid!==uid||version!==generation)return;
  rows=result;const previous=$('subject').value;$('subject').replaceChildren(new Option('All subjects',''));
  [...new Set(rows.map(r=>r.assignment.subject).filter(Boolean))].sort().forEach(s=>$('subject').add(new Option(s,s)));
  $('subject').value=previous;renderList();
 }catch(e){rows=[];renderList();say('Could not load dashboard: '+(e.code||e.message));}
}
$('refresh').onclick=refresh;$('subject').onchange=$('statusFilter').onchange=renderList;
function paragraph(parent,text){const p=document.createElement('p');p.textContent=text;parent.append(p);}
async function load(){
 invalidate();const version=generation,target=ref(),uid=auth.currentUser?.uid;
 try{
  const d=await loadTeacherReview({db,...target});if(version!==generation||auth.currentUser?.uid!==uid)return;
  const key=target.studentUid+':'+target.assignmentId+':'+d.state.currentAttempt;
  if(key!==reviewedKey){for(const id of ['score','max','comments'])$(id).value='';reviewedKey=key;}
  loaded={...target,expectedAttempt:d.state.currentAttempt};$('review').hidden=false;
  $('summary').textContent=target.studentUid+' | '+target.assignmentId+' | Status: '+d.state.status+' | Current attempt: '+d.state.currentAttempt;
  $('attempts').replaceChildren();
  for(const a of d.attempts){
   const article=document.createElement('article'),h=document.createElement('h3');h.textContent='Attempt '+a.attemptNumber;article.append(h);
   paragraph(article,'Submitted: '+(a.submittedAt?.toDate?.().toLocaleString()||'Pending'));
   if(a.responseError)paragraph(article,a.responseError);
   for(const r of a.responses){
    const item=document.createElement('div');paragraph(item,r.number+'. '+r.question);
    const unit=Object.values(textbookLessons).find(u=>u.assignmentId===target.assignmentId&&u.verified),q=unit?.questions.find(q=>q.number===r.number);
    if(q?.diagram){const figure=document.createElement('div');figure.className='textbook-figure';figure.append(diagram(q.diagram));item.append(figure);}
    paragraph(item,'Answer: '+(r.answer||'(blank)'));paragraph(item,'Work: '+(r.work||'(none)'));
    for(const c of r.checks)paragraph(item,'Student practice check: '+c.answer+' — '+(c.correct?'marked correct':'retry')+' — '+c.checkedAt);
    article.append(item);
   }
   const f=d.feedback.find(f=>f.attemptNumber===a.attemptNumber);
   if(f){paragraph(article,'Grade: '+f.score+'/'+f.maxScore+' — '+f.comments);paragraph(article,'Graded: '+(f.gradedAt?.toDate?.().toLocaleString()||'Pending'));}
   $('attempts').append(article);
  }
  $('grade').disabled=d.state.status!=='submitted';$('return').disabled=!['submitted','graded'].includes(d.state.status);
  say('Assignment loaded.');
 }catch(e){if(version===generation){invalidate();say('Could not load assignment: '+(e.code||e.message));}}
}
$('load').onclick=()=>{if(!busy)load();};
async function action(operation,message){
 if(!loaded||busy)return;const target={...loaded};busy=true;$('grade').disabled=$('return').disabled=true;
 try{await operation(target);await load();await refresh();say(message);}
 catch(e){await load();say('Action not saved: '+(e.code||e.message));}
 finally{busy=false;}
}
$('grade').onclick=()=>action(target=>gradeAssignment({auth,db,...target,score:$('score').value.trim()===''?NaN:Number($('score').value),maxScore:$('max').value.trim()===''?NaN:Number($('max').value),comments:$('comments').value}),'Grade saved.');
$('return').onclick=()=>{if(confirm('Return this assignment for corrections?'))action(target=>returnForCorrections({auth,db,...target}),'Returned for corrections.');};
for(const [button,active] of [['grant',true],['revoke',false]])$(button).onclick=async()=>{
 if(busy)return;const target=ref(),version=generation;busy=true;
 $('grant').disabled=$('revoke').disabled=true;say('Saving assignment access…');
 try{await setAssignmentAccess({db,...target,active});if(version===generation)say(active?'Assignment access granted.':'Assignment access revoked.');}
 catch(e){if(version===generation)say('Access not changed: '+(e.code||e.message));}
 finally{busy=false;$('grant').disabled=$('revoke').disabled=false;}
};

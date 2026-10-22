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
 const svg=svgEl('svg',{viewBox:'0 0 650 260',role:'img','aria-label':diagramDescription(d)||d.title||'Textbook diagram'});svg.append(svgEl('title',{},d.title||'Textbook diagram'));
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
 }else if(d.type==='modelGroup'){
  const count=d.colored.length,step=135,x0=325-(count-1)*step/2;
  d.colored.forEach((colored,index)=>{const cx=x0+index*step,cy=130;
   if(d.shape==='rect'){for(let part=0;part<d.parts;part++)svg.append(svgEl('rect',{x:cx-55+part*110/d.parts,y:100,width:110/d.parts,height:60,fill:part<colored?'#b6bee8':'white',stroke:'#17212b','stroke-width':2}));}
   else{let vs;if(d.shape==='triangle')vs=[[cx,cy-62],[cx-62,cy+55],[cx+62,cy+55]];else if(d.shape==='hexagon')vs=Array.from({length:6},(_,i)=>{const a=(i*60)*Math.PI/180;return [cx+58*Math.cos(a),cy+58*Math.sin(a)];});
    for(let part=0;part<d.parts;part++){const fill=part<colored?(d.shape==='circle'?'#efdbb9':'#b6bee8'):'white';if(vs){svg.append(svgEl('polygon',{points:[[cx,cy],vs[part],vs[(part+1)%d.parts]].map(p=>p.join(',')).join(' '),fill,stroke:'#17212b','stroke-width':2}));}else{const a=(-90+part*360/d.parts)*Math.PI/180,b=(-90+(part+1)*360/d.parts)*Math.PI/180;svg.append(svgEl('path',{d:`M ${cx} ${cy} L ${cx+58*Math.cos(a)} ${cy+58*Math.sin(a)} A 58 58 0 0 1 ${cx+58*Math.cos(b)} ${cy+58*Math.sin(b)} Z`,fill,stroke:'#17212b','stroke-width':2}));}}
   }
  });
 }else if(d.type==='pie'){
  text(180,23,d.title);let angle=d.start||-90;for(const item of d.items){const a=angle*Math.PI/180,b=(angle+item.value*3.6)*Math.PI/180;svg.append(svgEl('path',{d:`M 180 135 L ${180+92*Math.cos(a)} ${135+92*Math.sin(a)} A 92 92 0 ${item.value>50?1:0} 1 ${180+92*Math.cos(b)} ${135+92*Math.sin(b)} Z`,fill:item.color,stroke:'#17212b','stroke-width':2}));angle+=item.value*3.6;}d.items.forEach((item,i)=>{svg.append(svgEl('rect',{x:325,y:55+i*43,width:20,height:20,fill:item.color,stroke:'#17212b'}));svg.append(svgEl('text',{x:355,y:72+i*43},item.label+': '+item.value+'%'));});
 }else if(d.type==='clock'){
  svg.append(svgEl('circle',{cx:325,cy:130,r:105,fill:'white',stroke:'#17212b','stroke-width':3}),svgEl('circle',{cx:325,cy:130,r:4,fill:'#17212b'}));for(let n=1;n<=12;n++){const a=(n*30-90)*Math.PI/180;text(325+88*Math.cos(a),137+88*Math.sin(a),String(n));}
 }else if(d.type==='markedLine'){
  const steps=(d.max-d.min)*d.partsPerWhole;line(45,115,605,115);for(let i=0;i<=steps;i++){const x=55+i*540/steps;line(x,107,x,123);if(i%d.partsPerWhole===0)text(x,154,d.min+i/d.partsPerWhole);}svg.append(svgEl('circle',{cx:55+d.point*540/steps,cy:115,r:5,fill:'#007caf'}));
 }else if(d.type==='magicSquare'){
  for(let r=0;r<3;r++)for(let c=0;c<3;c++)svg.append(svgEl('rect',{x:220+c*70,y:25+r*70,width:70,height:70,fill:'#e1f1fa',stroke:'#17212b','stroke-width':2}));text(325,137,d.center);
 }else if(d.type==='trianglePuzzle'){
  line(325,30,180,220);line(180,220,470,220);line(470,220,325,30);for(const [x,y]of [[325,30],[252.5,125],[397.5,125],[180,220],[325,220],[470,220]])svg.append(svgEl('circle',{cx:x,cy:y,r:24,fill:'white',stroke:'#17212b','stroke-width':2}));
 }else if(d.type==='train'){
  svg.setAttribute('viewBox','0 0 650 390');d.cars.forEach((car,i)=>{const x=25+(i%3)*210,y=30+Math.floor(i/3)*190;svg.append(svgEl('rect',{x,y,width:175,height:65,rx:i===3?20:3,fill:['#b34b4b','#efe4cb','#37804a','#666','#1675a4','#888'][i],stroke:'#17212b','stroke-width':2}));for(const cx of[x+28,x+147])svg.append(svgEl('circle',{cx,cy:y+73,r:12,fill:'#333'}));text(x+87,y+115,car.label);text(x+87,y+145,car.length);});
 }else if(d.type==='modelChoices'){
  svg.setAttribute('viewBox','0 0 650 320');d.models.forEach((parts,i)=>{const x=65+(i%2)*315,y=25+Math.floor(i/2)*160,w=240;svg.append(svgEl('rect',{x,y,width:w,height:45,fill:'#d9edf8',stroke:'#17212b','stroke-width':2}));text(x-23,y+31,String.fromCharCode(65+i)+'.');text(x+w/2,y+30,d.whole);let offset=0;const sum=parts.reduce((n,p)=>n+p,0);parts.forEach(p=>{const width=w*p/sum;svg.append(svgEl('rect',{x:x+offset,y:y+45,width,height:45,fill:'white',stroke:'#17212b','stroke-width':2}));text(x+offset+width/2,y+75,p);offset+=width;});});
 }else if(d.type==='barGraph'){
  svg.setAttribute('viewBox','0 0 650 360');text(340,23,d.title);const y=v=>280-(v-44)*230/56;for(const tick of d.ticks){line(70,y(tick),620,y(tick));text(43,y(tick)+6,tick);}line(70,40,70,305);line(70,305,620,305);text(43,310,'0');svg.append(svgEl('path',{d:'M 63 294 l 14 -5 l -14 -5',fill:'none',stroke:'#17212b','stroke-width':2}));d.items.forEach((item,i)=>{const x=98+i*103;svg.append(svgEl('rect',{x,y:y(item.value),width:35,height:280-y(item.value),fill:'#1675a4'}));text(x+17,326,item.label);});text(340,355,d.xLabel);svg.append(svgEl('text',{x:17,y:180,transform:'rotate(-90 17 180)','text-anchor':'middle'},d.yLabel));
 }else if(d.type==='horizontalBars'){
  svg.setAttribute('viewBox','0 0 800 390');text(475,24,d.title);const x=v=>270+v*500/d.max;for(const tick of d.ticks){line(x(tick),45,x(tick),325);svg.append(svgEl('text',{x:x(tick),y:350,'text-anchor':'middle',style:'font-size:14px'},tick.toLocaleString('en-US')));}line(270,45,270,325);line(270,325,770,325);d.items.forEach((item,i)=>{const y=65+i*52;svg.append(svgEl('text',{x:255,y:y+19,'text-anchor':'end',style:'font-size:17px'},item.label));svg.append(svgEl('rect',{x:270,y,width:x(item.value)-270,height:24,fill:'#1675a4'}));});text(510,382,d.xLabel);svg.append(svgEl('text',{x:20,y:180,transform:'rotate(-90 20 180)','text-anchor':'middle'},d.yLabel));
 }else if(d.type==='barModel'){
  svg.append(svgEl('rect',{x:85,y:60,width:480,height:60,fill:'#d9edf8',stroke:'#17212b','stroke-width':2}));text(325,98,d.whole);d.parts.forEach((part,i)=>{const w=480/d.parts.length;svg.append(svgEl('rect',{x:85+i*w,y:120,width:w,height:60,fill:'white',stroke:'#17212b','stroke-width':2}));text(85+(i+.5)*w,158,part);});
 }else if(d.type==='grid'){
  const cell=Math.min(44,200/d.rows),x0=325-d.cols*cell/2,y0=30;for(let r=0;r<d.rows;r++)for(let c=0;c<d.cols;c++)svg.append(svgEl('rect',{x:x0+c*cell,y:y0+r*cell,width:cell,height:cell,fill:d.shaded.includes(r*d.cols+c)?'#b6bee8':'white',stroke:'#17212b','stroke-width':2}));
 }else if(d.type==='circles'||d.type==='triangleSet'){
  const step=75,x0=325-(d.cols-1)*step/2;for(let r=0;r<d.rows;r++)for(let c=0;c<d.cols;c++){const x=x0+c*step,y=90+r*70,fill=d.shaded.includes(r*d.cols+c)?(d.color||'#b6bee8'):'white';svg.append(d.type==='circles'?svgEl('circle',{cx:x,cy:y,r:23,fill,stroke:'#17212b','stroke-width':2}):svgEl('polygon',{points:`${x},${y-25} ${x-28},${y+24} ${x+28},${y+24}`,fill,stroke:'#17212b','stroke-width':2}));}
 }else if(d.type==='sectors'){
  let vertices;if(d.shape==='triangle'){vertices=[[325,40],[220,220],[430,220]];const center=[325,160],edge=[];for(let i=0;i<3;i++){const a=vertices[i],b=vertices[(i+1)%3];edge.push(a,[(a[0]+b[0])/2,(a[1]+b[1])/2]);}vertices=edge;vertices.forEach((a,i)=>{const b=vertices[(i+1)%6];svg.append(svgEl('polygon',{points:[center,a,b].map(p=>p.join(',')).join(' '),fill:d.shaded.includes(i)?'#b6bee8':'white',stroke:'#17212b','stroke-width':2}));});}
  else{vertices=Array.from({length:d.parts},(_,i)=>{const a=(-112.5+i*360/d.parts)*Math.PI/180;return [325+95*Math.cos(a),130+95*Math.sin(a)];});vertices.forEach((a,i)=>svg.append(svgEl('polygon',{points:[[325,130],a,vertices[(i+1)%d.parts]].map(p=>p.join(',')).join(' '),fill:d.shaded.includes(i)?'#a8d5d8':'white',stroke:'#17212b','stroke-width':2})));}
 }else if(d.type==='fractionLine'){
  line(60,115,590,115);for(let i=0;i<=d.parts;i++){const x=75+i*500/d.parts;line(x,106,x,124);if(d.labels?.[i]||(d.points||[]).includes(i))svg.append(svgEl('circle',{cx:x,cy:115,r:5,fill:'#007caf'}));if(d.labels?.[i])text(x,155,d.labels[i]);}text(75,88,'0');text(575,88,'1');if(d.endpointFractions){text(75,170,'0/'+d.parts);text(575,170,d.parts+'/'+d.parts);}
 }else if(d.type==='figureSet'){
  const rows=[['ot','ot','ot'],['pr','pt','pt'],['pt','or','pt']];rows.forEach((row,r)=>row.forEach((shape,c)=>{const x=225+c*100,y=45+r*78,fill=shape[0]==='o'?'#eea26d':'#b5a0dc';svg.append(shape[1]==='r'?svgEl('rect',{x:x-37,y:y-23,width:74,height:46,fill,stroke:'#17212b','stroke-width':2}):svgEl('polygon',{points:`${x},${y-30} ${x-34},${y+28} ${x+34},${y+28}`,fill,stroke:'#17212b','stroke-width':2}));}));
 }else if(d.type==='solidRectangle'){
  svg.append(svgEl('rect',{x:170,y:90,width:d.width||160,height:42,fill:'#2176a6',stroke:'#17212b','stroke-width':2}));
 }else if(d.type==='counters'){
  const x0=325-(d.count-1)*57/2;for(let i=0;i<d.count;i++){svg.append(svgEl('circle',{cx:x0+i*57,cy:120,r:22,fill:d.sign==='+'?'#17212b':'#a32327',stroke:'#17212b','stroke-width':2}));svg.append(svgEl('text',{x:x0+i*57,y:127,'text-anchor':'middle',style:'fill:white'},d.sign));}
 }
 return svg;
}
function diagramDescription(d){
 if(!d)return '';
 if(d.type==='markedLine')return `Number line from ${d.min} to ${d.max}, each whole divided into ${d.partsPerWhole} equal intervals. A point is marked ${d.point} intervals after ${d.min}.`;
 if(d.type==='magicSquare')return 'A three-by-three square. Only the center cell is given: '+d.center+'. All other cells are empty.';
 if(d.type==='trianglePuzzle')return 'A triangle with empty circles at the three vertices and the midpoint of each side: six circles in total.';
 if(d.type==='train')return 'Train cars, in order: '+d.cars.map(c=>c.label+', '+c.length).join('; ')+'.';
 if(d.type==='modelChoices')return d.models.map((parts,i)=>String.fromCharCode(65+i)+': whole '+d.whole+'; parts '+parts.join(', ')).join('. ')+'.';
 if(d.type==='barGraph'||d.type==='horizontalBars')return d.title+'. Axes: '+d.xLabel+'; '+d.yLabel+'. Tick marks: '+d.ticks.join(', ')+'. Bar endpoints are approximately '+d.items.map(i=>i.label+' '+i.value).join('; ')+'.';
if(d.type==='barModel')return `Bar model: whole ${d.whole}; equal parts labeled ${d.parts.join(', ')}.`;if(d.type==='grid')return `Rectangle with ${d.rows} row(s) and ${d.cols} columns; ${d.shaded.length} cells colored.`;
 if(d.type==='circles'||d.type==='triangleSet')return `${d.rows} row(s) of ${d.cols} ${d.type==='circles'?'circles':'triangles'}; ${d.shaded.length} colored.`;
 if(d.type==='sectors')return `${d.shape} divided into ${d.parts} equal parts; ${d.shaded.length} colored.`;
 if(d.type==='fractionLine')return `Number line from 0 to 1 with ${d.parts} equal intervals. `+Object.entries(d.labels||{}).map(([i,label])=>`Point ${label} is ${i} intervals after 0.`).join(' ')+(d.points||[]).map(i=>`The marked point is ${i} intervals after 0.`).join(' ');
 if(d.type==='figureSet')return 'Nine figures in three rows. Top: orange triangle, orange triangle, orange triangle. Middle: purple rectangle, purple triangle, purple triangle. Bottom: purple triangle, orange rectangle, purple triangle.';
 if(d.type==='modelGroup')return `${d.colored.length} ${d.shape} models, each divided into ${d.parts} equal parts. Colored parts, left to right: ${d.colored.join(', ')}.`;
 if(d.type==='solidRectangle')return 'One blue rectangle.';if(d.type==='counters')return `${d.count} counters, each marked ${d.sign}.`;if(d.type==='pie')return d.title+': '+d.items.map(x=>x.label+' '+x.value+'%').join(', ')+'.';if(d.type==='clock')return 'A clock face numbered 1 through 12, with no hands or shading.';
 if(d.type==='factorTree')return `${d.top} splits into ${d.left} and ${d.right}. Complete the factor tree.`;
 if(d.type==='numberLine')return `Number line from ${d.min} to ${d.max}, marked at every integer.`;
 if(d.type==='venn')return `Venn diagram ${d.leftLabel} and ${d.rightLabel}. Left only: ${d.left.join(', ')}. Shared: ${d.middle.join(', ')}. Right only: ${d.right.join(', ')}.`;
 return '';
}
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
  const direction=document.createElement('p');direction.className='direction';direction.textContent=q.direction;const prompt=document.createElement('p');prompt.textContent=q.prompt;
  const page=document.createElement('p');page.className='page';page.textContent='Textbook page '+q.page;
  const read=document.createElement('button');read.type='button';read.textContent='Read exercise '+q.number;read.onclick=()=>speak(q.direction+' '+q.prompt+(q.given?' '+q.given:'')+(q.choices?' Choices: '+q.choices.join(', '):'')+' '+diagramDescription(q.diagram));
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

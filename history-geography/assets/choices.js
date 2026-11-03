/* Accessible choice controls. No correct answers or grading keys are included. */
(()=>{
 'use strict';
 const api={};let serial=0;
 api.parse=raw=>{if(typeof raw!=='string')throw Error('A question must be text.');const parts=raw.split('|').map(x=>x.trim());if(parts.length<4||parts.length>5||parts.some(x=>!x)||new Set(parts.slice(1)).size!==parts.length-1||raw.length>2000)throw Error('Each question needs a prompt and three or four different choices, separated by |.');return {prompt:parts[0],choices:parts.slice(1)}};
 api.validate=qs=>{if(!Array.isArray(qs)||!qs.length||qs.length>100)throw Error('Enter 1–100 choice questions.');qs.forEach(api.parse);return qs};
 api.fields=root=>[...(root||document).querySelectorAll('[data-answer-field]')];
 api.question=f=>f.dataset.question;
 api.sync=f=>{const group=document.getElementById(f.dataset.group);if(!group)return;group.querySelectorAll('input[type=radio]').forEach(r=>{r.checked=r.value===f.value;r.disabled=f.disabled;r.closest('label').classList.toggle('selected',r.checked)});group.querySelectorAll('button').forEach(b=>b.disabled=f.disabled);group.classList.toggle('locked',f.disabled)};
 api.lock=(f,disabled)=>{f.disabled=disabled;api.sync(f)};
 api.set=(f,value)=>{const choices=JSON.parse(f.dataset.choices);f.value=choices.includes(value)?value:'';api.sync(f)};
 api.complete=(fields,status)=>{const missing=fields.find(f=>!f.value);if(!missing)return true;if(status)status.textContent='Choose an answer for each question before submitting. You can save an unfinished draft.';document.getElementById(missing.dataset.group)?.querySelector('input[type=radio]')?.focus();return false};
 api.create=(parent,id,prompt,choices,number)=>{
  if(!Array.isArray(choices)||choices.length<3||choices.length>4||new Set(choices).size!==choices.length)throw Error('Invalid answer choices.');
  const group=document.createElement('fieldset');group.className='choice-question';group.id='choice-'+id+'-'+(++serial);const legend=document.createElement('legend');legend.textContent=(number?number+'. ':'')+prompt;group.append(legend);
  const read=document.createElement('button');read.type='button';read.className='choice-read';read.textContent='Read question and choices';read.onclick=()=>{if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){read.textContent='Read-aloud unavailable';return}speechSynthesis.cancel();document.querySelectorAll('.choice-speaking').forEach(x=>x.classList.remove('choice-speaking'));group.classList.add('choice-speaking');const u=new SpeechSynthesisUtterance(legend.textContent+'. '+choices.map((x,i)=>String.fromCharCode(65+i)+'. '+x).join('. '));u.rate=.85;u.onend=u.onerror=()=>group.classList.remove('choice-speaking');speechSynthesis.speak(u)};group.append(read);
  const f=document.createElement('input');f.type='hidden';f.id=id;f.dataset.answerField='';f.dataset.group=group.id;f.dataset.choices=JSON.stringify(choices);f.dataset.question=prompt+'\n'+choices.map((x,i)=>String.fromCharCode(65+i)+'. '+x).join('\n');group.append(f);
  choices.forEach((text,i)=>{const label=document.createElement('label');label.className='choice-option';const r=document.createElement('input');r.type='radio';r.name=group.id;r.value=text;r.id=group.id+'-'+i;label.htmlFor=r.id;const span=document.createElement('span');span.textContent=String.fromCharCode(65+i)+'. '+text;label.append(r,span);group.append(label);r.onchange=()=>{f.value=r.value;api.sync(f);f.dispatchEvent(new Event('input',{bubbles:true}))}});
  f.addEventListener('input',()=>api.sync(f));parent.append(group);return f;
 };
 window.HarlanChoices=api;
 const data=document.getElementById('choice-bank');if(!data)return;
 let bank;try{bank=JSON.parse(data.textContent)}catch{return}
 const fields=[];let n=0;for(const slot of document.querySelectorAll('[data-choice-slot]'))for(const q of bank[slot.dataset.choiceSlot]||[])fields.push(api.create(slot,q.id,q.prompt,q.choices,++n));
 const main=document.querySelector('main'),progress=document.createElement('p');progress.className='choice-progress';progress.setAttribute('role','status');const jump=document.createElement('button');jump.type='button';jump.textContent='Go to next unanswered question';jump.onclick=()=>{const f=fields.find(x=>!x.value);if(f)document.getElementById(f.dataset.group).querySelector('input[type=radio]').focus();else progress.textContent='All '+fields.length+' questions answered.'};const first=document.querySelector('[data-choice-slot]');first?.before(progress,jump);
 const slug=location.pathname.split('/').pop(),key='harlan-history-mc-v1:'+slug;
 const update=()=>{progress.textContent=fields.filter(f=>f.value).length+' of '+fields.length+' answered.'};
 if(!window.HARLAN_HISTORY_CONFIG?.enabled){try{const saved=JSON.parse(localStorage.getItem(key)||'{}');fields.forEach(f=>api.set(f,saved[f.id]||''))}catch{}fields.forEach(f=>f.addEventListener('input',()=>{try{localStorage.setItem(key,JSON.stringify(Object.fromEntries(fields.map(x=>[x.id,x.value]))))}catch{progress.textContent='Device saving unavailable. Download a backup before leaving.';return}update()}))}
 else fields.forEach(f=>api.lock(f,true));
 fields.forEach(f=>f.addEventListener('input',update));update();
 for(const id of ['print','print-all'])document.getElementById(id)?.addEventListener('click',()=>window.print());
 document.getElementById('stop')?.addEventListener('click',()=>{window.speechSynthesis?.cancel();document.querySelectorAll('.choice-speaking').forEach(x=>x.classList.remove('choice-speaking'))});
 document.getElementById('export')?.addEventListener('click',()=>{const content=document.title+'\n\n'+fields.map((f,i)=>(i+1)+'. '+f.dataset.question+'\nSelected: '+(f.value||'(unanswered)')).join('\n\n');const u=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=slug.replace('.html','')+'-choices.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)});
 window.addEventListener('pagehide',()=>window.speechSynthesis?.cancel());
})();

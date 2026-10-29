// Teacher-only answer checking. Never import this file or answer-key data into student pages.
// Accept only explicitly versioned, complete keys. Do not treat student-supplied checks as grades.
export function validateTeacherKey(data){
 if(!data||data.schemaVersion!=='teacher-key-v1'||!Array.isArray(data.questions))return null;
 const seen=new Set(),out=[];
 for(const item of data.questions){
  if(!item||!Number.isInteger(item.number)||item.number<1||item.number>150||seen.has(item.number))return null;
  seen.add(item.number);
  const type=item.type;
  if(!['exact','multiple-choice','manual'].includes(type))return null;
  if(type!=='manual'&&(typeof item.correctAnswer!=='string'||!item.correctAnswer.trim()))return null;
  out.push({number:item.number,type,correctAnswer:type==='manual'?null:item.correctAnswer,acceptedAnswers:type==='manual'?[]:(Array.isArray(item.acceptedAnswers)&&item.acceptedAnswers.every(x=>typeof x==='string'&&x.trim())?item.acceptedAnswers:[])});
 }
 return out.length?out:null;
}
const norm=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
export function checkTeacherAnswer(question,key){
 const entry=key?.find(item=>item.number===question.number);
 if(!entry)return {status:'not-checked'};
 if(entry.type==='manual')return {status:'teacher-review'};
 const answers=[entry.correctAnswer,...entry.acceptedAnswers];
 const submitted=norm(question.answer);
 let correct=answers.some(a=>norm(a)===submitted);
 // Legacy matching answers store the selected letter plus its displayed label
 // (e.g. "H — Winnipeg"). Compare the selected letter, not the label.
 if(!correct && /^[a-z]$/i.test(entry.correctAnswer.trim())){
   const match=String(question.answer??'').trim().match(/^([a-z])\\s*[-–—:]\\s*\\S.+$/i);
   if(match)correct=answers.some(a=>norm(a)===norm(match[1]));
 }
 // Ambiguous near-matches in historical free-response work must be reviewed
 // by a teacher, rather than being automatically marked wrong or right.
 if(!correct && submitted && entry.type==='exact' && !/^[a-z]$/i.test(entry.correctAnswer.trim())){
   const simplified=s=>norm(s).replace(/[^a-z0-9 ]/g,'').replace(/\\b(the|of|and)\\b/g,' ').replace(/\\s+/g,' ').trim();
   const reduced=s=>simplified(s).replace(/^(lake|mount|mt|bay|river) /,'').trim();
   if(answers.some(a=>reduced(a)===reduced(question.answer)))return {status:'teacher-review',correctAnswer:entry.correctAnswer};
 }
 return {status:correct?'correct':'incorrect',correctAnswer:correct?null:entry.correctAnswer};
}

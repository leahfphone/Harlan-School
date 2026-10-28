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
const norm=value=>String(value??'').normalize('NFKC').trim().replace(/\\s+/g,' ').toLocaleLowerCase('en');
export function checkTeacherAnswer(question,key){
 const entry=key?.find(item=>item.number===question.number);
 if(!entry)return {status:'not-checked'};
 if(entry.type==='manual')return {status:'teacher-review'};
 const answers=[entry.correctAnswer,...entry.acceptedAnswers];
 const correct=answers.some(a=>norm(a)===norm(question.answer));
 return {status:correct?'correct':'incorrect',correctAnswer:correct?null:entry.correctAnswer};
}

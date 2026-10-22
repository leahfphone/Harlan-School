// Student work is untrusted text, never authoritative grading data.
export const MAX_PAYLOAD_BYTES=200000;
const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const allowed=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
function text(value,max,name){
 if(typeof value!=='string'||value.length>max)throw new Error('Invalid '+name);
 return value;
}
export function validateResponses(responses){
 if(!Array.isArray(responses)||responses.length<1||responses.length>150)throw new Error('Submission must contain 1–150 responses');
 const numbers=new Set();
 return responses.map((r,i)=>{
  if(!allowed(r,['number','question','answer','work','checks']))throw new Error('Invalid response fields');
  const number=r.number??i+1;
  if(!Number.isInteger(number)||number<1||number>150||numbers.has(number))throw new Error('Invalid response number');
  numbers.add(number);
  const checks=r.checks??[];
  if(!Array.isArray(checks)||checks.length>20)throw new Error('Too many work checks');
  return {number,question:text(r.question??'',2000,'question'),answer:text(r.answer??'',4000,'answer'),work:text(r.work??'',8000,'work'),checks:checks.map(c=>{
   if(!allowed(c,['answer','correct','checkedAt'])||typeof c.correct!=='boolean')throw new Error('Invalid work check');
   const checkedAt=text(c.checkedAt,30,'check time');
   if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(checkedAt)||!Number.isFinite(Date.parse(checkedAt)))throw new Error('Invalid check time');
   return {answer:text(c.answer,4000,'checked answer'),correct:c.correct,checkedAt};
  })};
 });
}
export function encodeResponses(responses){
 const normalized=validateResponses(responses),responsesJson=JSON.stringify(normalized);
 if(new TextEncoder().encode(responsesJson).length>MAX_PAYLOAD_BYTES)throw new Error('Submission is too large');
 return {responseFormat:'json-v1',responseCount:normalized.length,responsesJson};
}
export function decodeResponses(attempt){
 try{
  // Previous development attempts remain readable; new writes use json-v1.
  if(attempt.responseFormat!=='json-v1')return {responses:validateResponses(attempt.responses),responseError:null};
  if(typeof attempt.responsesJson!=='string'||new TextEncoder().encode(attempt.responsesJson).length>MAX_PAYLOAD_BYTES)throw new Error('Invalid response payload');
  const responses=validateResponses(JSON.parse(attempt.responsesJson));
  if(responses.length!==attempt.responseCount)throw new Error('Response count mismatch');
  return {responses,responseError:null};
 }catch{
  return {responses:[],responseError:'This attempt has an invalid response format. Return it for corrections; its original record is preserved.'};
 }
}

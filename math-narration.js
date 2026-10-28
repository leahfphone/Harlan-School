// Math problem narration reads directions and written questions, not the drawing
// or a calculation's printed operands. The picture/diagram keeps its alt text.
export function isWrittenMathPrompt(value=''){
 const text=String(value).trim();if(!text)return false;
 const words=text.replace(/\b(?:GCF|LCM|LCD|HCF|LHS|RHS)\b/g,' ')
  .replace(/\b(?:mm|cm|dm|km|m|ml|cl|dl|l|mg|kg|g|lb|lbs|oz|ft|in|yd|mi|gal|pt|qt|c|tsp|tbsp|sq|cu|hr|hrs|min|sec)\b/gi,' ')
  .replace(/\b[IVXLCDM]+\b/g,' ').replace(/\b[a-z]\b/gi,' ')
  .replace(/\b(?:of|and|by|to)\b/gi,' ');
 return /[A-Za-z]{2,}/.test(words);
}
function spokenGiven(value=''){
 const text=String(value).trim();if(!isWrittenMathPrompt(text))return '';
 // Numeric tables, coordinate lists and figure/cancellation labels stay visual.
 if(text.includes('|')||/^(?:Table\s*\d|Line\s*\d|Cancellation boxes)/i.test(text))return '';
 if(text.includes('\n')&&!/^(?:Remember|Strategy|Using|Renaming|Cross Multiplying)\b/i.test(text))return '';
 if(/^(?:Remember|Strategy|Using|Renaming|Cross Multiplying)\b/i.test(text))return text;
 return text.split(/\s+/).length>=6&&/[.!?]/.test(text)?text:'';
}
export function mathNarrationText(question){
 const direction=String(question.direction||'').trim();
 const given=spokenGiven(question.given);
 const prompt=isWrittenMathPrompt(question.prompt)?String(question.prompt).trim():'';
 return [direction,given,prompt].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
}
export function mathNumberProblemText(question){
 const prompt=String(question.prompt||'').trim();
 if(!prompt||isWrittenMathPrompt(prompt)||!/[0-9⁰¹²³⁴⁵⁶⁷⁸⁹×÷=+_\/]/.test(prompt))return '';
 return prompt.replace(/\(/g,', open parenthesis, ').replace(/\)/g,', close parenthesis, ').replace(/_{2,}/g,' blank ').replace(/\s+/g,' ').trim();
}

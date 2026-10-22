// Development-only Chapter 5 bridge. Do not deploy before emulator tests.
import {submissionStatus,submitAssignment} from './assignment-submission.js';

export function chapter5AssignmentId(lessonId) {
  const id=String(lessonId);
  if(!/^(4[1-6]|review|cumulative)$/.test(id)) {
    throw new Error('Unknown Chapter 5 lesson');
  }
  return 'math6-ch5-'+(/^[0-9]+$/.test(id)?'lesson'+id:id);
}
export async function chapter5Status({auth,db,lessonId}) {
  return submissionStatus({auth,db,assignmentId:chapter5AssignmentId(lessonId)});
}
export async function submitChapter5({auth,db,lessonId,questions,answers,work,checks}) {
  if(!Array.isArray(questions)||!Array.isArray(answers)||questions.length!==answers.length) {
    throw new Error('Chapter 5 questions and answers do not match');
  }
  return submitAssignment({
    auth,db,assignmentId:chapter5AssignmentId(lessonId),
    responses:questions.map((question,i)=>({
      number:i+1,question:String(question),answer:String(answers[i]??''),
      work:String(work?.[i]??''),checks:Array.isArray(checks?.[i])?checks[i]:[]
    }))
  });
}

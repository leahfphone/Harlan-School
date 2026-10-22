// Development-only bridge for Math 6 Chapter 4 lessons.
// The published Chapter 4 page is unchanged. This adapter can be wired in
// after Firebase emulator tests, student enrollment and assignment provisioning.
import {submissionStatus,submitAssignment} from './assignment-submission.js';

export function chapter4AssignmentId(lessonId) {
  if (!/^(3[1-8]|review|cumulative)$/.test(String(lessonId))) {
    throw new Error('Unknown Chapter 4 lesson');
  }
  return 'math6-ch4-'+(/^[0-9]+$/.test(lessonId)?'lesson'+lessonId:lessonId);
}

export async function chapter4Status({auth,db,lessonId}) {
  return submissionStatus({auth,db,assignmentId:chapter4AssignmentId(lessonId)});
}

export async function submitChapter4({auth,db,lessonId,questions,answers,work,checks}) {
  if (!Array.isArray(questions)||!Array.isArray(answers)||questions.length!==answers.length) {
    throw new Error('Chapter 4 questions and answers do not match');
  }
  const responses=questions.map((question,i)=>({
    number:i+1,question:String(question),
    answer:String(answers[i]??''),
    work:String(work?.[i]??''),
    checks:Array.isArray(checks?.[i])?checks[i]:[]
  }));
  return submitAssignment({
    auth,db,assignmentId:chapter4AssignmentId(lessonId),responses
  });
}

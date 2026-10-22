// Development branch only. Requires deployed Firestore authorization rules.
import {
  doc, getDoc, getDocs, collection, query, orderBy,
  runTransaction, serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import {decodeResponses} from './response-payload.js';

function stateRef(db,studentUid,assignmentId) {
  if(typeof studentUid!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(studentUid)
    || typeof assignmentId!=='string' || !/^[A-Za-z0-9_-]{1,90}$/.test(assignmentId)) {
    throw new Error('Invalid assignment reference');
  }
  return doc(db,'assignmentStates',studentUid+'_'+assignmentId);
}

export async function loadTeacherReview({db,studentUid,assignmentId}) {
  const ref=stateRef(db,studentUid,assignmentId);
  const state=await getDoc(ref);
  if(!state.exists()) throw new Error('Submission not found');
  const attempts=await getDocs(query(collection(ref,'attempts'),orderBy('attemptNumber')));
  const feedback=await getDocs(collection(ref,'feedback'));
  return {
    state:state.data(),
    attempts:attempts.docs.map(d=>({id:d.id,...d.data(),...decodeResponses(d.data())})),
    feedback:feedback.docs.map(d=>({id:d.id,...d.data()}))
  };
}

export async function gradeAssignment({auth,db,studentUid,assignmentId,score,maxScore,comments,expectedAttempt}) {
  const teacher=auth.currentUser;
  if(!teacher || teacher.isAnonymous) throw new Error('Teacher sign-in required');
  if(!Number.isFinite(score)||!Number.isFinite(maxScore)||maxScore<=0||score<0||score>maxScore) {
    throw new Error('Invalid grade');
  }
  if(String(comments||'').length>10000) throw new Error('Comments exceed 10000 characters');
  const ref=stateRef(db,studentUid,assignmentId);
  return runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists() || snap.data().status!=='submitted') {
      throw new Error('Assignment must be submitted before grading');
    }
    if(expectedAttempt!==undefined && snap.data().currentAttempt!==expectedAttempt) throw new Error('Submission changed. Reload the current attempt.');
    const attempt=snap.data().currentAttempt;
    tx.set(doc(ref,'feedback','attempt_'+attempt),{
      attemptNumber:attempt,score,maxScore,comments:String(comments||''),
      graderUid:teacher.uid,gradedAt:serverTimestamp()
    });
    tx.update(ref,{status:'graded',updatedAt:serverTimestamp()});
    return {status:'graded',attempt};
  });
}

export async function returnForCorrections({auth,db,studentUid,assignmentId,expectedAttempt}) {
  if(!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('Teacher sign-in required');
  const ref=stateRef(db,studentUid,assignmentId);
  return runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists() || !['submitted','graded'].includes(snap.data().status)) {
      throw new Error('Only submitted or graded work can be returned');
    }
    if(expectedAttempt!==undefined && snap.data().currentAttempt!==expectedAttempt) throw new Error('Submission changed. Reload the current attempt.');
    tx.update(ref,{status:'returned',updatedAt:serverTimestamp()});
    return {status:'returned',attempt:snap.data().currentAttempt};
  });
}

// Teacher-only lists and eligibility controls; authorization is enforced by Rules.
export async function listTeacherWork({db}) {
 const [states,assignments,students]=await Promise.all([
  getDocs(query(collection(db,'assignmentStates'),orderBy('updatedAt','desc'))),
  getDocs(collection(db,'assignments')),getDocs(collection(db,'studentAccess'))
 ]);
 const metadata=new Map(assignments.docs.map(d=>[d.id,d.data()]));
 const roster=new Map(students.docs.map(d=>[d.id,d.data()]));
 return states.docs.map(d=>({id:d.id,...d.data(),assignment:metadata.get(d.data().assignmentId)||{},studentName:roster.get(d.data().studentUid)?.displayName||d.data().studentUid}));
}
export async function setAssignmentAccess({db,studentUid,assignmentId,active}) {
 stateRef(db,studentUid,assignmentId);
 if(typeof active!=='boolean')throw new Error('Invalid assignment access');
 await setDoc(doc(db,'assignmentAccess',assignmentId,'students',studentUid),{active});
}

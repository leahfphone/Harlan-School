// Development branch only. Requires deployed Firestore authorization rules.
import {
  doc, getDoc, getDocs, collection, query, orderBy,
  runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

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
    attempts:attempts.docs.map(d=>({id:d.id,...d.data()})),
    feedback:feedback.docs.map(d=>({id:d.id,...d.data()}))
  };
}

export async function gradeAssignment({auth,db,studentUid,assignmentId,score,maxScore,comments}) {
  const teacher=auth.currentUser;
  if(!teacher) throw new Error('Teacher sign-in required');
  if(!Number.isFinite(score)||!Number.isFinite(maxScore)||maxScore<=0||score<0||score>maxScore) {
    throw new Error('Invalid grade');
  }
  const ref=stateRef(db,studentUid,assignmentId);
  return runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists() || snap.data().status!=='submitted') {
      throw new Error('Assignment must be submitted before grading');
    }
    const attempt=snap.data().currentAttempt;
    tx.set(doc(ref,'feedback','attempt_'+attempt),{
      attemptNumber:attempt,score,maxScore,comments:String(comments||''),
      graderUid:teacher.uid,gradedAt:serverTimestamp()
    });
    tx.update(ref,{status:'graded',updatedAt:serverTimestamp()});
    return {status:'graded',attempt};
  });
}

export async function returnForCorrections({auth,db,studentUid,assignmentId}) {
  if(!auth.currentUser) throw new Error('Teacher sign-in required');
  const ref=stateRef(db,studentUid,assignmentId);
  return runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists() || !['submitted','graded'].includes(snap.data().status)) {
      throw new Error('Only submitted or graded work can be returned');
    }
    tx.update(ref,{status:'returned',updatedAt:serverTimestamp()});
    return {status:'returned',attempt:snap.data().currentAttempt};
  });
}

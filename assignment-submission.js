// Development only: shared student submission helper.
// Caller supplies initialized Firebase Auth and Firestore instances.
// Never embed unreleased test questions or answer keys in public HTML.
import {doc,getDoc,writeBatch,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

function validId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,90}$/.test(id)) {
    throw new Error('Invalid assignment identifier');
  }
  return id;
}

export async function submissionStatus({auth,db,assignmentId}) {
  const user=auth.currentUser;
  if(!user || user.isAnonymous) throw new Error('Student sign-in required');
  const ref=doc(db,'assignmentStates',user.uid+'_'+validId(assignmentId));
  const snapshot=await getDoc(ref);
  return snapshot.exists()
    ? {status:snapshot.data().status,attempt:snapshot.data().currentAttempt}
    : {status:'not_submitted',attempt:0};
}

export async function submitAssignment({auth,db,assignmentId,responses}) {
  const user=auth.currentUser;
  if(!user || user.isAnonymous) throw new Error('Student sign-in required');
  validId(assignmentId);
  if(!Array.isArray(responses) || responses.length===0) throw new Error('No work to submit');
  const stateRef=doc(db,'assignmentStates',user.uid+'_'+assignmentId);
  const existing=await getDoc(stateRef);
  const previous=existing.exists()?existing.data():null;
  if(previous && previous.status!=='returned') {
    throw new Error('Assignment locked. Wait for teacher to return it.');
  }
  const attemptNumber=previous?previous.currentAttempt+1:1;
  const attemptRef=doc(stateRef,'attempts',String(attemptNumber));
  const batch=writeBatch(db);
  batch.set(stateRef,{
    studentUid:user.uid,assignmentId,status:'submitted',
    currentAttempt:attemptNumber,updatedAt:serverTimestamp()
  });
  batch.set(attemptRef,{
    studentUid:user.uid,assignmentId,attemptNumber,
    responses,submittedAt:serverTimestamp()
  });
  await batch.commit();
  return {status:'submitted',attempt:attemptNumber};
}

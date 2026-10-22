// Development only: shared student submission helper.
// Caller supplies initialized Firebase Auth and Firestore instances.
// Never embed unreleased test questions or answer keys in public HTML.
import {doc,getDoc,writeBatch,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import {encodeResponses,decodeResponses} from './response-payload.js';

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
  const payload=encodeResponses(responses);
  const assignment=await getDoc(doc(db,'assignments',assignmentId));
  if(!assignment.exists()) throw new Error('Assignment unavailable');
  const stateRef=doc(db,'assignmentStates',user.uid+'_'+assignmentId);
  const existing=await getDoc(stateRef);
  const previous=existing.exists()?existing.data():null;
  if(previous && (previous.studentUid!==user.uid || previous.assignmentId!==assignmentId)) {
    throw new Error('Assignment ownership mismatch');
  }
  if(previous && previous.status!=='returned') {
    throw new Error('Assignment locked. Wait for teacher to return it.');
  }
  const attemptNumber=previous?previous.currentAttempt+1:1;
  const attemptRef=doc(stateRef,'attempts',String(attemptNumber));
  const batch=writeBatch(db);
  const stateData={
    studentUid:user.uid,assignmentId,status:'submitted',
    currentAttempt:attemptNumber,updatedAt:serverTimestamp()
  };
  if(previous) batch.update(stateRef,stateData);
  else batch.set(stateRef,stateData);
  batch.set(attemptRef,{
    studentUid:user.uid,assignmentId,attemptNumber,
    ...payload,submittedAt:serverTimestamp()
  });
  batch.delete(doc(stateRef,'drafts','current'));
  await batch.commit();
  return {status:'submitted',attempt:attemptNumber};
}

function draftReference({auth,db,assignmentId}) {
 const user=auth.currentUser;
 if(!user||user.isAnonymous)throw new Error('Student sign-in required');
 return doc(db,'assignmentStates',user.uid+'_'+validId(assignmentId),'drafts','current');
}
export async function saveAssignmentDraft({auth,db,assignmentId,responses}) {
 const ref=draftReference({auth,db,assignmentId});
 const batch=writeBatch(db);
 batch.set(ref,{studentUid:auth.currentUser.uid,assignmentId,...encodeResponses(responses),updatedAt:serverTimestamp()});
 await batch.commit();
}
export async function loadAssignmentDraft({auth,db,assignmentId}) {
 const snapshot=await getDoc(draftReference({auth,db,assignmentId}));
 if(!snapshot.exists())return null;
 const data=decodeResponses(snapshot.data());
 if(data.responseError)throw new Error(data.responseError);
 return data;
}

// Returned work is used only as an editable starting point for a NEW attempt.
export async function loadAssignmentWork({auth,db,assignmentId}) {
 const draft=await loadAssignmentDraft({auth,db,assignmentId});
 if(draft)return {...draft,source:'draft'};
 const info=await submissionStatus({auth,db,assignmentId});
 if(info.status!=='returned')return null;
 const ref=doc(db,'assignmentStates',auth.currentUser.uid+'_'+validId(assignmentId),'attempts',String(info.attempt));
 const snapshot=await getDoc(ref);
 if(!snapshot.exists())return null;
 const data=decodeResponses(snapshot.data());
 if(data.responseError)throw new Error(data.responseError);
 return {...data,source:'returned'};
}

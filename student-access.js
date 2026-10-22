// Enrollment is provisioned by a trusted administrator, never the student.
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
export async function studentAccessMode({auth,db}) {
 const user=auth.currentUser;
 if(!user)throw new Error('Student session unavailable. Reload this lesson.');
 const record=await getDoc(doc(db,'studentAccess',user.uid));
 if(!record.exists()&&user.isAnonymous)return 'legacy';
 const data=record.exists()?record.data():{};
 if(data.active!==true||(user.isAnonymous&&data.allowAnonymous!==true))
  throw new Error('Your teacher needs to approve access for this browser.');
 return 'assigned';
}

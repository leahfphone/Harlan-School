// Shared staff authorization reader for dashboard interfaces.
// Firestore security rules are authoritative; this module is only for UI display.
import {auth,db} from './firebase-client.js';
import {doc,getDoc} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

export const SUBJECTS = Object.freeze([
  {id:'math',name:'Math'},
  {id:'language',name:'Language'},
  {id:'history',name:'History & Geography'},
  {id:'science',name:'Science'},
  {id:'bible',name:'Bible'},
  {id:'life-skills',name:'Life Skills'}
]);
const PRIMARY_EMAIL='lphone@jcatoday.org';

export async function loadStaffAccess(user=auth.currentUser) {
  if (!user || !user.emailVerified) return null;
  if (user.email?.toLowerCase()===PRIMARY_EMAIL) {
    return {role:'primary_admin',subjects:SUBJECTS.map(s=>s.id),email:user.email};
  }
  const snap=await getDoc(doc(db,'staffAccess',user.uid));
  if (!snap.exists()) return null;
  const record=snap.data();
  if (record.active!==true || record.email!==user.email ||
      !['assistant_admin','teacher'].includes(record.role)) return null;
  return {role:record.role,email:record.email,subjects:Array.isArray(record.subjects)?record.subjects:[]};
}

export function canEditSubject(access,subjectId) {
  return !!access && (access.role==='primary_admin' ||
    access.role==='assistant_admin' ||
    (access.role==='teacher' && access.subjects.includes(subjectId)));
}

export function canManageStaff(access) {
  return access?.role==='primary_admin';
}

# Multi-teacher release checklist

Status: development only. Do not merge or deploy until all checks pass.

## Blockers
- [ ] Verify publishedResources writes can only reference an existing matching draft subject.
- [ ] Review released assessment HTML for embedded answer keys, scoring logic, or teacher-only material.
- [ ] Configure and run Firebase Auth + Firestore emulator rules tests.
- [ ] Provision verified school staff accounts and trusted staffAccess documents.
- [ ] Verify primary admin, assistant admin, Science teacher, Life Skills teacher, unassigned teacher, and anonymous student separately.
- [ ] Verify anonymous students cannot read classResources, classSubmissions, classGrades, staffAccess or legacy submissions.
- [ ] Verify an assigned teacher cannot read another subject's submissions or grades.
- [ ] Verify grade writes cannot change the original submission.
- [ ] Verify a student cannot submit for another anonymous UID or reuse another resource ID.
- [ ] Verify publishing and unpublishing behavior with an actual student session.
- [ ] Verify changing accounts immediately clears protected content.
- [ ] Verify existing History and Math assessments still work.
- [ ] Verify no protected content or student data is committed to public GitHub.

## Product limitations to resolve
- The prototype assignment page is a plain-text response form, not a multiple-choice test engine.
- Student anonymous sign-in can be lost when browsers or devices change; a stable student identity and assignment enrollment process are needed.
- The prototype allows one submission per resource and anonymous UID, not one per real student.
- Teacher drafts have no structured answer-key field, so a confirmation warning alone cannot guarantee a safe publication.
- Published materials currently require an administrator; subject teachers cannot publish directly.
- Grades are visible to authorized staff, not yet to students or families.
- Historical submissions remain administrator-only because subject metadata is missing.

## Deployment sequence
1. Test rules locally in the Firebase emulator, with both allowed and denied cases.
2. Address failures and complete teacher/student interface testing.
3. Provision staff roles using trusted administration, not public web clients.
4. Deploy Firestore rules separately with a documented rollback plan.
5. Merge reviewed GitHub changes only after Firebase permissions are confirmed.
6. Test on a nonproduction assignment before enabling real students.

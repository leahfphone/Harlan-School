# Controlled rollout plan — approval required

No step in this plan has been performed against production.

1. Review the development diff, security audit, passing emulator results, and browser evidence. Confirm that the intended first rollout is signed-in classwork plus preserved legacy assessments.
2. With explicit approval, export deployed rules and back up relevant collections. Compare the actual deployed rules with the repository legacy file and draft; resolve drift before any deployment.
3. With explicit approval, securely provision the durable student identity and authorized teachers. Create studentAccess/{uid} with active:true and a displayName; create teacherAccess/{uid} with active:true for additional teachers. Revocation uses active:false or deletion. Never provision access through a student browser.
4. Prepare published assignment metadata containing only title, subject, chapter/lesson, type, published and optional timestamp availableAt. Set type to classwork or assessment. Grant each intended student with assignmentAccess/{assignmentId}/students/{uid}={active:true}. Do not expose questions or keys in metadata.
5. Keep new assessment releases false during preparation. Put question content in secureAssessmentContent and keys in assessmentAnswerKeys. Inventory legacy protectedAssessments paths: only history-test-1 retains legacy student reads. Do not migrate or alter History Test 1/Canada Test 2 records in this rollout.
6. Run the committed emulator and browser suites from the exact release commit. Review screenshots and printable history. Choose the release and rollback references; allowlist responseJson fields only for new attempts/drafts. Historical attempts must not be rewritten.
7. Obtain explicit approval for the concrete rules/site release. Deploy only the approved artifacts to the existing harlan-learning-hub project; do not create a replacement project or merge main implicitly.
8. In an approved staged run, verify actual student/teacher sign-in, first submission, partial credit, returned correction, print layout, release/revocation, historical legacy reads, and device behavior. Stop on permission or migration failures; restore approved rollback artifacts as needed. Monitor delivery and permissions before widening access.

Local verification does not authorize provisioning, release flags, deployment, production data changes or a merge.

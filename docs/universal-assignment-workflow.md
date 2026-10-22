# Universal assignment workflow — implementation contract

Status: development only. Do not deploy until Firebase rules and client flows pass testing.

## Existing functionality to preserve
- Existing History Test 1 and Canada Test 2 submission IDs, formats, and release checks.
- Teacher email-verified login and teacher-only submission reads.
- assessmentReleases and protectedAssessments teacher-controlled access.
- Existing Math Chapter 4/5 pages until migrated.

## Assignment types
- classwork: visible without release, with read-aloud and optional non-answer-revealing hints.
- quiz/test: student cannot read questions before a teacher release; no hints or correctness indicators during an attempt. Keep assessment content in protectedAssessments or another protected backend, never embed unreleased questions or keys in public GitHub Pages HTML.

## Identity and permissions
- Authenticate Harlan with a durable account; do not rely on anonymous auth or a typed student name to prove identity.
- Bind enrollment to student UID and teacher-authorized course/assignment membership.
- Teachers must be explicitly authorized; do not assume an arbitrary signed-in user is a teacher.
- All writes enforce student UID, assignment ID, allowed status transitions, and immutable historical attempts in Firestore rules and/or trusted backend.

## Proposed collections (new, versioned; preserve legacy collections during migration)
- assignments/{assignmentId}: subject, chapter, lesson, title, type, published, availableAt; do not place protected questions or answers here.
- protectedAssessments/{assessmentId}: questions and release-controlled content; teacher write only, student read only if released.
- assessmentReleases/{assessmentId}: released flag, optional time window and eligible students; teacher write only.
- assignmentStates/{studentUid_assignmentId}: studentUid, assignmentId, status (in_progress/submitted/returned/graded), currentAttempt, updatedAt; teacher-managed transitions after submission.
- assignmentStates/{stateId}/attempts/{attemptId}: immutable answer/work/check history and server submission timestamp.
- assignmentStates/{stateId}/feedback/{feedbackId}: teacher grade, rubric, comments, returnedAt, graderUid, timestamp.
- teacherAccess/{uid}: admin-managed teacher authorization.
- studentAccess/{uid}: admin-managed enrollment and identity mapping.

## State transitions
1. Student may create/save in_progress for assigned classwork or a released assessment.
2. Student may submit once; server records submittedAt, locks attempt.
3. Teacher may grade or return; only teacher may authorize a correction.
4. Returned student may create a NEW correction attempt; original answers, grades and timestamps remain immutable.
5. Resubmission locks again until teacher action.
6. Tests may only be reopened through explicit teacher authorization.

## Security and implementation requirements
- Rules must validate each transition and ownership; teacher-only grading, return, and release.
- Do not trust client-provided timestamps for authoritative submissions.
- Student must not be able to set their own status to returned or change a grade.
- Student cannot read other students' work.
- Do not leak answer keys, quiz/test questions, or teacher-only feedback through static JS/HTML.
- Offline/localStorage drafts are conveniences only, not proof of submission or reliable cross-device sync.
- Teacher dashboard needs subject filters, submission date, full answer history, partial credit, grade, printable record, and return action.
- Do not overwrite existing deployed rules until tests show legacy History assessments still function.

## Acceptance tests before deployment
- Unreleased quiz/test content cannot be fetched with student credentials, even by guessing URLs/IDs.
- Classwork opens without release; submit locks further edits.
- Student cannot return or grade their own work.
- Teacher can grade and return; student can submit correction only after return.
- Original attempts and grades remain accessible.
- Unauthorized accounts cannot read or write student records.
- Legacy History Test 1 and Canada Test 2 retain current behavior.


## Implemented development schema (2026-10-22)

- studentAccess/{uid} and additional teacherAccess/{uid} require active:true.
- assignmentAccess/{assignmentId}/students/{uid} is teacher-managed {active:boolean}; enrollment alone is insufficient.
- Assignment metadata is restricted to title, subject, chapter, lesson, type, published and optional availableAt. Protected questions/keys never belong here.
- New immutable attempts use responseFormat:"json-v1", responseCount and responsesJson rather than a nested list. Rules bound the opaque UTF-8 payload to 200,000 bytes; consumers validate the response schema and render text. Older attempts remain readable. Malformed student-authored JSON is flagged for return, never trusted for grades or permissions.
- Account drafts live at assignmentStates/{stateId}/drafts/current and use the same payload bounds. They can be saved before first submission or after return; submitting atomically removes the draft.
- Both math lesson pages use a shared bridge: durable assigned accounts use the new immutable workflow; anonymous accounts retain legacy one-copy delivery.
- Only History Test 1 retains student reads through the old protectedAssessments collection. New assessments require secureAssessmentContent, matching assignment membership and release; keys are teacher-only.
- The student classwork preview does not implement a new generic quiz-taking interface. Assessment protection is verified at the Rules and actual browser-authenticated SDK layers. Existing History/Canada interfaces are preserved.

See development-verification.md and rollout-plan.md for tested behavior and outstanding approval gates.

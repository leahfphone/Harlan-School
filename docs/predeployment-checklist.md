# Pre-deployment verification checklist

**Status:** NOT DEPLOYED. The draft rules and actual client helpers pass 33 local emulator tests and local browser acceptance checks as of 2026-10-22. See `development-verification.md` for evidence and remaining deployment blockers. Local browser checks pass; target-device and production acceptance items below are still pending.

## Prerequisites
1. Confirm the current deployed Firestore rules and export a backup.
2. Provision the student identity securely in Firebase Authentication, then create studentAccess/{uid} with active:true through the trusted Firebase console or administrative backend.
3. Confirm a verified teacher account can access teacher review. Future teachers need trusted provisioning into teacherAccess/{uid} with active:true; the browser cannot self-assign teacher permissions.
4. Create a published classwork assignment document such as assignments/math6-ch4-lesson31 with title/subject, type: 'classwork' and published: true. Grant each student assignmentAccess/{assignmentId}/students/{uid}={active:true}. Do not store test questions in public assignment metadata.
5. Verify the draft rules compile in Firebase emulator; fix any rules-language or cross-document access problems before publishing.
6. Review Firestore rules limits and costs for batched getAfter/existsAfter calls.

## Student permission tests
- Unauthenticated account cannot read submissions or submit.
- Anonymous account cannot create new-system assignments.
- Authenticated but unenrolled account cannot submit or read student data.
- Student can submit first attempt as atomic batch.
- Student cannot edit a submitted attempt or set status to returned/graded.
- Student cannot overwrite original attempt or feedback.
- Student cannot read another student's attempts or grades.
- Returned student can submit a second attempt; non-returned student cannot.
- Attempts and server timestamps remain preserved.

## Assessment protection tests
- Before release, a student cannot fetch test content by direct Firestore path or guessed URL.
- A student cannot use static GitHub Pages source to obtain unreleased questions or answer keys.
- Release must be teacher-controlled, and only authorized students may access new protected assessment content.
- No correctness indicators or hints during quizzes/tests.
- Existing History Test 1 release control and Canada Test 2 submission behavior remain intact.

## Teacher workflow tests
- Teacher can view submissions, original work, corrections and timestamps.
- Teacher can grade an attempt with points and comments.
- Blank/invalid grade rejected.
- Teacher can return graded or submitted work; student can then correct.
- Concurrent grading/return requests cannot silently overwrite state.
- Printing preserves all attempts and feedback.

## Rollout and device review remaining
- Account-backed drafts are implemented and emulator/browser-tested; verify on actual target devices in the approved staged run.
- Teacher-managed per-student assignment eligibility is implemented; provision and review the production roster only after approval.
- New protected assessment content must be isolated from publicly hosted HTML.
- Draft rules compile and the 33-test emulator suite passes (2026-10-22); review the deployed rules and rollback plan after approval.
- No end-to-end test against the real Firebase project has been run.
- Existing Math Chapter 4/5 pages support the shared client for durable assigned accounts and preserve anonymous compatibility.
- The existing teacher dashboard links to the universal review/filter/grading page; verify the approved production rollout and device behavior.
- The classwork preview rejects assessments; protected assessment reads are verified at the Rules and browser-authenticated SDK layers. A generic new quiz interface is outside this rollout.

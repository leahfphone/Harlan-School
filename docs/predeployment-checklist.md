# Pre-deployment verification checklist

**Status:** NOT DEPLOYED. This checklist documents tests that must be performed, not tests that have passed.

## Prerequisites
1. Confirm the current deployed Firestore rules and export a backup.
2. Provision the student identity securely in Firebase Authentication, then create studentAccess/{uid} through the trusted Firebase console or administrative backend.
3. Confirm a verified teacher account can access teacher review. Future teachers need trusted provisioning into teacherAccess/{uid}; the browser cannot self-assign teacher permissions.
4. Create a published classwork assignment document such as assignments/math6-ch4-lesson31 with type: 'classwork' and published: true. Do not store test questions in public assignment metadata.
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

## Known development gaps (must resolve)
- Current preview uses localStorage for draft saving; reliable cross-device drafts are not yet implemented.
- Assignment roster/eligibility needs tighter student-to-assignment authorization.
- New protected assessment content must be isolated from publicly hosted HTML.
- Rules have not been compiled or emulator-tested.
- No end-to-end test against the real Firebase project has been run.
- Existing Math Chapter 4/5 pages have not been migrated to this client.
- Preview pages are not a replacement for the current teacher dashboard.
- Ensure student preview validates assignment release before allowing a test to open; Firestore rules are the authoritative enforcement layer.

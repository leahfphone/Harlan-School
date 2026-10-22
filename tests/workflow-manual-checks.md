# Manual acceptance checks — universal assignment workflow

Status: pending. These are test cases, not verified outcomes.

## Teacher preparation
- Teacher signs in with verified account.
- Teacher creates/publishes ordinary classwork assignment and grants student access using trusted administrative setup.
- Confirm the student has a non-anonymous account and can access only their own records.

## Student first attempt
1. Student opens classwork and saves an answer draft.
2. Refresh page: draft reappears on the same device.
3. Student submits: UI displays success only after Firestore confirms the batch.
4. Reload: assignment status is submitted and answer fields are locked.
5. Try to submit a second attempt before teacher returns it: denied.
6. Teacher sees first attempt with answers, shown work and timestamp.

## Teacher grading
1. Open submission in teacher review.
2. Blank score and invalid score are rejected.
3. Record partial credit (e.g., 7.5/10) and comments.
4. Refresh teacher view: grade and comments remain.
5. Student cannot change the grade or feedback.

## Corrections
1. Teacher returns assignment.
2. Student opens returned work and can edit a new attempt.
3. Student resubmits: attempt 2 is created; attempt 1 is unchanged.
4. Teacher can view and print both attempts and their feedback.
5. Attempt 2 locks again after submission.

## Tests and access controls
1. Before release, direct access to protected test content fails for student.
2. Teacher can read protected test and teacher-only answer key.
3. After release, student can read only permitted test content, never answer key.
4. Another student cannot read Harlan's attempts.
5. A signed-out or anonymous user cannot access new student submissions.

## Migration gate
Do not connect existing History Test 1, Canada Test 2, or Math pages until emulator tests and these checks pass. Keep the legacy Firestore rules backed up and verify all original tests still function.

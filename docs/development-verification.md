# Development verification — 2026-10-22 continuation

Repository: leahfphone/Harlan-School. Branch: feature/universal-assignment-workflow.
Base: 67d167c. Existing production project: harlan-learning-hub. No live accounts, data or rules were changed; no merge or deployment was performed.

## Verified results

- **33 Firestore emulator tests pass; zero failures.** The suite executes the actual browser submission/teacher helpers with Firebase SDK 10.14.1 and loads the draft rules.
- **12 browser acceptance check groups pass; zero failures.** Tests use a fresh headless Chrome profile, real email/password sign-in against the Auth emulator, and the Firestore emulator. The browser allows only localhost and public Firebase SDK downloads; requests to production backends are blocked and asserted absent.
- The original eight-test suite passed before this work; expanded original-rule comparison exposed 11 failures out of 16, many downstream of the first-state read denial. The preceding development commit passed 19 tests. This continuation expands coverage and resolves the implementation blockers listed in that report.

## Changes completed

1. **Assignment eligibility:** teacher-managed `assignmentAccess/{assignmentId}/students/{uid}` records with `active: true` are now required in addition to active student enrollment. Revocation blocks new submissions, corrections, protected content and existing work reads. Students cannot grant access. Inactive or anonymous teacher identities cannot use teacherAccess grants.
2. **Content isolation:** assignment metadata has a field/type/length allowlist. Student reads reject unsafe documents even if they were inserted through an administrative bypass. New protected content requires assigned membership, publication, schedule and teacher release. New assessments cannot use the legacy protectedAssessments escape path; the History Test 1 exception remains intact. Answer keys remain teacher-only.
3. **Response boundaries:** new attempts/drafts store `responseFormat: json-v1`, `responseCount` and `responsesJson`. Rules bound UTF-8 payload size to 200,000 bytes and responseCount to 1–150. The client checks question/answer/work lengths, numbering, fields, check-history size and timestamp format. Teacher loading revalidates before displaying text. Invalid direct JSON writes remain bounded untrusted student text, are clearly flagged and can be returned; they are never evaluated, rendered as HTML, or used as grading/authorization data. Rules do not parse JSON or certify student correctness/check times. Older development list-based attempts remain readable.
4. **Drafts:** account-saved drafts can be loaded in another signed-in session. Submission atomically deletes the draft. Locked work cannot be saved through a concurrent draft request. Device backups remain a convenience, not proof of delivery.
5. **Teacher workflow:** a submission list now shows subject, student identity, status and date, with subject/status filters. The review displays all attempts, work, student practice checks, timestamps and feedback. Grade fields reset for each new attempt; stale review requests cannot grade/return an unseen later correction. Printing excludes login, finder and grading controls.
6. **Math Chapter 4/5 integration:** both actual lesson pages use one shared bridge. Signed-in, assigned students use immutable universal attempts, grading and returned corrections. Existing anonymous delivery is preserved. Chapter 5 submission is enabled, exact response counts match its additional lesson questions (7/3/7/7/6/8/3/3), and successful delivery locks editing and repeat sends. Classwork hints/read-aloud remain classwork features.
7. **Local safety:** the new shared client selects demo emulators automatically on localhost, with no live fallback. Test accounts exist only inside the local Auth emulator. Existing History Test 1 and Canada Test 2 pages and their payload/release behavior were left unchanged.

## Remaining release gates

These are production preparation and review tasks, not passing emulator results:

- Obtain explicit approval before provisioning durable student/teacher identities, enrollment, assignment metadata, membership grants or assessment content in the live project.
- Export and compare the currently deployed rules, confirm rollback and back up existing data. The repository firestore.rules is unchanged; it is not proof that production has no drift.
- Inventory any preexisting protectedAssessments documents other than history-test-1 before rollout: new rules deliberately close that legacy route. Confirm existing studentAccess/teacherAccess records explicitly have active:true and assignment metadata uses the new schema.
- Review and approve the assignment roster and teacher releases. Metadata must contain descriptive text only; a schema cannot recognize a secret manually placed into a title. Real new assessment questions and keys must be provisioned into their separate collections.
- Review the local browser screenshots/print output and perform an approved staged acceptance run on the actual target devices/accounts. Local Chrome and a narrow viewport are not a physical iPad/Safari test or a live-project acceptance run.
- Legacy Canada Test 2 remains a publicly hosted test by existing design. Anonymous legacy submissions remain immutable copies, without the durable-account correction workflow. Universal grading/corrections require signed-in assigned students. No claim is made that the old public Canada page is a new protected assessment.

A controlled rollout plan is in `docs/rollout-plan.md`. Deployment and production changes remain pending explicit approval.

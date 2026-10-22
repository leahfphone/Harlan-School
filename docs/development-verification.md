# Development verification — 2026-10-22

Repository: leahfphone/Harlan-School. Branch: feature/universal-assignment-workflow.
Original head: d5ab035. Existing Firebase project: harlan-learning-hub (not accessed).

## Results

| Run | Passed | Failed | Interpretation |
| --- | ---: | ---: | --- |
| Original eight tests / original draft rules | 8 | 0 | Original coverage missed the client first-read failure. |
| Expanded 16 tests / original draft rules | 5 | 11 | Includes downstream failures caused by the initial state read denial. |
| Same 16 tests / fixed draft rules | 16 | 0 | Regression comparison. |
| Final suite / fixed draft rules | 19 | 0 | Three additional authorization/atomicity scenarios and stronger invalid-grade checks. |

A preliminary expanded run passed 14/16: one test constructed an invalid document reference; the restored Math Chapter 4 rule exposed an unsupported `endsWith` call. Both were corrected before the passing comparisons.

The final suite executes the real student and teacher helpers using Firebase SDK 10.14.1, matching their browser imports. It verifies initial absent-state reads and atomic first submissions; locked/immutable attempts; partial-credit grading; return from graded work; separate correction attempts and retained timestamps/grades; atomic feedback; invalid grades including malformed direct batched writes; duplicate submissions and concurrent grading; enrollment, disabled enrollment and cross-student access; privilege escalation denial; teacherAccess authorization; protected content release and revocation; answer key isolation; unpublished assignment denial; payload tampering; and legacy History Test 1, Canada Test 2 and Math Chapter 4 rules.

## Fixes

- Allow enrolled students to get their own absent state document so first submissions can start, while existing records remain restricted by ownership.
- Honor `studentAccess.active == true` for new-workflow access.
- Restore legacy Math Chapter 4 submissions in the draft using supported Rules syntax.
- Restrict teacher state updates to valid grade/return transitions without rewriting identity or attempt numbers.
- Require grading and valid feedback in the same atomic operation. Validate score range, fields, grader, attempt and timestamps; prior feedback is immutable.
- Reject anonymous teacher clients and excessive feedback comments in the helper.
- Add pinned test dependencies, lockfile, isolated fixtures and reproducible instructions.

The emulator uses demo-harlan-rules on localhost, with Firestore emulator 1.19.8 and Java 21. No live Authentication, data, rules or releases were read or changed. No merge or deployment was performed. The existing firestore.rules and production HTML pages remain unchanged. The preview HTML still names the real project; these tests do not open those pages.

## Deployment blockers

1. Assignment eligibility is still global enrollment: any active enrolled student can access published assignments and released new assessments. Implement explicit per-student assignment/course membership before broader use.
2. Existing Math Chapter 5 posts `submissions/math5_*`, which is denied by both existing and draft rules. Decide on migration to the new durable-account workflow or separately reviewed legacy support. Chapter 4/5 adapters are not integrated with existing pages.
3. Test questions/keys must stay out of public assignment metadata and static assets. New secure collections isolate them, but no generic schema currently enforces safe assignment metadata. Legacy Canada Test 2 questions remain publicly hosted by its existing design; this work preserves that behavior and makes no new secrecy claim for that page.
4. Browser acceptance is pending: durable student login, preview loading, actual dashboard integration, printing and device behavior have not been exercised. Reliable cross-device drafts and roster/filter integration remain unfinished.
5. Response count is bounded, but nested answer/work/check payload schemas and per-field length bounds need further design and validation. Current SDK/Firestore document limits are the remaining outer bound.
6. Before any authorized rollout, compare/export deployed rules, confirm rollback and migration plans, and verify trusted enrollment/teacher provisioning. No live-project acceptance run has been performed. Provisioning, deployment and all production changes require explicit approval.

The emulator verifies Rules and SDK behavior; it does not establish UI readiness or production rollout readiness.

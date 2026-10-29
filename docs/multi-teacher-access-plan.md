# Multi-teacher access — implementation plan (not deployed)

## Approved staff roles
- Primary administrator: lphone@jcatoday.org — all instructional, reporting, user-management and security permissions.
- Assistant administrator: aduncan@jcatoday.org (Amber Duncan) — view, create, edit, grade and publish across every subject. No user-management, security, or repository ownership rights.
- Science teacher: jthompson@jcatoday.org (Jenny Thompson) — Science only; Bible assignment unconfirmed.
- Life Skills teacher: cleiser@jcatoday.org (Cheryll Leiser) — Life Skills only.
- Future teachers: assign after identity and classes confirmed.

## Implementation requirements
1. Verify Firebase Auth accounts by UID; use verified school email only for initial provisioning. Do not trust client-supplied role/subject values.
2. Store role and subject memberships in administrator-managed records; deny writes to these records from ordinary teachers.
3. Apply role and subject checks to every Firestore read/write for submissions, grades, lessons, quizzes, tests, protected answer keys and release controls. Require explicit subject/class IDs for new records.
4. Migrate legacy records lacking subject/class IDs carefully, preserving existing submissions and releases. Do not grant broad access based on missing fields.
5. Add Life Skills to subject navigation only when the corresponding materials and routes are ready.
6. Protect answer keys and unpublished assessments from public GitHub Pages files and student-visible client bundles.
7. Test denied cross-subject edits, teacher account changes, unauthenticated access, and primary-admin access in Firebase emulators before deployment.
8. Separate GitHub collaboration from application roles. GitHub repository permissions cannot enforce subject-specific file edits; use review workflow and branch protections.
9. Do not publish this plan as an operational security control. No invitations or live Firebase rule changes are included.

## Existing system notes
- Current firestore.rules recognizes only one verified teacher email.
- Current teacher-dashboard.html hardcodes the same email.
- Existing submissions and protected assessment paths require backward-compatible migration.
- GitHub repository is public; audit for private student records and assessment answer keys before onboarding.

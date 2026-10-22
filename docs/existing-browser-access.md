# Existing student browser access

Harlan keeps opening his work the same way, without a new email/password or student sign-in screen. The math pages reuse the existing Firebase anonymous identity, creating the normal anonymous session automatically if none exists. No existing account is migrated or deleted.

A trusted administrator must explicitly approve the intended browser UID with studentAccess/{uid}={active:true,allowAnonymous:true,displayName:"Harlan"}. Approval of that enrollment and assignment grants in the live project is still required. Teacher confirmation must identify the intended browser; do not pick an arbitrary anonymous UID. Student enrollment documents are never student-writable. A student can get only their own enrollment status, including an absent or inactive status; listing enrollments remains teacher-only.

The enrollment flag permits only the same owned assignment paths governed by publication, assignment membership, schedules and assessment release rules. It conveys no teacher authority. Answer keys remain teacher-only. Inactive or incomplete enrollment fails closed; a failed enrollment read is not treated as permission for legacy delivery. An entirely absent anonymous enrollment retains the old one-copy delivery route. Legacy copies are not automatically migrated into universal attempts.

Approved browser sessions use account-backed drafts, immutable attempts, teacher grades and returned corrections. Reloading a returned lesson loads the last attempt as a starting point for a new correction. Local delivered markers do not override the authoritative workflow state. Legacy device drafts stay separate; approved-session backups are scoped to the browser UID.

Anonymous credentials are tied to browser storage. Another browser, a replacement device, cleared storage or signing out may produce a different UID. Access must then be explicitly re-approved. Never export authentication tokens to move access. This preserves the current student experience but does not promise the cross-device recovery of a password-based account.

History Test 1 and Canada Test 2 source files and existing release/submission behavior remain unchanged. No new generic protected-test UI is delivered by this change; protected content authorization is covered by emulator/browser SDK tests. The actual Math Chapter 4/5 pages exercise the submission and correction UI.

# Staff provisioning and testing (draft)

**Do not deploy the draft Firestore rules without emulator tests and migration review.**

Staff identities are Firebase Authentication user UIDs, not email-based document IDs. Create and verify each staff Firebase Authentication account first. Then use a trusted Firebase Admin SDK script or console to create a `staffAccess/{uid}` record. No browser client may write these records.

Example profiles (replace UID placeholders with real Firebase Auth UIDs):
```json
{"email":"aduncan@jcatoday.org","role":"assistant_admin","active":true,"subjects":["math","language","history","science","bible","life-skills"]}
{"email":"jthompson@jcatoday.org","role":"teacher","active":true,"subjects":["science"]}
{"email":"cleiser@jcatoday.org","role":"teacher","active":true,"subjects":["life-skills"]}
```
Jenny's Bible assignment is not confirmed. The primary administrator remains bootstrapped by verified school email. A future migration to immutable UID/custom claims is recommended.

## Must-pass emulator tests
- Unauthenticated users cannot read staff profiles, unpublished assessments or submissions.
- Teacher cannot edit or delete resources belonging to another subject.
- Teacher cannot change a resource's subject to bypass restrictions.
- Assistant administrator can edit any subject resource but cannot write staff profiles.
- Primary administrator can read all existing submissions and edit any subject.
- Teacher cannot read legacy submissions without an explicit verified subject.
- Existing anonymous Math 6 and Canada test submission behavior remains unchanged.
- Student-visible releases cannot expose unpublished answer keys.
- Firestore queries for teachers include subject filters compatible with rules.

## Remaining integration work
- Add dashboard UI for staff roles, subject-specific content creation, and filtered grading.
- Migrate legacy submission records to trusted subject/class metadata.
- Secure protected assessment edits by subject and ensure student-facing material is separate from answer keys.
- Audit GitHub Pages for public test keys and sensitive student information.
- Create and verify teacher accounts, then deploy and test rules.

# Run Firestore workflow tests locally

These tests are **not yet confirmed passing**. Do not deploy draft rules based on their presence.

Prerequisites: Node.js, Java (Firebase emulator dependency), and Firebase CLI.

From the repository root:

```sh
npm install --no-save firebase @firebase/rules-unit-testing firebase-tools
npx firebase-tools emulators:exec --config firebase.emulator.json --only firestore "node --test tests/firestore-workflow.test.mjs"
```

The emulator uses a separate local project ID, `harlan-rules-emulator`, and does not contact the live Harlan Firebase project for Firestore writes. Stop if port 8080 is occupied.

Expected results: unreleased assessment inaccessible; answer keys teacher-only; unenrolled users blocked; atomic first attempt allowed; editing locked attempts blocked; returned second attempt allowed; assessment questions available only after release.

If a test fails, preserve the output and fix the draft rules or test fixtures before deployment. No student account or live Firebase settings need changing to run these local tests.

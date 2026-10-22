# Local Firestore workflow tests

Development only. Passing emulator tests are not deployment authorization.

Prerequisites: Node.js 20 or 22, Java 21, and pnpm. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm test
```

The SDK is pinned to Firebase 10.14.1, matching the browser modules. Optional dependency build scripts are disabled; they are not needed for this suite.

The CLI and test environment use `demo-harlan-rules`, an isolated demo project. Only the Firestore emulator starts, on 127.0.0.1:8080. No live accounts or Firebase project data are required. Stop if the port is occupied. Do not open the preview pages against production to run these tests: their app configuration still names the existing `harlan-learning-hub` project.

The suite loads the actual student and teacher modules, replacing only the browser SDK import with the same local SDK version. Each test clears and seeds emulator data. It covers first submissions, immutable attempts and grades, partial credit, atomic grading and corrections, concurrent submissions/grading, release/revocation, unauthorized access, malformed grades and payloads, and legacy History Test 1, Canada Test 2, and Math Chapter 4 submission rules.

Expected permission-denied messages are emitted by negative authorization tests. Use the final test counts and exit code to determine success.

To reproduce the original-rule regression comparison, extract the rules at the original branch commit and set `WORKFLOW_RULES` to that local path inside the emulator test command. This override affects test rule loading only.

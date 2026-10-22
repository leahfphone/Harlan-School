# Local workflow verification

Development only. Passing local tests do not authorize deployment.

Prerequisites: Node.js 20/22 or newer supported LTS, Java 21 and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
```

To use an existing Chrome executable instead of downloading Chromium, set CHROME_EXECUTABLE to its absolute executable path when running the browser suite. Optional BROWSER_ARTIFACTS selects a screenshots/print-output directory; the default is the ignored .runtime/browser-results folder.

Both CLI/test environments use demo-harlan-rules. Rules tests start only Firestore (127.0.0.1:8080). Browser tests start Firestore and Auth (127.0.0.1:9099), seed ephemeral demo accounts, serve a loopback-only HTTP site and launch a fresh browser profile. Stop if ports are occupied. The browser test refuses requests outside localhost and www.gstatic.com (public SDK downloads). Do not run it against a deployed URL or change the demo project ID to production.

34 Rules/helper tests cover first submissions, partial credit, immutable history, corrections, concurrency, enrollment and assignment membership/revocation, teacher grants, release and answer-key security, schedules, safe metadata, bounded response payloads, malformed direct writes, private account drafts and stale teacher review. Existing History Test 1, Canada Test 2 and Math Chapter 4/5 rules are included.

Browser checks exercise durable sign-in, account draft reload, locked editing, dashboard filtering, safe rendering, grade validation/partial credit, corrections, printing, narrow-screen layout, both actual math pages with durable and anonymous accounts, protected assessment reads and no production network access. These are local Chrome checks, not a physical iPad/Safari acceptance run.

New attempts use bounded response JSON; teacher consumers revalidate it and preserve earlier development-format attempts. Student-authored checks/timestamps are not authoritative grades or submission times. Rules enforce authoritative server timestamps and teacher-only feedback separately.

Negative tests emit expected permission-denied messages. Success is determined by the final test counts/exit status, not by absence of error strings.


## WebKit and release packaging

```sh
pnpm exec playwright install webkit
pnpm test:webkit
pnpm test:release
```

PLAYWRIGHT_BROWSERS_PATH can point to a writable local browser directory. BROWSER_ENGINE selects chromium or webkit when invoking the browser script directly. WebKit verifies the Safari engine locally; it is not a physical iPad test. PDF generation is Chromium-only; WebKit checks print styles and captures a print screenshot.

The browser suite also covers optional device storage, math draft privacy across accounts, cross-device restoration, returned-work prefilling and sign-out cleanup. Local Firestore streams are not intercepted by the request guard; every non-allowlisted destination is still intercepted and blocked.

See docs/release-package.md for building the offline candidate from a clean commit. The builder never deploys or provisions accounts.


WebKit native local-emulator stream cancellations are recorded and scoped to exact local Firestore RPC paths plus a matching navigation/sign-in transition within 1.5 seconds. Unexpected errors still fail; the suite does not globally ignore access-control errors. The event report is retained with screenshots. Physical-device and production acceptance remain separate gates.


## Existing browser access

The rules suite now has 37 tests. An explicitly enrolled anonymous browser uses active:true and allowAnonymous:true, plus assignment membership, without a new email/password. Tests cover the full partial-credit/correction flow, self-enrollment and teacher-escalation denial, cross-identity isolation, revocation, protected release/key isolation, and fail-closed enrollment-mode selection. The browser suite adds an actual Math Chapter 4 flow with no sign-in UI, draft reload, partial grading, returned work, resubmission and revocation.

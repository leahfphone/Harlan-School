# Offline review package

The release builder reads a clean local checkout, performs no network requests and writes no Firebase data. It includes the exact frontend files, draft rules, unchanged repository rules baseline, rollout plan, checksums and unpublished metadata for all 18 Math Chapter 4/5 assignments.

From a clean checkout of the approved development commit:

```sh
pnpm prepare:release --out /absolute/path/to/a/new/output-folder
```

The output folder must not exist. The builder also creates a tar.gz archive and a SHA-256 checksum file beside it. Set GIT_EXECUTABLE only if the normal Git executable is unavailable.

RELEASE.json identifies the source commit and every packaged file hash. assignment-plan.json deliberately contains no account identifiers or membership grants; all proposed assignments start unpublished. Approval and an authorized operator are required to bind student identities, provision access, publish assignments or deploy.

The builder refuses uncommitted changes and checks exact preserved versions of History Test 1, Canada Test 2 and the repository legacy rules. The baseline rules file is not a live-project export; production drift still needs a read-only review after Firebase sign-in.

Run the offline archive integrity/refusal test with:

```sh
pnpm test:release
```

That test builds from an isolated local Git fixture, verifies the recorded file/archive hashes and 18 unpublished assignments, and proves dirty checkouts and changed legacy assessment files are refused. It does not access the live project.

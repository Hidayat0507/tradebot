Logging circular objects or arrays currently throws a stack overflow, and bigint context throws during JSON serialization. Either failure can interrupt the caller while it is reporting another error.

Track the current ancestor path to replace cycles with `[Circular]` and serialize bigint as decimal strings without losing precision. Preserve shared non-circular objects, existing field redaction, and caller-owned data.

Validation:
- Reproduced three failing regression cases before the fix; all five logger regression tests now pass.
- 30 focused offline tests passed with one worker: logging context, API response, and mocked security.
- `npx --no-install tsc --noEmit --incremental false` passed.
- `git diff --check` passed.

Separate from open PRs #31–#34; no overlapping files. Scope is log context serialization; Error cause chains, arbitrary throwing getters, and deeply nested acyclic objects are unchanged.

No deployment, production access, real trading, or credential-file access. Draft for review into main; do not merge.

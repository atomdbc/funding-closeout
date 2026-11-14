# Local storage, recovery and unsigned review

`server/start.ts` uses Node 24.10's built-in **experimental** SQLite API. There is no external database service or new npm runtime dependency. The project-local `.local/closeout.sqlite` file is excluded from Git. The directory/database use 0700/0600 permissions and SQLite transactions with DELETE journaling. Files are **plaintext, not encrypted**; this is a single-machine prototype, not production multi-user hosting.

## Working draft and copies

Every successful validated edit commits before the UI claims success. Unsubmitted typing is not saved. Disk failures preserve the previous committed draft. Optimistic revision checks also apply across database connections: a stale save cannot overwrite newer inputs.

The store retains the latest **30** working revisions per browser workspace and up to **20** independently pinned named copies. This is bounded recovery history, not a tamper-proof audit log. Reopening a local copy/revision creates a new working revision and clears review/scope declarations. Previously checked movement facts keep their original check times; reopening is not a new RPC check or funder approval.

## Browser capability

A random HttpOnly, SameSite=Strict, 30-day rolling cookie identifies the workspace; only its SHA-256 key is stored in SQLite. It is not a verified reviewer identity. Restart retains saved records and rotates the CSRF token. Clearing/losing the cookie loses browser access; there is no account-recovery service. Keep downloaded JSON backups outside the working database.

Local filesystem access can read/alter records. Neither the history digest nor file permissions authenticate a funder or make this suitable for internet hosting. The HTTP server binds loopback only. Do not expose it over LAN/tunnels; no production authorization/hosting claim is made.

## Untrusted JSON import

Full `funding-closeout-v1` / `funding-closeout-v2` statements up to 256 KiB are accepted. Import reconstructs known input fields, validates amounts/assets/record limits, ignores supplied assessment/approval/digest fields, and clears review/scope marks.

**Imported chain facts lose their verification status.** Only public transaction/signer hints remain. An explicit RPC recheck must match the recipient, exact amount and receipt reference. A mismatch stays unresolved. Synthetic-fixture markers remain labeled. Importing/selecting a file does not itself make an RPC request. Optional file selection reads into a local form; JSON paste also works without JavaScript. No invoice-document fetch or third-party upload occurs.

## Offline packet

`/review.html` downloads self-contained HTML with calculations, blockers, terms, payment explanations/source facts and remaining obligations. Use browser Print to print/save PDF. Supplied text is escaped; remote resources, scripts and form actions are blocked. No cookie or CSRF capability is exported.

The included snapshot hash identifies the corresponding JSON inputs/assessment, not the HTML bytes, authenticity, legal validity or a signature. The packet records **no authenticated reviewer decision or payment**. Actual approval/returns remain outside the application.

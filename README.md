# Funding closeout

**Close your program. Explain every USDC.** Create a review for a funded program, record the terms and payments, account for unpaid obligations and export an unsigned closeout for human review.

This source provides a working, bounded review workflow with read-only NEAR mainnet checks. It does not connect a wallet, sign, move funds, authenticate funder approval or automatically return money. A public transfer proves movement, not purpose, ownership, work completion or legal entitlement.

## Hosted application

**https://funding-closeout.vercel.app** — hosted on Vercel with a separate private encrypted Blob store. New visitors start empty; no wallet connection or product sample is required. Browser capability access is not an account login; keep downloaded backups. No paid-plan upgrade or on-chain write is required.

Actual HTTPS customer-flow, public read-only RPC, export, cold-browser resume, independent-browser isolation, secure-cookie, invalid-Origin/duplicate-body rejection and concurrent-write checks were run with isolated, explicitly synthetic QA program inputs. Those checks are not human acceptance, an audit, customer activity, funding or a submitted contest entry.

## Use your own records

1. Open **Your reviews** and create a review with the program name and public NEAR treasury account.
2. Enter actual approved funding, funding received, reported closing balance and the funding terms. Unknowns are not inferred from a transaction.
3. Check each program USDC transaction. The app locks checked movement facts separately from your explanation/evidence references.
4. Explain payments and record unpaid obligations, including amounts owed outside the wallet.
5. Confirm the program/period coverage, review blockers and download the unsigned HTML packet or full JSON.

New workspaces are empty, not fictional examples. There is no sample/demo entry or known-transaction prefill. Existing older fictional data remains honestly labeled; it is not converted into real evidence. Creating another working review is confirmed and preserves a named copy when SQLite is enabled. Reopening a copy/import clears review/scope declarations for rechecking.

## Run locally

Use **Node 24.10.0**, pinned in `.nvmrc`.

```sh
npm ci --ignore-scripts --engine-strict
npm run dev
# http://127.0.0.1:5322
# If occupied: CLOSEOUT_PORT=5324 npm run dev
```

Local mode requires no build, wallet or RPC API key. The pinned Vercel Blob SDK is used only by the Vercel adapter. Node's built-in experimental SQLite warning is expected. The default is loopback-only; project-local `.local/closeout.sqlite` is private-permission plaintext, not encrypted. Successful form saves persist; unsubmitted typing does not. Access uses a rolling browser capability cookie, not a verified account/funder identity. Keep downloaded JSON backups. Clearing the cookie loses browser access. [Storage/recovery](docs/LOCAL_STORAGE.md).

## Capabilities and limits

- Exact six-decimal USDC BigInt arithmetic, no USD conversion/rounding/asset mixing.
- Missing evidence, incomplete scope, fixed/unclear terms, cash discrepancies and uncovered obligations block conditional return proposals. Zero and unknown are distinct.
- Mainnet Circle-USDC `ft_transfer` verification, including traceable DAO/relayer actions. One unambiguous successful issuer event/action/receipt graph is required. No transfer-and-call, wrapped assets, multiple/refunded movements or full wallet-history discovery is guessed. [Receipt scope](docs/NEAR_RECEIPTS.md).
- 20 named copies and the latest 30 recovery revisions per browser workspace. Revision protection applies across connections; history is bounded, not tamper-proof.
- JSON import ignores supplied assessment/approval/digest and strips checked chain facts. Matching explicit RPC recheck is required. No invoice fetching or document-authenticity claim.
- Self-contained escaped/script-free HTML review packet, JSON snapshot and browser Print/PDF. A snapshot digest identifies bytes, not authenticity or signatures.
- Native/no-JS forms, retained validation values, busy/error feedback, light/dark responsive interface and self-hosted OFL typography.

The app trusts fixed public HTTPS archival RPC, not independent consensus/Merkle verification. Terms, balances, purpose, documents, scope and reviews remain reporter claims. No market validation, audit or contest acceptance is established.

## Vercel persistence

Vercel uses the separate Node function adapter and a **private Blob store**, not SQLite on the temporary function filesystem. Saved work is AES-256-GCM encrypted with an operator-held key and bound to the workspace path; this is server-side encryption, not end-to-end privacy or funder authentication. Conditional ETag writes prevent concurrent overwrites. Origin-bound CSRF survives cold starts. Receipt-check limits persist across instances.

Hosted capacity is bounded: 128 browser workspaces, 1 MiB plaintext per workspace, up to 20 pinned copies and up to 30 recovery revisions within that budget. Older recovery entries may be pruned to stay within capacity; pinned copies are not silently deleted. The store does not expire records automatically. Free provider quotas are finite/shared at account level; exhausted quota fails saves honestly and may make the service unavailable. Keep private downloaded backups. No paid-plan upgrade is performed by code.

Production requires the project's private `BLOB_READ_WRITE_TOKEN` and a separate sensitive 32-byte hex `CLOSEOUT_DATA_KEY`. Keys/tokens must never be committed or exposed to the browser. Key loss/rotation without migration can make saved records unreadable. Deploy from a reviewed allowlist, not a private workspace/database. No product sample/prefill is added by this adapter.

## HTTPS/persistent-host configuration

An explicit HTTPS public origin, exact Host/Origin enforcement, Secure `__Host-` capability cookies and configurable persistent SQLite path are implemented. Runtime rejects public binding without an explicit origin and public mode without an explicit database path. Forwarded headers are not trusted to decide origin. [Configuration and container instructions](docs/DEPLOYMENT.md).

The container recipe runs non-root, has a narrow build context and requires operator configuration. **This is not a completed production/account-based SaaS:** identity, account recovery, ownership, retention/abuse/capacity and actual TLS/host setup need review before serving private financial records. No fake login, team roles, billing or cloud-sync claim is provided. Public deployment is not automatic, and ephemeral serverless storage is not durable SQLite. A single application instance and persistent private volume are required.

## Checks

```sh
npm run check
# Or: npm run typecheck && npm test
# Installed browser override: CHROME_PATH=/path/to/chrome npm run check
```

Checks cover exact accounting, source rejection/protection, invalid/stale forms, SQLite restart/isolation, import trust boundaries, customer creation/resume/replacement/export, no-JS, light/dark accessibility/responsiveness, public-origin/Host/cookie boundaries and configured process restart. Tests use explicitly labeled synthetic RPC transports; production start never imports their seed data. Historical actual mainnet evidence is separately recorded in `evidence/live-near-positive-v0.3.json`; it belongs to third parties, not our funding/customer/program activity, and is not a product sample feature.

Playwright uses installed Chrome/Chromium and its owned test port 5323; no automatic browser download. Test counts and local/container checks are not an independent audit, human usability acceptance or verification of an actual public TLS deployment.

## License / status

Original source is [MIT](LICENSE); [third-party notices](THIRD_PARTY_NOTICES.md) and bundled font OFL remain their own. The package is `private` only to prevent accidental npm publication.

Built for NEAR HACKATHON 2026. This source does not establish a hosted service, human public demo, event submission, eligibility, award or final consent. No reused external application/contract baseline is claimed. Submission requirements must be satisfied separately by the actual team.

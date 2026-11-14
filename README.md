# Funding closeout

**Close a funded program with an explanation for its money, not just a list of transactions.**

Built at **NEAR HACKATHON 2026**. Live app: **https://funding-closeout.vercel.app** · License: MIT.

## The problem

When a grant, bounty program or DAO-funded initiative ends, the funder asks three questions: where did the money go, what is still owed, and is anything left to return? Today program managers answer them by hand from block explorers, spreadsheets and invoices. A common mistake is treating the remaining wallet balance as "unused" or "refundable" funding, when part of it may already be owed to contributors.

## The product

Funding closeout is a hosted workflow for the program manager:

1. Create a review for one program and its public NEAR treasury account.
2. Record the funding terms and reported totals (approved, received, closing balance).
3. Check each USDC payment against NEAR mainnet.
4. Explain what each payment was for and reference supporting evidence.
5. Record money still owed (unpaid obligations).
6. Declare what the review covers (program and period).
7. Resolve blockers and export an unsigned closeout packet (HTML, printable to PDF, plus full JSON).

Missing terms, unexplained payments, incomplete scope, cash discrepancies or uncovered obligations block any return proposal. Unknown is never treated as zero. All money math is exact six-decimal USDC (BigInt), with no rounding or currency conversion.

## How NEAR fits in

The app reads NEAR mainnet through the public archival RPC (`https://archival-rpc.mainnet.near.org`) to confirm each payment's final facts: payer, recipient, amount and successful receipt execution of a Circle native USDC `ft_transfer` (contract `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`). It also follows Sputnik DAO and relayer payouts, where the signer and the paying account differ. Checked chain facts are locked separately from the human explanation, so the packet shows what the chain proves (money moved) apart from what the reporter claims (why it moved). No wallet connection, signing or fund movement is needed. Code: `src/near/verify.ts`, `src/near/facts.ts`, `src/near/review.ts`.

## Try it (do X, see Y)

1. Open https://funding-closeout.vercel.app and choose **Create a review**. You see a two-field form (program name, NEAR treasury account) and a preview of the six steps. No money is pre-filled.
2. Enter a program name and a public NEAR treasury account, then **Create review**. You land on step 1, **The deal**. The **Money picture** panel on the right shows "Not entered", not zero.
3. Enter the approved, received and closing amounts, choose what happens to unused money, say where the terms are written, then **Save and continue**. The panel now shows whether received − paid out = closing balance.
4. On **Payments**, paste a USDC transaction hash sent from that account and choose **Check on NEAR and add**. The payment appears with a **Checked on NEAR** badge and its payer, recipient and exact amount locked. To test with a real public transfer, use treasury account `dclv2.ref-labs.near` and transaction `HdnpGYxucfKSz9h5xcEczEazUC51aimH45s24t3wXDMK` (4.045481 USDC). It was signed by a different account than the payer, so open **Paid through a DAO or a relayer?** and enter signer `6d719d5af3eb0c53c99cb4b8f5798c51640a8a782e7c4a2d92ec04491220cfa9`. Without it, the app refuses and tells you which signer it saw. This is a third-party public transfer used only to test the check; it is not our program or funds.
5. Jump to **Report** without explaining the payment. You see **Not ready yet**, "Possibly returnable: Not established" and a **Finish these first** list, each item linking to the step that fixes it.
6. On **Explain**, say what the payment was for and where the proof is, tick the check box and **Save explanation**. On **Still owed**, add anything still unpaid. On **Coverage**, confirm both statements and **Save and see the report**.
7. With nothing missing, the report shows **Ready for review** and the possibly returnable amount. **Download review packet** gives a readable unsigned report (print to PDF); **Download statement** gives the full JSON backup.

## Hackathon build disclosure

- **Built during the event window.** All code in this repository was written on November 13–14, 2026, after the hackathon start. There is no pre-hackathon baseline code; the first commit (tag `v0.3.1`) and every later commit fall inside the window. Final submission state is tagged `hackathon-submission`.
- **AI-generated code.** Most of the application code, tests and documentation in this repository were generated with AI coding assistants (OpenAI Codex and Claude Code). The author directed the product decisions, reviewed the results and tested the live workflow.
- **Libraries and templates.** No starter template was used. Runtime dependency: `@vercel/blob` 2.9.0 (hosted storage adapter only). Development/test dependencies: TypeScript, Playwright, axe-core, Prettier and Node type definitions. The interface font is Hanken Grotesk (SIL OFL). Full list with versions and licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Local storage uses Node's built-in SQLite.

## Limits

This is a working, bounded review tool, not a full account-based SaaS. Access is tied to a browser cookie (no login, password recovery, teams or billing yet), so keep downloaded backups. It does not authenticate invoices, verify funder approval or execute refunds. A public transfer proves movement, not purpose, ownership, work completion or legal entitlement. The app trusts a fixed public HTTPS archival RPC rather than doing independent light-client verification.

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

Built at NEAR HACKATHON 2026. No reused external application or contract baseline. See [Hackathon build disclosure](#hackathon-build-disclosure).

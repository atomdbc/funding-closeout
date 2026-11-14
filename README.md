# Funding closeout

**Explain a funded program's money before proposing a return.** A 400-USDC balance is not 400 unused when 250 is still owed.

A local prototype built for NEAR HACKATHON 2026: final mainnet USDC receipt checks, reporter explanations, outstanding obligations and an unsigned human-review packet. No wallet connection, signing, new payment, paid service or external account is needed to run it.

## What it does

- Uses exact six-decimal USDC quantities with BigInt, not floating-point dollars.
- Records terms, payment explanations, evidence references and remaining obligations.
- Blocks a return proposal for unknown purpose, incomplete scope, unclear/fixed-award terms, cash discrepancies or uncovered commitments.
- Starts real NEAR reviews separately from the fictional example. Checks one final issuer-backed `ft_transfer`, including the actual payer when a DAO/relayer's transaction signer differs. Checked movement fields cannot be rewritten through the app.
- Autosaves successful edits to local SQLite, with 20 named copies and the latest 30 recovery revisions per browser workspace.
- Reopens JSON backups as **unverified claims**. Imported NEAR facts require an explicit matching RPC recheck; review/scope declarations are cleared.
- Downloads JSON and a self-contained, script-free HTML review packet for printing or saving as PDF.

It does **not** authenticate a funder decision, establish legal entitlement or automatically return funds. Movement alone does not prove purpose or work completion.

## Run

Use **Node 24.10.0**, pinned in `.nvmrc`.

```sh
git clone https://github.com/atomdbc/funding-closeout.git
cd funding-closeout
npm ci --ignore-scripts --engine-strict
npm run dev
# Open http://127.0.0.1:5322
# If occupied: CLOSEOUT_PORT=5324 npm run dev
```

No build step, wallet, API key or external database service is required. Node's built-in **experimental** SQLite API creates `.local/closeout.sqlite`. This is a single-machine local prototype; do not expose the server to a LAN or tunnel, or present ephemeral serverless storage as durable.

Local files have private permissions but are **not encrypted**. Each successful form save persists; unsubmitted typing does not. Reopen with the same browser profile and keep downloaded JSON backups. A rolling 30-day HttpOnly cookie is a workspace capability, not a verified identity. Clearing it loses browser access; there is no account-recovery service. [Storage and recovery details](docs/LOCAL_STORAGE.md).

## Demo: why 400 does not mean 400 returnable

1. The **fictional** example starts with 1,000 USDC received, 400 reported cash, 250 still owed and one unexplained 50-USDC outflow. No return proposal is established.
2. Open the unexplained payment. Classify it as a program expense, supply a fictional purpose/evidence reference, mark your review and save.
3. Confirm complete payment and commitment scope. The proposal becomes **150 USDC**, conditional on the supplied terms and declarations—not 400 and not a funder approval.
4. Change the support or obligations. The statement recalculates and relevant scope confirmations are revoked.
5. Save a named copy, restore a revision, or download the unsigned review packet. JSON imports do not become trustworthy by copying a digest or approval field.

Keep the example fictional. For public chain data, start a separate empty NEAR review.

## Reproduce a real read-only mainnet check

Choose **Start separate NEAR review**, confirm replacement of the working draft, and enter:

| Field                                    | Value                                                              |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Program treasury / actual transfer payer | `dclv2.ref-labs.near`                                              |
| Transaction hash                         | `HdnpGYxucfKSz9h5xcEczEazUC51aimH45s24t3wXDMK`                     |
| Transaction signer, if different         | `6d719d5af3eb0c53c99cb4b8f5798c51640a8a782e7c4a2d92ec04491220cfa9` |

Click **Check and add transfer**. Expected: **4.045481 USDC**, final successful issuer receipt, with payer and signer shown separately. Purpose stays unresolved; funding/balance stay Not entered. No new payment or private key is needed. If public RPC is unavailable/rate-limited, the app reports failure and never falls back to synthetic success.

**This is a pre-existing third-party movement—not our payment, grant, customer, deployment or evidence of work fulfillment.** Actual Node and browser lookup, named-copy saving, server/SQLite restart recovery and unsigned packet download were checked separately from synthetic automated tests. [Live-check record](evidence/live-near-positive-v0.3.json). Discovery used the public FastNear FT update index and NearData block 224496486; runtime verification uses only the fixed archival RPC.

Only Circle-issued NEAR mainnet USDC is supported: `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`, six decimals. Native NEAR, bridged USDC, multiple USDC movements/refund netting, transfer-and-call and multi-action token receipts are unsupported, not guessed. [Receipt scope and trust boundary](docs/NEAR_RECEIPTS.md).

## Tests

```sh
npm run check
# Without browser tests:
npm run typecheck && npm test
# Override installed Chrome detection:
CHROME_PATH=/path/to/chrome npm run check
```

**101 unit/HTTP tests and 21 browser tests** cover exact quantities, accounting blockers, malformed/ambiguous receipt rejection, protected facts, stale writes, SQLite restart/isolation, untrusted import/recheck, unsigned packets, no-JavaScript forms, accessibility and document overflow at 375/768/1280 in light/dark. Native fact panels and opened draft tools also have mobile light/dark checks.

Browser tests require installed Chrome/Chromium; they do not download one automatically. Playwright owns port 5323, uses a private temporary database and explicitly labeled synthetic RPC fixtures. Production never imports that fixture server. Actual mainnet positive/negative checks are separate; test counts are not an audit, human acceptance or customer validation.

## Boundaries and current status

Public HTTPS RPC is trusted, not independently consensus/Merkle-verified. Terms, balances, commitments, purpose, documents, coverage and review remain reporter claims. A digest identifies serialized snapshot bytes, not authenticity or approval. No full wallet-history discovery, document authentication, signed funder decisions or money execution exists. Local revision history is bounded and not tamper-proof. Existing grant products overlap parts of this workflow; a differentiated market gap and paid demand are not yet established.

This release provides a working local interface. Landing-page work, further visual refinement and the human public demo video are still pending. No hosted application, event submission or award is claimed. Development uses Node/TypeScript and pinned test tools; no other application codebase or deployed contract is reused.

## License

Original code is [MIT licensed](LICENSE). Dependency licenses remain their own; see [third-party notices](THIRD_PARTY_NOTICES.md). The package is marked `private` to prevent accidental npm publication, not because this GitHub repository is private.

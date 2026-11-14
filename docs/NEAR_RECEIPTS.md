# Read-only NEAR receipt verification

The app distinguishes checked movement facts from the reporter's explanation. A transfer does not establish program membership, purpose, wallet ownership, work completion, document authenticity or funder approval.

## What is checked

- NEAR **mainnet**, identified by a status query.
- Fixed HTTPS provider: `https://archival-rpc.mainnet.near.org`, a rate-limited public archival service.
- Read-only `status` and `EXPERIMENTAL_tx_status`, requesting `wait_until: FINAL`. `tx` is also in the transport's read-only allowlist; no signing/broadcast method is permitted. The experimental name is a documented deprecated alias and provider availability is not guaranteed.
- Circle-issued NEP-141 USDC, contract `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`, six decimals. “Native USDC” means issuer-native on NEAR, not the NEAR gas token or a wrapped token with the same symbol.
- One unambiguous issuer transfer event bound to its actual successful `ft_transfer` action, predecessor/payer and connected, acyclic final receipt graph. The original transaction signer may differ from the actual payer in a traceable DAO/relayer path.
- Request hash/signer, issuer executor, event payer/recipient/quantity, actual action arguments and final outcome must agree. Duplicate transaction/receipt references are not counted twice.

One successful-looking call is insufficient. Failed, incomplete, ambiguous or malformed evidence is rejected rather than guessed into a payment.

## Unsupported

Multiple USDC movements/refund netting, `ft_transfer_call`, multi-action token receipts, native NEAR, other/bridged USDC contracts and other currencies are unsupported. Rejection is **not** an accusation or proof that no other asset moved. There is no complete wallet-history indexer or current-balance oracle; funding and closing balances are entered by the reporter and remain Not entered/null until explicitly supplied.

## Resource and privacy limits

RPC response cap: 1 MB; 100 execution outcomes/receipt descriptors; 12-second request timeout. One check per session at a time, two-second session spacing and 20 checks/minute per app. No background polling, retry flood, redirects, arbitrary URL input, paid RPC key or provider-cap bypass. Unavailability is an error, never synthetic success.

Only public transaction/signer identifiers leave the process for RPC. Purpose, terms, budgets, notes and commitments do not. A slow lookup cannot overwrite a newer draft. Checked fields cannot be rewritten through normal app edits. Unsigned JSON imports discard verification and require rechecking; see [local storage](LOCAL_STORAGE.md).

The app **trusts the HTTPS RPC**; it does not independently verify consensus/Merkle/light-client proofs. A returned-payload digest identifies bytes, not authenticity or funder authorization. Local files/history are not tamper-proof.

## Reproducible live evidence

The root README gives a pre-existing public transaction for **4.045481 USDC** from `dclv2.ref-labs.near`. Actual Node reader and browser import, unresolved purpose, unknown balances, named-copy persistence, server/SQLite restart recovery and unsigned review-packet download were checked. [Live-check record](../evidence/live-near-positive-v0.3.json).

That movement belongs to others. It is not our funding, program, deployment, customer or evidence of grant/work fulfillment. Discovery used the public FastNear FT update index and NearData block 224496486, then verification used the app's fixed archival RPC; no discovery service is required at runtime and no independent-consensus claim is made.

Normal automated tests use explicitly labeled **test-fixture** transports with synthetic hashes/accounts. `tests/fixtures/server.ts` is test-only; production `server/start.ts` never imports it. Automated fixture successes are not promoted to live chain evidence. Actual negative probes also rejected a failed mainnet USDC call and unrelated/non-native movements; no transactions were issued to create either positive or negative samples.

## Protocol references

- https://docs.near.org/api/rpc/transactions — FINAL semantics and read-only transaction status.
- https://docs.near.org/api/rpc/providers — public archival provider/rate limits.
- https://developers.circle.com/stablecoins/usdc-contract-addresses — issuer contract.
- https://github.com/near/NEPs/blob/master/neps/nep-0141.md — fungible transfer/event standard.
- https://api.fastnear.com/v1/account/dclv2.ref-labs.near/ft — public discovery index; current values can change.
- https://mainnet.neardata.xyz/v0/block/224496486 — discovery block, not runtime verification dependency.

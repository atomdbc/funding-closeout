# Read-only NEAR receipt checks

`facts.ts` pins Circle's mainnet USDC contract and the public NEAR archival endpoint. `verify.ts` requests FINAL execution using the documented read-only transaction-status API, traverses the receipt graph, binds one issuer event to its actual ft_transfer action/payer and rejects ambiguous/failed/unsupported evidence. `review.ts` starts a separate empty NEAR workspace and imports locked movement facts with no purpose, evidence, review or approval invented.

No SDK, wallet, key, signature, broadcast, account creation, paid RPC or transaction is used. Only status and transaction read methods are allowed. No arbitrary endpoint/URL inputs or automatic polling. Public RPC is a trusted data source, not an independent consensus proof. See `docs/NEAR_RECEIPTS.md` for scope and verification limits.

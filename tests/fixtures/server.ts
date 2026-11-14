// Test-only launch target. Production server/start.ts never imports this file or fake RPC data.
import { createApp } from "./app.ts";
import { createNearReader, NearCheckError } from "../../src/near/verify.ts";
import { fixtureTransaction, HASH } from "./near.ts";
import { SqliteReviewRepository } from "../../server/storage.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const reader = createNearReader(async (method, params) => {
  if (method === "status") return { chain_id: "mainnet" };
  if ((params as { tx_hash: string }).tx_hash !== HASH)
    throw new NearCheckError(
      "unavailable",
      "Synthetic test RPC cannot confirm this transaction. No payment was added.",
    );
  return fixtureTransaction();
}, "test-fixture");
const dir = mkdtempSync(join(tmpdir(), "closeout-browser-"));
const repository = new SqliteReviewRepository(join(dir, "data", "test.sqlite"));
const server = createApp({ reader, repository });
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    server.closeAllConnections();
    server.close(() => {
      repository.close();
      rmSync(dir, { recursive: true, force: true });
      process.exit(0);
    });
  });
server.listen(5323, "127.0.0.1", () =>
  console.log("Test-fixture server, not live verification: 127.0.0.1:5323"),
);

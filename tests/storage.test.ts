import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SqliteReviewRepository,
  StorageConflict,
  ownerKey,
  restoreForReview,
} from "../server/storage.ts";
import { importStatement } from "../server/imports.ts";
import { reviewPacket } from "../server/packet.ts";
import { statement } from "../server/statements.ts";
import { exampleProgram } from "../src/domain/demo.ts";
import { assess } from "../src/domain/closeout.ts";
import { newNearReview, addCheckedTransfer } from "../src/near/review.ts";
import { parseTransfer } from "../src/near/verify.ts";
import { fixtureTransaction, HASH, TREASURY } from "./fixtures/near.ts";

const owner = ownerKey("test-browser-cookie"),
  other = ownerKey("another-browser");
function fixture(t: import("node:test").TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "closeout-store-")),
    path = join(dir, "data", "review.sqlite");
  const repo = new SqliteReviewRepository(path);
  t.after(() => {
    try {
      repo.close();
    } catch {}
    rmSync(dir, { recursive: true, force: true });
  });
  return { repo, path };
}

test("private local store survives restart, retaining exact units but not raw cookie capabilities", (t) => {
  const { repo, path } = fixture(t),
    p = exampleProgram();
  p.balance = "400.000001";
  repo.commit(owner, undefined, p, 1, "Initial");
  repo.close();
  const reopened = new SqliteReviewRepository(path);
  try {
    assert.equal(reopened.load(owner)!.program.balance, "400.000001");
    assert.equal(reopened.load(other), undefined);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(statSync(join(path, "..")).mode & 0o777, 0o700);
  } finally {
    reopened.close();
  }
});

test("stale cross-process saves cannot overwrite a newer revision", (t) => {
  const { repo, path } = fixture(t),
    p = exampleProgram();
  repo.commit(owner, undefined, p, 1, "Initial");
  const second = new SqliteReviewRepository(path);
  try {
    repo.commit(owner, 1, { ...p, name: "Newer" }, 2, "Edit");
    assert.throws(
      () => second.commit(owner, 1, { ...p, name: "Stale" }, 2, "Edit"),
      StorageConflict,
    );
    assert.equal(second.load(owner)!.program.name, "Newer");
    assert.equal(repo.history(owner).length, 2);
  } finally {
    second.close();
  }
});

test("history keeps latest 30 snapshots while named copies remain independently pinned", (t) => {
  const { repo } = fixture(t),
    p = exampleProgram();
  repo.commit(owner, undefined, p, 1, "Initial");
  repo.saveCopy(owner, 1, "Original");
  for (let n = 2; n <= 35; n++)
    repo.commit(owner, n - 1, { ...p, name: `Version ${n}` }, n, "Edit");
  assert.equal(repo.history(owner).length, 30);
  assert.equal(repo.history(owner)[0]!.revision, 35);
  assert.throws(() => repo.historical(owner, 1));
  const c = repo.copies(owner)[0]!;
  assert.equal(repo.copy(owner, c.id).name, p.name);
  assert.throws(() => repo.copy(other, c.id));
  assert.equal(repo.copies(other).length, 0);
  assert.throws(() => repo.deleteCopy(other, c.id));
  assert.equal(repo.copies(owner).length, 1);
  repo.deleteCopy(owner, c.id);
  assert.equal(repo.copies(owner).length, 0);
});

test("copy cap and invalid records fail without partial saves", (t) => {
  const { repo } = fixture(t),
    p = exampleProgram();
  repo.commit(owner, undefined, p, 1, "Initial");
  for (let n = 0; n < 20; n++) repo.saveCopy(owner, 1, `Copy ${n}`);
  assert.throws(() => repo.saveCopy(owner, 1, "Overflow"), /20 saved/);
  assert.equal(repo.copies(owner).length, 20);
  assert.throws(() =>
    repo.commit(owner, 1, { ...p, balance: "-1" }, 2, "Invalid"),
  );
  assert.equal(repo.load(owner)!.revision, 1);
  assert.equal(repo.history(owner).length, 1);
});

test("restore and import clear review/coverage declarations without mutating originals", () => {
  const p = exampleProgram();
  p.paymentsComplete = true;
  p.commitmentsComplete = true;
  const restored = restoreForReview(p),
    imported = importStatement(JSON.stringify(statement(p, 3)));
  for (const x of [restored, imported]) {
    assert.equal(x.paymentsComplete, false);
    assert.equal(x.commitmentsComplete, false);
    assert(x.payments.every((v) => !v.reviewed));
    assert(x.commitments.every((v) => !v.reviewed));
  }
  assert.equal(p.paymentsComplete, true);
  assert.equal(p.payments[0]!.reviewed, true);
});

test("unsigned JSON cannot promote even well-shaped public RPC facts into verified payments", () => {
  const f = parseTransfer(
    fixtureTransaction(),
    HASH,
    TREASURY,
    "test-fixture",
    "2026-11-14T08:00:00Z",
  );
  const p = addCheckedTransfer(newNearReview(TREASURY), f),
    exported = statement(p, 2);
  const imported = importStatement(
    JSON.stringify({
      ...exported,
      assessment: { readyForReview: true, returnProposal: "9999" },
      approval: "funder-approved",
      digestSha256: "faked",
    }),
  );
  assert.equal(imported.payments[0]!.chain, undefined);
  assert.equal(imported.payments[0]!.importedTransfer!.hash, HASH);
  assert.equal(imported.payments[0]!.importedTransfer!.basis, "test-fixture");
  assert.equal(assess(imported).returnProposal, null);
  assert.equal(statement(imported, 3).testFixtureData, true);
  const restored = restoreForReview(p);
  assert.equal(restored.payments[0]!.chain!.checkedAt, f.checkedAt);
});

for (const value of [
  "not JSON",
  JSON.stringify({ format: "wrong", inputs: {} }),
  JSON.stringify({ format: "funding-closeout-v2", inputs: { payments: {} } }),
  "x".repeat(262145),
])
  test(`invalid import rejected (${value.length} bytes)`, () =>
    assert.throws(() => importStatement(value)));

test("v1 example export remains importable; unsupported assets and duplicate references do not", () => {
  const p = exampleProgram();
  assert.equal(
    importStatement(
      JSON.stringify({ format: "funding-closeout-v1", inputs: p }),
    ).name,
    p.name,
  );
  assert.throws(() =>
    importStatement(
      JSON.stringify({
        format: "funding-closeout-v2",
        inputs: { ...p, asset: "NEAR" },
      }),
    ),
  );
  p.payments[1]!.reference = p.payments[0]!.reference;
  assert.throws(() =>
    importStatement(
      JSON.stringify({ format: "funding-closeout-v2", inputs: p }),
    ),
  );
});

test("offline human-review packet escapes records and does not contain active controls or fabricated approval", () => {
  const p = exampleProgram();
  p.name = '<script>alert("x")</script>';
  p.payments[0]!.purpose = '<img src=x onerror="alert(1)">';
  const html = reviewPacket(p, 1);
  assert.match(html, /FICTIONAL EXAMPLE/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<script|<img|<form|<input/i);
  assert.match(html, /UNSIGNED REVIEW PACKET/);
  assert.match(html, /250 USDC/);
  assert.match(html, /Conditional proposed return/);
  assert.match(html, /Not established/);
});

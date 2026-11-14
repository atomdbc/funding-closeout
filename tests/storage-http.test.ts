import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../server/app.ts";
import { SqliteReviewRepository, StorageError } from "../server/storage.ts";
import { statement } from "../server/statements.ts";
import { exampleProgram } from "../src/domain/demo.ts";
import { newNearReview, addCheckedTransfer } from "../src/near/review.ts";
import { parseTransfer } from "../src/near/verify.ts";
import { fixtureTransaction, HASH, TREASURY } from "./fixtures/near.ts";

async function setup(t: import("node:test").TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "closeout-http-")),
    path = join(dir, "private", "records.sqlite");
  let repository = new SqliteReviewRepository(path),
    server = createApp({
      repository,
      reader: {
        check: async () =>
          parseTransfer(
            fixtureTransaction(),
            HASH,
            TREASURY,
            "test-fixture",
            "2026-11-14T08:00:00Z",
          ),
      },
    }),
    url = "",
    cookie = "",
    token = "",
    revision = "";
  const listen = async () => {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const a = server.address();
    assert(a && typeof a !== "string");
    url = `http://127.0.0.1:${a.port}`;
  };
  const close = async () => {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    repository.close();
  };
  const load = async () => {
    const res = await fetch(url, { headers: cookie ? { Cookie: cookie } : {} }),
      html = await res.text();
    cookie = res.headers.get("set-cookie")!.split(";")[0]!;
    token = html.match(/name="token" value="([a-f0-9]+)"/)![1]!;
    revision = html.match(/name="revision" value="(\d+)"/)![1]!;
    return html;
  };
  await listen();
  await load();
  t.after(async () => {
    await close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    repository: () => repository,
    load,
    post: (fields: Record<string, string>) =>
      fetch(url + "/edit", {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: url,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          token,
          revision,
          form: "storage-import",
          ...fields,
        }),
        redirect: "manual",
      }),
    get: (path: string) => fetch(url + path, { headers: { Cookie: cookie } }),
    snapshot: async () =>
      (
        await fetch(url + "/statement.json", { headers: { Cookie: cookie } })
      ).json(),
    restart: async () => {
      await close();
      repository = new SqliteReviewRepository(path);
      server = createApp({ repository });
      await listen();
      return load();
    },
    token: () => token,
  };
}

test("browser workspace and named copies survive a server restart; old CSRF token does not", async (t) => {
  const c = await setup(t),
    oldToken = c.token();
  assert.equal(
    (await c.post({ action: "coverage", paymentsComplete: "on" })).status,
    303,
  );
  await c.load();
  assert.equal(
    (await c.post({ action: "save-copy", copyName: "Before restart" })).status,
    303,
  );
  const html = await c.restart();
  assert.match(html, /Before restart/);
  assert.equal((await c.snapshot()).inputs.paymentsComplete, true);
  assert.equal(
    (await c.post({ action: "coverage", token: oldToken })).status,
    403,
  );
  assert.equal((await c.post({ action: "coverage" })).status, 303);
});

test("opening a saved copy restores inputs as a new revision with declarations cleared", async (t) => {
  const c = await setup(t);
  await c.post({ action: "save-copy", copyName: "Original" });
  await c.post({
    action: "coverage",
    paymentsComplete: "on",
    commitmentsComplete: "on",
  });
  const html = await c.load();
  const id = html.match(/<option value="([a-f0-9-]{36})">Original/)![1]!;
  assert.equal((await c.post({ action: "open-copy", copyId: id })).status, 422);
  assert.equal(
    (await c.post({ action: "open-copy", copyId: id, confirm: "on" })).status,
    303,
  );
  const s = await c.snapshot();
  assert.equal(s.revision, 3);
  assert.equal(s.inputs.paymentsComplete, false);
  assert(s.inputs.payments.every((p: { reviewed: boolean }) => !p.reviewed));
});

test("history restores old input without overwriting intervening recovery snapshots", async (t) => {
  const c = await setup(t);
  await c.post({ action: "add-commitment" });
  await c.load();
  assert.equal((await c.snapshot()).inputs.commitments.length, 2);
  assert.equal(
    (
      await c.post({
        action: "restore-revision",
        historyRevision: "1",
        confirm: "on",
      })
    ).status,
    303,
  );
  const s = await c.snapshot();
  assert.equal(s.revision, 3);
  assert.equal(s.inputs.commitments.length, 1);
  assert.match(await c.load(), /Draft 2 — add-commitment/);
});

test("import is explicit, bounded and atomic; assessment/approval in the file are ignored", async (t) => {
  const c = await setup(t),
    p = exampleProgram();
  p.name = "Imported program";
  p.paymentsComplete = true;
  const source = JSON.stringify({
    ...statement(p, 99),
    approval: "signed-by-funder",
    assessment: { returnProposal: "400" },
  });
  assert.equal(
    (await c.post({ action: "import-statement", statementSource: source }))
      .status,
    422,
  );
  assert.equal(
    (
      await c.post({
        action: "import-statement",
        statementSource: source,
        confirm: "on",
      })
    ).status,
    303,
  );
  let s = await c.snapshot();
  assert.equal(s.inputs.name, "Imported program");
  assert.equal(s.inputs.paymentsComplete, false);
  assert.equal(s.approval, "not-signed");
  assert.equal(s.revision, 2);
  await c.load();
  assert.equal(
    (
      await c.post({
        action: "import-statement",
        statementSource: "x".repeat(262145),
        confirm: "on",
      })
    ).status,
    422,
  );
  s = await c.snapshot();
  assert.equal(s.revision, 2);
  assert.equal(s.inputs.name, "Imported program");
});

test("imported NEAR facts stay unverified until an explicit matching RPC recheck", async (t) => {
  const c = await setup(t),
    facts = parseTransfer(
      fixtureTransaction(),
      HASH,
      TREASURY,
      "test-fixture",
      "2026-11-14T08:00:00Z",
    );
  const p = addCheckedTransfer(newNearReview(TREASURY), facts);
  await c.post({
    action: "import-statement",
    statementSource: JSON.stringify(statement(p, 2)),
    confirm: "on",
  });
  let s = await c.snapshot();
  assert.equal(s.inputs.payments[0].chain, undefined);
  assert.equal(s.assessment.returnProposal, null);
  await c.load();
  assert.equal(
    (await c.post({ action: "recheck-payment", id: p.payments[0]!.id })).status,
    303,
  );
  s = await c.snapshot();
  assert.equal(s.inputs.payments[0].chain.basis, "test-fixture");
  assert.equal(s.inputs.payments[0].importedTransfer, undefined);
  assert.equal(s.inputs.payments[0].reviewed, false);
});

test("a mismatching imported amount cannot be promoted by a real-looking RPC response", async (t) => {
  const c = await setup(t),
    f = parseTransfer(
      fixtureTransaction(),
      HASH,
      TREASURY,
      "test-fixture",
      "2026-11-14T08:00:00Z",
    );
  const p = addCheckedTransfer(newNearReview(TREASURY), f);
  p.payments[0]!.amount = "49";
  delete p.payments[0]!.chain;
  p.payments[0]!.importedTransfer = {
    hash: HASH,
    signer: TREASURY,
    basis: "test-fixture",
  };
  await c.post({
    action: "import-statement",
    statementSource: JSON.stringify(statement(p, 1)),
    confirm: "on",
  });
  await c.load();
  assert.equal(
    (await c.post({ action: "recheck-payment", id: p.payments[0]!.id })).status,
    422,
  );
  assert.equal((await c.snapshot()).inputs.payments[0].chain, undefined);
});

test("a disk write failure is not reported as success and does not mutate the draft", async (t) => {
  const c = await setup(t);
  t.mock.method(c.repository(), "commit", () => {
    throw new StorageError("Local save failed; no changes applied.");
  });
  const response = await c.post({ action: "add-commitment" });
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Local save failed/);
  const s = await c.snapshot();
  assert.equal(s.revision, 1);
  assert.equal(s.inputs.commitments.length, 1);
});

test("review packet is an attachment for the current workspace, not an approved executable report", async (t) => {
  const c = await setup(t),
    r = await c.get("/review.html");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-disposition")!, /attachment/);
  assert.match(await r.text(), /UNSIGNED REVIEW PACKET/);
  assert.equal((await c.get("/.local/closeout.sqlite")).status, 404);
});

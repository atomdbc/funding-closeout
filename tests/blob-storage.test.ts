import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { once } from "node:events";
import {
  BlobReviewRepository,
  seal,
  open,
  dataKey,
  csrfForCookie,
} from "../server/blob-storage.ts";
import type { ObjectTransport } from "../server/blob-storage.ts";
import { StorageConflict } from "../server/storage.ts";
import { newNearReview } from "../src/near/review.ts";
import { emptyProgram } from "../src/domain/empty.ts";
import { createApp } from "../server/app.ts";
class MemoryObjects implements ObjectTransport {
  objects = new Map<string, { body: Buffer; etag: string }>();
  version = 0;
  fail = false;
  async read(path: string) {
    const x = this.objects.get(path);
    return x ? { body: Buffer.from(x.body), etag: x.etag } : null;
  }
  async write(path: string, body: Buffer, etag: string | null) {
    if (this.fail) throw new Error("Synthetic store outage");
    const current = this.objects.get(path);
    if ((current?.etag ?? null) !== etag) return false;
    this.objects.set(path, {
      body: Buffer.from(body),
      etag: `"${++this.version}"`,
    });
    return true;
  }
}
const key = dataKey("ab".repeat(32)),
  a = "a".repeat(64),
  b = "b".repeat(64);
function review(name = "Private review") {
  const p = newNearReview("treasury.near");
  p.name = name;
  return p;
}

test("AEAD encrypts records and binds them to their exact private object path", () => {
  const blob = seal(key, "owner-a", {
    purpose: "Private financial description",
  });
  assert.ok(!blob.includes(Buffer.from("Private financial")));
  assert.deepEqual(open(key, "owner-a", blob), {
    purpose: "Private financial description",
  });
  assert.throws(() => open(key, "owner-b", blob));
  blob[blob.length - 1] ^= 1;
  assert.throws(() => open(key, "owner-a", blob));
  assert.throws(() => dataKey("invalid"));
  assert.throws(() => seal(key, "x", { value: "x".repeat(1024 * 1024) }));
});
test("cold repository instances retain private records and isolate owners", async () => {
  const objects = new MemoryObjects();
  await new BlobReviewRepository(objects, key).commit(
    a,
    undefined,
    review("Owner A"),
    1,
    "Create",
  );
  await new BlobReviewRepository(objects, key).commit(
    b,
    undefined,
    review("Owner B"),
    1,
    "Create",
  );
  const repo = new BlobReviewRepository(objects, key);
  assert.equal((await repo.load(a))!.program.name, "Owner A");
  assert.equal((await repo.load(b))!.program.name, "Owner B");
  assert.ok(
    ![...objects.objects.values()].some((x) =>
      x.body.includes(Buffer.from("Owner A")),
    ),
  );
  const loaded = (await repo.load(a))!;
  loaded.program.name = "Not saved";
  assert.equal((await repo.load(a))!.program.name, "Owner A");
});
test("concurrent serverless writers cannot overwrite a newer revision", async () => {
  const objects = new MemoryObjects();
  await new BlobReviewRepository(objects, key).commit(
    a,
    undefined,
    review(),
    1,
    "Create",
  );
  const first = new BlobReviewRepository(objects, key),
    second = new BlobReviewRepository(objects, key);
  await first.load(a);
  await second.load(a);
  await first.commit(a, 1, review("First writer"), 2, "Edit");
  await assert.rejects(
    second.commit(a, 1, review("Stale writer"), 2, "Edit"),
    StorageConflict,
  );
  assert.equal(
    (await new BlobReviewRepository(objects, key).load(a))!.program.name,
    "First writer",
  );
});
test("failed write does not claim success or mutate the committed review", async () => {
  const objects = new MemoryObjects();
  await new BlobReviewRepository(objects, key).commit(
    a,
    undefined,
    review(),
    1,
    "Create",
  );
  objects.fail = true;
  await assert.rejects(
    new BlobReviewRepository(objects, key).commit(
      a,
      1,
      review("Lost edit"),
      2,
      "Edit",
    ),
  );
  objects.fail = false;
  assert.equal(
    (await new BlobReviewRepository(objects, key).load(a))!.program.name,
    "Private review",
  );
});
test("copies/history survive cold instances, are bounded and cannot cross owners", async () => {
  const objects = new MemoryObjects();
  await new BlobReviewRepository(objects, key).commit(
    a,
    undefined,
    review(),
    1,
    "Create",
  );
  for (let i = 2; i <= 35; i++)
    await new BlobReviewRepository(objects, key).commit(
      a,
      i - 1,
      review("Revision " + i),
      i,
      "Edit",
    );
  const repo = new BlobReviewRepository(objects, key);
  assert.equal((await repo.history(a)).length, 30);
  assert.equal((await repo.historical(a, 35)).name, "Revision 35");
  await assert.rejects(repo.historical(a, 1));
  for (let i = 0; i < 20; i++) await repo.saveCopy(a, 35, "Copy " + i);
  await assert.rejects(repo.saveCopy(a, 35, "Overflow"));
  const copies = await repo.copies(a);
  await assert.rejects(repo.copy(b, copies[0]!.id));
  await repo.deleteCopy(a, copies[0]!.id);
  assert.equal(
    (await new BlobReviewRepository(objects, key).copies(a)).length,
    19,
  );
});
test("workspace registry fails closed at 128 and read-only receipt budget is shared across instances", async () => {
  const objects = new MemoryObjects();
  const now = Date.now();
  for (let i = 0; i < 128; i++) {
    const owner = i.toString(16).padStart(64, "0");
    await new BlobReviewRepository(objects, key).commit(
      owner,
      undefined,
      emptyProgram(),
      1,
      "Create",
    );
  }
  await assert.rejects(
    new BlobReviewRepository(objects, key).commit(
      "f".repeat(64),
      undefined,
      emptyProgram(),
      1,
      "Too many",
    ),
  );
  for (let i = 0; i < 20; i++)
    await new BlobReviewRepository(objects, key).reserveCheck(
      i.toString(16).padStart(64, "0"),
      now,
    );
  await assert.rejects(
    new BlobReviewRepository(objects, key).reserveCheck(
      (20).toString(16).padStart(64, "0"),
      now,
    ),
  );
  await assert.rejects(
    new BlobReviewRepository(objects, key).reserveCheck(
      "0".repeat(64),
      now + 1000,
    ),
  );
});
test("stateless requests use stable origin-bound CSRF, private persistence and unchanged revision checks", async (t) => {
  const objects = new MemoryObjects(),
    origin = "https://app.example.test";
  const server = createServer((req, res) => {
    const app = createApp({
      repository: new BlobReviewRepository(objects, key),
      publicOrigin: origin,
      csrfToken: (cookie) => csrfForCookie(key, cookie, origin),
    });
    app.emit("request", req, res);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const addr = server.address();
  assert(addr && typeof addr !== "string");
  const raw = (
    path: string,
    headers: Record<string, string> = {},
    body?: string,
  ) =>
    new Promise<{
      status: number;
      headers: import("node:http").IncomingHttpHeaders;
      body: string;
    }>((resolve, reject) => {
      const req = request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method: body ? "POST" : "GET",
          headers: { host: "app.example.test", ...headers },
        },
        (res) => {
          let text = "";
          res.setEncoding("utf8");
          res.on("data", (c) => (text += c));
          res.on("end", () =>
            resolve({
              status: res.statusCode!,
              headers: res.headers,
              body: text,
            }),
          );
        },
      );
      req.on("error", reject);
      req.end(body);
    });
  const first = await raw("/app");
  assert.equal(first.status, 200);
  const cookie = first.headers["set-cookie"]![0]!.split(";")[0]!;
  const field = (name: string) =>
    first.body.match(new RegExp(`name="${name}" value="([^"]*)"`))![1]!;
  const body = new URLSearchParams({
    token: field("token"),
    revision: field("revision"),
    form: "create-form",
    action: "create-review",
    name: "Cold start review",
    treasury: "treasury.near",
  }).toString();
  assert.equal(
    (
      await raw(
        "/edit?return=reviews",
        { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
        body,
      )
    ).status,
    303,
  );
  const after = await raw("/app", { cookie });
  assert.match(after.body, /Cold start review/);
  assert.match(after.body, /encrypted private server storage/);
  const stale = await raw(
    "/edit?return=reviews",
    { cookie, origin, "content-type": "application/x-www-form-urlencoded" },
    body,
  );
  assert.equal(stale.status, 409);
  assert.notEqual(
    csrfForCookie(key, "cookie", origin),
    csrfForCookie(key, "cookie", "https://other.example.test"),
  );
});

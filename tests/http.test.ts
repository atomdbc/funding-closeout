import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { createApp } from "./fixtures/app.ts";

async function client(t: TestContext) {
  const server = createApp();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const page = await fetch(url + "/workspace");
  const html = await page.text();
  const cookie = page.headers.get("set-cookie")!.split(";")[0]!;
  const token = html.match(/name="token" value="([a-f0-9]+)"/)![1]!;
  const revision = html.match(/name="revision" value="(\d+)"/)![1]!;
  const get = (path: string) =>
    fetch(url + path, { headers: { Cookie: cookie } });
  const post = (
    fields: Record<string, string>,
    extra: Record<string, string> = {},
  ) =>
    fetch(url + "/edit", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: url,
        "Content-Type": "application/x-www-form-urlencoded",
        ...extra,
      },
      body: new URLSearchParams({
        token,
        revision,
        form: "coverage-form",
        action: "coverage",
        ...fields,
      }),
      redirect: "manual",
    });
  return { server, url, cookie, token, revision, html, get, post };
}

test("HTML app and assets are local; health states read-only on-demand NEAR checks", async (t) => {
  const c = await client(t);
  assert.match(c.html, /Fictional example/);
  assert.match(c.html, /Not established/);
  const page = await c.get("/workspace");
  // no-referrer suppresses Origin on native POST navigation in Chrome.
  assert.equal(page.headers.get("referrer-policy"), "same-origin");
  assert.match(
    page.headers.get("content-security-policy")!,
    /default-src 'none'/,
  );
  assert.equal((await c.get("/app.css")).status, 200);
  assert.equal((await c.get("/app.js")).status, 200);
  assert.equal(
    (await (await c.get("/api/health")).json()).nearReadOnlyEnabled,
    true,
  );
  assert.equal((await c.get("/missing")).status, 404);
});

test("form changes update only that browser's in-memory snapshot", async (t) => {
  const c = await client(t);
  assert.equal(
    (await c.post({ paymentsComplete: "on", commitmentsComplete: "on" }))
      .status,
    303,
  );
  const s = await (await c.get("/statement.json")).json();
  assert.equal(s.inputs.paymentsComplete, true);
  assert.equal(s.revision, 2);
  assert.equal(s.assessment.returnProposal, null);
  const other = await client(t);
  assert.equal(
    (await (await other.get("/statement.json")).json()).inputs.paymentsComplete,
    false,
  );
});

test("older tabs cannot overwrite changes or duplicate an action", async (t) => {
  const c = await client(t);
  await c.post({ paymentsComplete: "on" });
  const stale = await c.post({
    paymentsComplete: "on",
    commitmentsComplete: "on",
  });
  assert.equal(stale.status, 409);
  assert.match(await stale.text(), /older than your latest/);
  assert.equal((await (await c.get("/statement.json")).json()).revision, 2);
});

test("host, origin, CSRF token and form MIME are checked", async (t) => {
  const c = await client(t);
  assert.equal(
    (await c.post({}, { Origin: "https://evil.example" })).status,
    403,
  );
  assert.equal((await c.post({ token: "é".repeat(24) })).status, 403);
  assert.equal((await c.post({ token: "bad" })).status, 403);
  assert.equal(
    (await c.post({}, { "Content-Type": "application/json" })).status,
    415,
  );
  // Fetch normalizes Host; use a raw HTTP request to test the actual wire header.
  const badHostStatus = await new Promise<number>((resolve, reject) => {
    const request = httpRequest(
      c.url,
      { headers: { Host: "evil.example" } },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    request.on("error", reject);
    request.end();
  });
  assert.equal(badHostStatus, 403);
  assert.equal(
    (await fetch(c.url + "/api/health", { method: "POST" })).status,
    405,
  );
});

test("invalid edits retain input, explain the field and do not mutate state", async (t) => {
  const c = await client(t);
  const bad = await c.post({
    action: "terms",
    form: "terms-form",
    name: "Keep this name",
    approved: "1e3",
    received: "1000",
    balance: "400",
    policy: "return-unspent",
  });
  assert.equal(bad.status, 422);
  const text = await bad.text();
  assert.match(text, /Keep this name/);
  assert.match(text, /aria-invalid="true"/);
  const s = await (await c.get("/statement.json")).json();
  assert.equal(s.revision, 1);
  assert.equal(s.inputs.name, "Community tools pilot");
});

test("user-entered HTML is text, and exports omit cookies and CSRF tokens", async (t) => {
  const c = await client(t);
  await c.post({
    action: "terms",
    form: "terms-form",
    name: '<img src=x onerror="alert(1)">',
    approved: "1000",
    received: "1000",
    balance: "400",
    policy: "return-unspent",
    termsReference: "terms",
  });
  const html = await (await c.get("/workspace")).text();
  assert(!html.includes("<img src=x"));
  assert(html.includes("&lt;img"));
  const s = await c.get("/statement.json");
  assert.match(s.headers.get("content-disposition")!, /attachment/);
  const body = await s.text();
  assert(!body.includes(c.token));
  assert(!body.includes(c.cookie));
});

test("oversized forms are refused without applying changes", async (t) => {
  const c = await client(t);
  assert.equal((await c.post({ padding: "a".repeat(17000) })).status, 413);
  assert.equal((await (await c.get("/statement.json")).json()).revision, 1);
});

test("deleting a commitment revokes the previous coverage declaration", async (t) => {
  const c = await client(t);
  await c.post({ commitmentsComplete: "on" });
  const r = await c.post({
    revision: "2",
    action: "commitment",
    id: "due-docs",
    remove: "yes",
    form: "commitment-due-docs",
  });
  assert.equal(r.status, 303);
  const s = await (await c.get("/statement.json")).json();
  assert.equal(s.inputs.commitmentsComplete, false);
  assert.equal(s.inputs.commitments.length, 0);
});

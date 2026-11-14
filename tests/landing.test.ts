import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app.ts";
import type { ReviewRepository } from "../server/storage.ts";
import { renderLanding } from "../web/landing.ts";

test("product home sends customers to reviews and has no sample calls to action", () => {
  const html = renderLanding();
  assert.match(html, /Create a review/);
  assert.match(html, /Your reviews/);
  assert.ok(!/\/demo|sample|fictional|data-case|\/welcome\/packet/.test(html));
  assert.match(html, /No wallet connection/);
});
test("public product page and self-hosted assets do not touch storage, RPC or cookies", async (t) => {
  let touches = 0;
  const forbidden = () => {
    touches++;
    throw new Error("Forbidden");
  };
  const repository: ReviewRepository = {
    load: forbidden,
    commit: forbidden,
    copies: forbidden,
    saveCopy: forbidden,
    copy: forbidden,
    deleteCopy: forbidden,
    history: forbidden,
    historical: forbidden,
  };
  const server = createApp({
    repository,
    reader: { check: async () => forbidden() },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const addr = server.address();
  assert(addr && typeof addr !== "string");
  const base = `http://127.0.0.1:${addr.port}`;
  for (const path of [
    "/",
    "/welcome.css",
    "/landing.js",
    "/assets/hanken-grotesk-variable.ttf",
  ]) {
    const r = await fetch(base + path);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("set-cookie"), null);
    assert.match(
      r.headers.get("content-security-policy")!,
      /default-src 'none'/,
    );
  }
  const alias = await fetch(base + "/welcome", { redirect: "manual" });
  assert.equal(alias.status, 308);
  assert.equal(alias.headers.get("location"), "/");
  assert.equal((await fetch(base + "/?case=explained")).status, 400);
  assert.equal((await fetch(base + "/demo")).status, 404);
  assert.equal(touches, 0);
});

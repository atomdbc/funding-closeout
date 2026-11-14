import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rewrittenPath,
  trustedVercelOrigin,
} from "../server/vercel-handler.ts";
test("Vercel rewrite routes preserve only approved app paths and existing query fields", () => {
  assert.equal(rewrittenPath("/api/app?__route=home"), "/");
  assert.equal(
    rewrittenPath("/api/app?__route=guided&step=terms"),
    "/guided?step=terms",
  );
  assert.equal(
    rewrittenPath("/api/app?__route=edit&flow=payments"),
    "/edit?flow=payments",
  );
  for (const path of [
    "/api/app",
    "/api/app?__route=home&__route=edit",
    "/api/app?__route=https://evil.test",
    "/api/app?__route=__proto__",
  ])
    assert.throws(() => rewrittenPath(path));
});
test("Vercel origins come from exact configured deployment metadata, never forwarded/request values", () => {
  const env = {
    VERCEL_URL: "deployment.example.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "product.vercel.app",
  };
  assert.equal(
    trustedVercelOrigin("product.vercel.app", env),
    "https://product.vercel.app",
  );
  assert.equal(
    trustedVercelOrigin("deployment.example.vercel.app", env),
    "https://deployment.example.vercel.app",
  );
  assert.equal(trustedVercelOrigin("evil.vercel.app", env), undefined);
  assert.equal(
    trustedVercelOrigin("product.vercel.app.evil.test", env),
    undefined,
  );
  assert.equal(trustedVercelOrigin("product.vercel.app", {}), undefined);
});

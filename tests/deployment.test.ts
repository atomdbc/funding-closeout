import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import { createApp } from "../server/app.ts";
import { publicOrigin, runtimeConfig } from "../server/config.ts";

test("runtime defaults stay loopback/private and explicit deployment settings are required", () => {
  const local = runtimeConfig({});
  assert.equal(local.host, "127.0.0.1");
  assert.equal(local.port, 5322);
  assert.ok(local.database.endsWith("/.local/closeout.sqlite"));
  assert.equal(local.publicOrigin, undefined);
  assert.throws(() => runtimeConfig({ CLOSEOUT_BIND: "0.0.0.0" }));
  assert.throws(() =>
    runtimeConfig({ CLOSEOUT_PUBLIC_ORIGIN: "https://app.example.test" }),
  );
  const production = runtimeConfig({
    PORT: "3000",
    CLOSEOUT_PUBLIC_ORIGIN: "https://app.example.test/",
    CLOSEOUT_DB_PATH: "/data/reviews.sqlite",
  });
  assert.equal(production.port, 3000);
  assert.equal(production.host, "0.0.0.0");
  assert.equal(production.publicOrigin, "https://app.example.test");
  assert.equal(production.database, "/data/reviews.sqlite");
  assert.equal(
    runtimeConfig({ PORT: "3000", CLOSEOUT_PORT: "5324" }).port,
    5324,
  );
});
for (const value of [
  "",
  "http://app.example.test",
  "https://user:pass@app.example.test",
  "https://app.example.test/path",
  "https://app.example.test?x=y",
  "https://app.example.test#x",
  "https://app.example.test?",
  "https://app.example.test#",
  "https://app.exa\nmple.test",
  " https://app.example.test",
])
  test(`invalid public origin rejected: ${JSON.stringify(value)}`, () =>
    assert.throws(() => publicOrigin(value)));
for (const env of [
  { CLOSEOUT_PORT: "80" },
  { CLOSEOUT_PORT: "65536" },
  { CLOSEOUT_BIND: "example.test" },
  { CLOSEOUT_DB_PATH: "relative.sqlite" },
  { CLOSEOUT_DB_PATH: "/data/file.json" },
])
  test(`invalid runtime setting rejected ${Object.keys(env)[0]}`, () =>
    assert.throws(() => runtimeConfig(env)));

test("public mode keeps exact Host/Origin checks and uses secure host-only capability cookies", async (t) => {
  const server = createApp({ publicOrigin: "https://app.example.test" });
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
    method = "GET",
    headers: Record<string, string> = {},
    body = "",
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
          method,
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
  const denied = await raw("/app", "GET", {
    host: `127.0.0.1:${addr.port}`,
    "x-forwarded-host": "app.example.test",
    "x-forwarded-proto": "https",
  });
  assert.equal(denied.status, 403);
  const first = await raw("/app");
  assert.equal(first.status, 200);
  const set = first.headers["set-cookie"]![0]!;
  assert.match(set, /^__Host-closeout=/);
  for (const flag of ["Secure", "HttpOnly", "SameSite=Strict", "Path=/"])
    assert.ok(set.includes(flag));
  assert.ok(!set.includes("Domain="));
  assert.equal(first.headers["strict-transport-security"], "max-age=31536000");
  const cookie = set.split(";")[0]!,
    field = (name: string) =>
      first.body.match(new RegExp(`name="${name}" value="([^"]*)"`))![1]!;
  const body = new URLSearchParams({
    token: field("token"),
    revision: field("revision"),
    form: "create-form",
    action: "create-review",
    name: "Hosted review",
    treasury: "treasury.near",
  }).toString();
  for (const origin of ["http://app.example.test", "https://evil.example", ""])
    assert.equal(
      (
        await raw(
          "/edit?return=reviews",
          "POST",
          {
            cookie,
            origin,
            "content-type": "application/x-www-form-urlencoded",
          },
          body,
        )
      ).status,
      403,
    );
  const success = await raw(
    "/edit?return=reviews",
    "POST",
    {
      cookie,
      origin: "https://app.example.test",
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  );
  assert.equal(success.status, 303);
  assert.equal(success.headers.location, "/guided?step=terms");
  assert.match(success.headers["set-cookie"]![0]!, /; Secure/);
  const snapshot = await raw("/statement.json", "GET", { cookie });
  const state = JSON.parse(snapshot.body);
  assert.equal(state.inputs.name, "Hosted review");
  assert.equal(state.assessment.balance, null);
  assert.equal(state.inputs.payments.length, 0);
});

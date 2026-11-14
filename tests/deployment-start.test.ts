import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { request } from "node:http";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test(
  "configured server uses persistent volume and capability across a graceful process restart",
  { timeout: 20000 },
  async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "closeout-host-start-"));
    const probe = createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const address = probe.address();
    assert(address && typeof address !== "string");
    const port = address.port;
    await new Promise<void>((r) => probe.close(() => r()));
    const root = fileURLToPath(new URL("../", import.meta.url));
    let child: ChildProcess | undefined;
    async function stop() {
      if (!child || child.exitCode !== null) return;
      const done = once(child, "exit");
      child.kill("SIGTERM");
      await done;
    }
    t.after(async () => {
      await stop();
      rmSync(directory, { recursive: true, force: true });
    });
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
            port,
            path,
            method: body ? "POST" : "GET",
            headers: { host: "reviews.example.test", ...headers },
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
        req.setTimeout(1000, () => req.destroy());
        req.on("error", reject);
        req.end(body);
      });
    async function start() {
      child = spawn(process.execPath, ["server/start.ts"], {
        cwd: root,
        env: {
          ...process.env,
          CLOSEOUT_PORT: String(port),
          CLOSEOUT_BIND: "127.0.0.1",
          CLOSEOUT_PUBLIC_ORIGIN: "https://reviews.example.test",
          CLOSEOUT_DB_PATH: join(directory, "data", "review.sqlite"),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout?.on("data", (c) => (output += c));
      child.stderr?.on("data", (c) => (output += c));
      for (let i = 0; i < 60; i++) {
        if (child.exitCode !== null)
          throw new Error("Owned test process exited: " + output);
        try {
          const health = await raw("/api/health");
          if (health.status === 200) return;
        } catch {}
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error("Owned test process did not become healthy");
    }
    await start();
    const first = await raw("/app");
    assert.equal(first.status, 200);
    const cookie = first.headers["set-cookie"]![0]!.split(";")[0]!;
    assert.ok(cookie.startsWith("__Host-closeout_saved="));
    const getField = (name: string, html: string) =>
      html.match(new RegExp(`name="${name}" value="([^"]*)"`))![1]!;
    const body = new URLSearchParams({
      token: getField("token", first.body),
      revision: getField("revision", first.body),
      form: "create-form",
      action: "create-review",
      name: "Persistent private review",
      treasury: "treasury.near",
    }).toString();
    const created = await raw(
      "/edit?return=reviews",
      {
        cookie,
        origin: "https://reviews.example.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    );
    assert.equal(created.status, 303);
    await stop();
    await start();
    const resumed = await raw("/app", { cookie });
    assert.equal(resumed.status, 200);
    assert.match(resumed.body, /Persistent private review/);
    assert.notEqual(
      getField("token", resumed.body),
      getField("token", first.body),
    );
    const old = await raw(
      "/edit?return=reviews",
      {
        cookie,
        origin: "https://reviews.example.test",
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    );
    assert.equal(old.status, 403);
    const state = JSON.parse((await raw("/statement.json", { cookie })).body);
    assert.equal(state.inputs.name, "Persistent private review");
    assert.equal(state.assessment.balance, null);
    assert.deepEqual(state.inputs.payments, []);
  },
);

import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { createApp } from "./app.ts";
import { publicOrigin } from "./config.ts";
import {
  BlobReviewRepository,
  VercelObjectTransport,
  dataKey,
  csrfForCookie,
} from "./blob-storage.ts";

const routes: Record<string, string> = {
  home: "/",
  app: "/app",
  guided: "/guided",
  workspace: "/workspace",
  edit: "/edit",
  statement: "/statement.json",
  review: "/review.html",
  health: "/api/health",
  welcome: "/welcome",
};
export function rewrittenPath(url: string): string {
  const parsed = new URL(url, "http://function");
  const route = parsed.searchParams.get("__route");
  if (
    parsed.searchParams.getAll("__route").length !== 1 ||
    !route ||
    !Object.hasOwn(routes, route)
  )
    throw new Error("Unknown route");
  parsed.searchParams.delete("__route");
  return (
    routes[route] +
    (parsed.searchParams.size ? "?" + parsed.searchParams.toString() : "")
  );
}
export function trustedVercelOrigin(
  host: string | undefined,
  env: Record<string, string | undefined>,
): string | undefined {
  const candidates = [
    env.CLOSEOUT_PUBLIC_ORIGIN,
    ...[env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL]
      .filter(Boolean)
      .map((value) => "https://" + value),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const origin = publicOrigin(candidate);
    if (origin && new URL(origin).host === host) return origin;
  }
  return undefined;
}
export async function vercelHandler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const fail = (status: number, message: string) => {
    res.writeHead(status, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(message);
  };
  try {
    const origin = trustedVercelOrigin(req.headers.host, process.env);
    if (!origin) {
      fail(403, "Use the configured Funding closeout website.");
      return;
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.CLOSEOUT_DATA_KEY) {
      fail(
        503,
        "Private persistent storage is not configured. No successful save is claimed.",
      );
      return;
    }
    try {
      req.url = rewrittenPath(req.url ?? "");
    } catch {
      fail(404, "Page not found. Open /app.");
      return;
    }
    const key = dataKey(process.env.CLOSEOUT_DATA_KEY);
    const repository = new BlobReviewRepository(
      new VercelObjectTransport(process.env.BLOB_READ_WRITE_TOKEN),
      key,
    );
    const app = createApp({
      repository,
      publicOrigin: origin,
      csrfToken: (cookie) => csrfForCookie(key, cookie, origin),
      assetsRoot: join(process.cwd(), "web"),
    });
    await new Promise<void>((resolve, reject) => {
      res.once("finish", resolve);
      res.once("close", resolve);
      app.once("error", reject);
      app.emit("request", req, res);
    });
    app.removeAllListeners();
  } catch {
    if (!res.headersSent)
      fail(
        503,
        "The private review could not be loaded or saved. Keep your backup and retry later.",
      );
    else res.end();
  }
}

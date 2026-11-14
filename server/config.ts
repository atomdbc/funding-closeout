import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

/** Operator configuration only. Never derive this from requests/forwarded headers. */
export function publicOrigin(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!value || /[\u0000-\u0020?#]/.test(value))
    throw new Error("CLOSEOUT_PUBLIC_ORIGIN must be a single HTTPS origin.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CLOSEOUT_PUBLIC_ORIGIN must be a single HTTPS origin.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Public origin must be HTTPS with no credentials, path, query or fragment.",
    );
  return url.origin;
}
export function runtimeConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const origin = publicOrigin(env.CLOSEOUT_PUBLIC_ORIGIN);
  const raw = env.CLOSEOUT_PORT ?? env.PORT ?? "5322";
  if (!/^\d{4,5}$/.test(raw) || Number(raw) < 1024 || Number(raw) > 65535)
    throw new Error("Port must be an unused value from 1024 to 65535.");
  const host = env.CLOSEOUT_BIND ?? (origin ? "0.0.0.0" : "127.0.0.1");
  if (!["127.0.0.1", "0.0.0.0"].includes(host))
    throw new Error("CLOSEOUT_BIND must be 127.0.0.1 or 0.0.0.0.");
  if (host === "0.0.0.0" && !origin)
    throw new Error(
      "A public listener requires an explicitly configured HTTPS public origin.",
    );
  const database =
    env.CLOSEOUT_DB_PATH ??
    fileURLToPath(new URL("../.local/closeout.sqlite", import.meta.url));
  if (!isAbsolute(database) || !database.endsWith(".sqlite"))
    throw new Error("CLOSEOUT_DB_PATH must be an absolute .sqlite file path.");
  if (origin && !env.CLOSEOUT_DB_PATH)
    throw new Error(
      "Public mode requires CLOSEOUT_DB_PATH on an operator-provided persistent private volume.",
    );
  return {
    port: Number(raw),
    host: host as "127.0.0.1" | "0.0.0.0",
    database,
    publicOrigin: origin,
  };
}

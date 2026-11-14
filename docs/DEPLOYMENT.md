# HTTPS and persistent-host configuration

These are operator configuration instructions, not a claim that a public service is deployed or production/account-based SaaS is complete. Review identity/recovery, data retention, capacity/abuse and financial-data privacy before exposing the app. Cookie capability access is not verified identity or authenticated funder approval.

## Vercel adapter

The hosted app uses a separate private Vercel Blob store, **not SQLite in the ephemeral function filesystem**. `vercel.json` builds static assets and routes approved paths to `api/app.ts`. The root strict typecheck runs during build; the API's separate transpilation-only config avoids a Vercel compiler-context issue without disabling the strict root check. The browser entry script is named `landing-client.js` in source to avoid a compiled renderer/client basename collision.

Production environment needs its own `BLOB_READ_WRITE_TOKEN` and sensitive 64-hex `CLOSEOUT_DATA_KEY`. Keep these only in that project's server environment. No token/key is embedded in frontend assets, source or snapshots. Trusted platform deployment/production URL metadata supplies an exact HTTPS origin allowlist; request/forwarded values cannot invent one.

Each request uses a fresh encrypted repository with conditional ETag writes. AES-256-GCM binds each object to its path. Stable origin-bound CSRF works across cold functions; normal revision protection remains. A shared rate budget and per-workspace lease bound receipt checks. One MiB plaintext/workspace and 128 workspaces bound storage, with up to 20 pinned copies and up to 30 recovery revisions inside the byte budget. The service operator holds the encryption key; this is not end-to-end privacy, authenticated accounts or funder approval. Data does not auto-expire; lost keys/cookies require backups/recovery planning.

Hobby quotas are finite and shared at account level. Keep the app/store separate from unrelated projects, do not auto-upgrade, and do not claim unlimited availability. Quota/save errors must remain errors, not memory-only fallback success. Local mode remains SQLite and retains its previous data; Vercel does not upload or migrate a private local database automatically.

## Default: loopback only

With no public origin configured, startup binds `127.0.0.1`, accepts only its exact loopback Host/Origin and uses `.local/closeout.sqlite`. Local cookies and access behavior remain unchanged.

## Explicit public-origin mode

| Variable                 | Meaning                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `CLOSEOUT_PUBLIC_ORIGIN` | Your exact HTTPS origin, e.g. `https://reviews.example.org`; no credentials, path, query or fragment |
| `CLOSEOUT_DB_PATH`       | Absolute `.sqlite` path on a persistent private volume; mandatory in public mode                     |
| `CLOSEOUT_PORT` / `PORT` | Port 1024–65535; CLOSEOUT_PORT takes precedence                                                      |
| `CLOSEOUT_BIND`          | `127.0.0.1` or `0.0.0.0`; public binding requires the explicit HTTPS origin                          |

Public mode accepts only that Host and POST Origin, never arbitrary `X-Forwarded-Host/Proto` values. It uses Secure, HttpOnly, SameSite=Strict, Path=/, host-only `__Host-` capability cookies and HSTS (no subdomain/preload claim). These flags require the actual browser-facing connection to be HTTPS. TLS is terminated by an operator-controlled reverse proxy; Node itself is not a TLS server.

Configure the proxy to preserve the exact public Host, forward the original Origin, terminate valid TLS and prevent direct internet access to the raw application port. There are no wildcard hosts or arbitrary RPC endpoints. Do not strip Host/Origin protection to make a proxy work. Health probes must use the configured Host.

Use **one application instance**, a backed-up private persistent volume and tested restore. SQLite files are plaintext; 0700/0600 permissions are not encryption. A 30-day cookie is a bearer capability. No email/account reset service exists. A public URL does not make browser data portable across unrelated domains or prove treasury ownership.

## Container recipe

The Dockerfile uses the exact Node 24.10.0 release tag, a non-root user and a narrow `.dockerignore`. Record and pin the resolved platform image digest in the real deployment rather than assuming a mutable tag is an immutable supply-chain pin. The image has no npm runtime install. It fails startup without an explicit public HTTPS origin. `/data` must be persistent and writable by container UID 1000; never fix it with world-writable permissions.

Example for an **operator-approved local reverse proxy**, replacing the domain with one you actually control:

```sh
docker build -t funding-closeout:reviewed .
docker volume create closeout-data
docker run --name closeout --stop-timeout 35 \
  -p 127.0.0.1:3000:3000 \
  -e CLOSEOUT_PUBLIC_ORIGIN=https://reviews.example.org \
  -v closeout-data:/data funding-closeout:reviewed
```

Do not run these against a public host or incur charges without approval. No TLS proxy, domain, provider, certificate, account service or billing plan is provisioned by these commands. Avoid multiple replicas with this SQLite store. Docker graceful stop must allow active bounded saves/RPC checks to drain; restart must retain the same volume.

The image healthcheck sends the configured Host to internal `/api/health`. Server shutdown stops accepting requests, drains active work, then closes SQLite. Configuration tests validate Host/Origin/cookies and actual process restart; they are not a substitute for a real-host TLS/browser/persistence smoke test.

## Before external use

- Select and approve the host, volume, budget, domain and TLS proxy.
- Resolve account ownership/authentication/recovery or explicitly limit access to the bounded capability-based prototype. Do not market anonymous capability cookies as signed-in accounts or verified reviewers.
- Test real browser creation, save, restart, cross-browser isolation, invalid/stale requests, downloads, import/recheck and recovery through the actual HTTPS origin.
- Verify storage permissions/backups, quota limits, log redaction, retention and platform stop grace. Never deploy the private working database, drafts, environment files or research.
- Keep serverless ephemeral disks out of durability claims. No auto scaling, production audit or internet-scale account service is established.

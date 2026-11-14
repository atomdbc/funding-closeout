import { createApp } from "./app.ts";
import { runtimeConfig } from "./config.ts";
import { SqliteReviewRepository } from "./storage.ts";

// Validate the complete operator configuration before touching storage or opening a listener.
const config = runtimeConfig();
const repository = new SqliteReviewRepository(config.database);
const server = createApp({ repository, publicOrigin: config.publicOrigin });
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    if (closing) return;
    closing = true;
    // Let active native saves and bounded RPC reads finish before closing SQLite.
    const deadline = setTimeout(() => server.closeAllConnections(), 30000);
    deadline.unref();
    server.close(() => {
      clearTimeout(deadline);
      repository.close();
      process.exit(0);
    });
  });
server.once("error", () => {
  console.error(
    "Could not start the configured listener. Check the host/port and persistent volume; do not stop an unrelated service.",
  );
  repository.close();
  process.exitCode = 1;
});
server.listen(config.port, config.host, () => {
  console.log(
    `Funding closeout: ${config.publicOrigin ?? `http://127.0.0.1:${config.port}`}`,
  );
  console.log(
    config.publicOrigin
      ? "HTTPS public-origin mode configured. TLS must terminate at the approved reverse proxy. Use a persistent private volume and one application instance."
      : "Loopback-only mode. No public listener enabled.",
  );
  console.log(
    "Server-side SQLite saves enabled. Browser capability access is not verified identity. Keep backups; records are not encrypted. No wallet, signing or spending.",
  );
});

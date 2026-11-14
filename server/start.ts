import { createApp } from "./app.ts";
import { fileURLToPath } from "node:url";
import { SqliteReviewRepository } from "./storage.ts";

const rawPort = process.env.CLOSEOUT_PORT ?? "5322";
if (
  !/^\d{4,5}$/.test(rawPort) ||
  Number(rawPort) > 65535 ||
  Number(rawPort) < 1024
) {
  throw new Error("CLOSEOUT_PORT must be an unused port from 1024 to 65535.");
}
const port = Number(rawPort);
const repository = new SqliteReviewRepository(
  fileURLToPath(new URL("../.local/closeout.sqlite", import.meta.url)),
);
const server = createApp({ repository });
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    server.closeAllConnections();
    server.close(() => {
      repository.close();
      process.exit(0);
    });
  });
server.on("error", () => {
  console.error(
    `Could not start on 127.0.0.1:${port}. Check the listener; do not stop another project.`,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Funding closeout: http://127.0.0.1:${port}`);
  console.log(
    "Local autosave and named copies enabled. Public NEAR reads only; no wallet, signing or spending. Keep downloaded backups; local records are not encrypted.",
  );
});

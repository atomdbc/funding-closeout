import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
mkdirSync("public/assets", { recursive: true });
writeFileSync(
  "public/app.css",
  readFileSync("web/app.css", "utf8") +
    "\n" +
    readFileSync("web/near.css", "utf8"),
);
for (const [source, target] of [
  ["web/app.js", "public/app.js"],
  ["web/landing.css", "public/welcome.css"],
  ["web/flow.css", "public/flow.css"],
  ["web/landing-client.js", "public/landing.js"],
  [
    "web/assets/hanken-grotesk-variable.ttf",
    "public/assets/hanken-grotesk-variable.ttf",
  ],
  ["web/assets/HankenGrotesk-OFL.txt", "public/assets/HankenGrotesk-OFL.txt"],
])
  copyFileSync(source, target);
console.log(
  "Built static self-hosted assets. No credentials, database or private files copied.",
);

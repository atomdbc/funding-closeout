import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyProgram } from "../src/domain/empty.ts";
import { validateProgram } from "../src/domain/closeout.ts";
import type { Program, PaymentKind, Policy } from "../src/domain/closeout.ts";
import { units } from "../src/domain/money.ts";
import { projectStatus } from "../src/project.ts";
import { render } from "../web/view.ts";
import type { ViewState } from "../web/view.ts";
import { statement } from "./statements.ts";
import { createNearReader, NearCheckError } from "../src/near/verify.ts";
import { accountId, hashId } from "../src/near/facts.ts";
import type { TransferReader } from "../src/near/facts.ts";
import { addCheckedTransfer, newNearReview } from "../src/near/review.ts";
import {
  ownerKey,
  restoreForReview,
  StorageError,
  StorageConflict,
} from "./storage.ts";
import type { ReviewRepository } from "./storage.ts";
import { importStatement } from "./imports.ts";
import { reviewPacket } from "./packet.ts";
import { transferReference } from "../src/near/facts.ts";
import { renderLanding } from "../web/landing.ts";
import { renderStart } from "../web/start.ts";
import { guideStep, renderGuide } from "../web/guide.ts";
import { publicOrigin as parsePublicOrigin } from "./config.ts";

interface Session extends ViewState {
  owner: string;
  expires: number;
  checking?: boolean;
  lastCheck?: number;
}
class InputError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
  }
}
function amount(data: URLSearchParams, field: string): string {
  const value = (data.get(field) ?? "").trim();
  try {
    units(value);
  } catch {
    throw new InputError(
      field,
      "Use an amount from 0 to 999999999999, with up to 6 decimals and no commas.",
    );
  }
  return value;
}
function text(data: URLSearchParams, field: string, max = 1000): string {
  const value = (data.get(field) ?? "").trim();
  if (value.length > max)
    throw new InputError(field, `Use no more than ${max} characters.`);
  return value;
}
function update(
  program: Program,
  data: URLSearchParams,
): { program: Program; message: string } {
  const p = structuredClone(program),
    id = data.get("id"),
    action = data.get("action");
  if (action === "reset") {
    if (data.get("confirm") !== "on")
      throw new InputError(
        "confirm",
        "Confirm clearing the working review. Download a backup first.",
      );
    return {
      program: emptyProgram(),
      message:
        "Working review cleared. Named copies and recovery history are retained. No chain records were changed.",
    };
  }
  if (action === "create-review") {
    const name = text(data, "name", 100),
      treasury = text(data, "treasury", 64);
    if (!name) throw new InputError("name", "Enter a program name.");
    if (!accountId(treasury))
      throw new InputError(
        "treasury",
        "Enter a valid public NEAR treasury account, not a key or URL.",
      );
    if (!p.setupPending && data.get("confirm") !== "on")
      throw new InputError(
        "confirm",
        "Confirm creating another working review. Keep a backup of the current review.",
      );
    const review = newNearReview(treasury);
    review.name = name;
    return {
      program: review,
      message:
        "Review created. Enter the actual funding terms and reported totals. No transactions, funding or balance have been assumed.",
    };
  }
  if (
    p.setupPending &&
    !["import-statement", "open-copy", "restore-revision"].includes(
      action ?? "",
    )
  )
    throw new Error(
      "Create a review from Reviews before entering financial records.",
    );
  if (action === "start-near") {
    if (data.get("confirm") !== "on")
      throw new InputError(
        "confirm",
        "Confirm that starting an empty NEAR review replaces this local draft. Download it first if needed.",
      );
    const treasury = text(data, "treasury", 64);
    if (!accountId(treasury))
      throw new InputError(
        "treasury",
        "Enter a valid public NEAR account ID, not a key or URL.",
      );
    return {
      program: newNearReview(treasury),
      message:
        "Started a separate NEAR review. No example records were carried over and no wallet was connected. Enter the approved terms and reported balances; these are not inferred from a transfer.",
    };
  }
  if (action === "terms") {
    p.name = text(data, "name", 100);
    if (!p.name) throw new InputError("name", "Enter a program name.");
    p.approved = amount(data, "approved");
    p.received = amount(data, "received");
    p.balance = amount(data, "balance");
    p.policy = text(data, "policy") as Policy;
    p.termsReference = text(data, "termsReference");
    p.paymentsComplete = false;
    p.commitmentsComplete = false;
    if (p.chainReview) p.chainReview.totalsReported = true;
  } else if (action === "payment") {
    const row = p.payments.find((v) => v.id === id);
    if (!row)
      throw new Error(
        "This payment is no longer in the statement. Reload the page.",
      );
    p.paymentsComplete = false;
    if (data.get("remove") === "yes")
      p.payments = p.payments.filter((v) => v.id !== id);
    else {
      if (row.chain) {
        if (
          text(data, "recipient", 100) !== row.recipient ||
          amount(data, "amount") !== row.amount ||
          text(data, "reference", 150) !== row.reference
        )
          throw new Error(
            "RPC-checked sender, recipient, amount and reference cannot be edited. Remove the record if it is outside this program; do not rewrite chain facts.",
          );
      } else {
        row.recipient = text(data, "recipient", 100);
        row.amount = amount(data, "amount");
        row.reference = text(data, "reference", 150);
      }
      row.kind = text(data, "kind") as PaymentKind;
      row.purpose = text(data, "purpose");
      row.evidence = text(data, "evidence");
      row.reviewed = data.get("reviewed") === "on";
      if (
        row.reference &&
        p.payments.some(
          (v) => v.id !== id && v.reference.trim() === row.reference,
        )
      )
        throw new InputError(
          "reference",
          "This payment reference is already recorded. Do not count a transfer twice.",
        );
    }
  } else if (action === "commitment") {
    const row = p.commitments.find((v) => v.id === id);
    if (!row)
      throw new Error(
        "This commitment is no longer in the statement. Reload the page.",
      );
    p.commitmentsComplete = false;
    if (data.get("remove") === "yes")
      p.commitments = p.commitments.filter((v) => v.id !== id);
    else {
      row.payee = text(data, "payee", 100);
      row.remaining = amount(data, "remaining");
      row.purpose = text(data, "purpose");
      row.evidence = text(data, "evidence");
      row.reviewed = data.get("reviewed") === "on";
    }
  } else if (action === "add-payment") {
    if (p.chainReview)
      throw new Error(
        "Use Check and add transfer for a NEAR review. Do not mix manual or fictional payments into it.",
      );
    p.payments.push({
      id: `pay-${randomUUID()}`,
      recipient: "",
      amount: "0",
      reference: "",
      kind: "unresolved",
      purpose: "",
      evidence: "",
      reviewed: false,
    });
    p.paymentsComplete = false;
  } else if (action === "add-commitment") {
    p.commitments.push({
      id: `due-${randomUUID()}`,
      payee: "",
      remaining: "0",
      purpose: "",
      evidence: "",
      reviewed: false,
    });
    p.commitmentsComplete = false;
  } else if (action === "coverage") {
    p.paymentsComplete = data.get("paymentsComplete") === "on";
    p.commitmentsComplete = data.get("commitmentsComplete") === "on";
  } else
    throw new Error("This action is not available. Reload the review page.");
  validateProgram(p);
  return {
    program: p,
    message:
      "Saved locally. The closeout statement has been recalculated; this app performed no approval or transfer.",
  };
}

/** Loopback-only review app. Fixed public read-only NEAR RPC; no wallet, signing or arbitrary URL fetches. */
export function createApp(
  options: {
    reader?: TransferReader;
    repository?: ReviewRepository;
    initialProgram?: Program;
    publicOrigin?: string;
    csrfToken?: (cookie: string) => string;
    assetsRoot?: string;
  } = {},
) {
  const configuredOrigin = parsePublicOrigin(options.publicOrigin);
  const reader = options.reader ?? createNearReader();
  const repository = options.repository;
  async function view(s: Session): Promise<ViewState> {
    return {
      ...s,
      hosted: !!configuredOrigin,
      cloudStorage: repository?.kind === "private-blob",
      archive: repository
        ? {
            copies: await repository.copies(s.owner),
            history: await repository.history(s.owner),
          }
        : undefined,
    };
  }
  const asset = (name: string) =>
    options.assetsRoot
      ? join(options.assetsRoot, name)
      : new URL("../web/" + name, import.meta.url);
  const checks: number[] = [];
  const sessions = new Map<string, Session>();
  const css = Buffer.concat([
    readFileSync(asset("app.css")),
    Buffer.from("\n"),
    readFileSync(asset("near.css")),
  ]);
  const js = readFileSync(asset("app.js"));
  const landingCss = readFileSync(asset("landing.css"));
  const landingJs = readFileSync(asset("landing-client.js"));
  const landingFont = readFileSync(asset("assets/hanken-grotesk-variable.ttf"));
  const server = createServer(
    { maxHeaderSize: 8192, requestTimeout: 10000 },
    (request, response) => {
      void handle(request, response);
    },
  );
  function send(
    response: ServerResponse,
    status: number,
    type: string,
    body: string | Buffer,
  ) {
    response.writeHead(status, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
    response.end(body);
  }
  async function handle(request: IncomingMessage, response: ServerResponse) {
    try {
      const address = server.address(),
        port = typeof address === "object" && address ? address.port : 5322;
      const hosts = configuredOrigin
        ? [new URL(configuredOrigin).host]
        : [`127.0.0.1:${port}`, `localhost:${port}`];
      const origins = configuredOrigin
        ? [configuredOrigin]
        : hosts.map((h) => `http://${h}`);
      if (configuredOrigin)
        response.setHeader("Strict-Transport-Security", "max-age=31536000");
      if (!hosts.includes(request.headers.host ?? ""))
        return send(
          response,
          403,
          "text/plain",
          configuredOrigin
            ? "Use the configured public origin."
            : "Use the loopback address printed by npm run dev.",
        );
      const path = request.url?.split("?")[0];
      const query = new URL(request.url ?? "/", "http://localhost")
        .searchParams;
      let flow: ReturnType<typeof guideStep> | undefined;
      const returningToReviews = query.get("return") === "reviews";
      try {
        if (path === "/guided") flow = guideStep(query);
        if (path === "/edit" && query.has("flow"))
          flow = guideStep(query, "flow");
        if (flow) {
          if (query.has("sample"))
            throw new Error(
              "Sample inputs are not supported. Enter your own program records.",
            );
        }
      } catch (error) {
        return send(
          response,
          400,
          "text/plain",
          error instanceof Error
            ? error.message
            : "Choose a valid review step.",
        );
      }
      const present = (state: ViewState) =>
        path === "/app" || returningToReviews
          ? renderStart(state)
          : flow
            ? renderGuide(state, flow)
            : render(state);
      const expectedMethod = path === "/edit" ? "POST" : "GET";
      if (request.method !== expectedMethod) {
        response.setHeader("Allow", expectedMethod);
        return send(response, 405, "text/plain", `Use ${expectedMethod}.`);
      }
      if (path === "/api/health")
        return send(
          response,
          200,
          "application/json",
          JSON.stringify({
            ...projectStatus(),
            storage: repository
              ? (repository.kind ?? "local-sqlite")
              : "session-memory",
          }),
        );
      if (path === "/welcome.css")
        return send(response, 200, "text/css; charset=utf-8", landingCss);
      if (path === "/landing.js")
        return send(response, 200, "text/javascript; charset=utf-8", landingJs);
      if (path === "/assets/hanken-grotesk-variable.ttf")
        return send(response, 200, "font/ttf", landingFont);
      if (path === "/welcome") {
        const query = new URL(request.url!, "http://localhost").search;
        response.writeHead(308, {
          Location: `/${query}`,
          "Cache-Control": "no-store",
        });
        return response.end();
      }
      if (path === "/") {
        if (query.has("case"))
          return send(
            response,
            400,
            "text/plain",
            "Example scenarios are no longer available. Start your review at /app.",
          );
        return send(response, 200, "text/html; charset=utf-8", renderLanding());
      }
      if (path === "/app.css")
        return send(response, 200, "text/css; charset=utf-8", css);
      if (path === "/app.js")
        return send(response, 200, "text/javascript; charset=utf-8", js);
      if (
        ![
          "/app",
          "/workspace",
          "/guided",
          "/edit",
          "/statement.json",
          "/review.html",
        ].includes(path ?? "")
      )
        return send(response, 404, "text/plain", "Page not found. Return to /");
      const now = Date.now();
      for (const [id, s] of sessions) if (s.expires <= now) sessions.delete(id);
      const cookieName = `${configuredOrigin ? "__Host-" : ""}${repository ? "closeout_saved" : "closeout"}`;
      const secureCookie = configuredOrigin ? "; Secure" : "";
      const cookie = request.headers.cookie
        ?.split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith(`${cookieName}=`))
        ?.slice(cookieName.length + 1);
      let session = cookie ? sessions.get(cookie) : undefined;
      if (!session && cookie && /^[a-f0-9]{48}$/.test(cookie) && repository) {
        const saved = await repository.load(ownerKey(cookie));
        if (saved) {
          session = {
            ...saved,
            owner: ownerKey(cookie),
            token:
              options.csrfToken?.(cookie) ?? randomBytes(24).toString("hex"),
            expires: now + 8 * 60 * 60 * 1000,
          };
          if (sessions.size >= 64)
            return send(
              response,
              503,
              "text/plain",
              "Too many active local sessions. Your saved records are unchanged.",
            );
          sessions.set(cookie, session);
        }
      }
      if (!session) {
        if (request.method === "POST")
          return send(
            response,
            409,
            "text/plain",
            "Your local session expired. Open /app to resume or start a review; no changes were applied.",
          );
        if (sessions.size >= 64)
          return send(
            response,
            503,
            "text/plain",
            "Too many local review sessions. Close old sessions or restart the local server.",
          );
        const id = randomBytes(24).toString("hex");
        session = {
          program: structuredClone(options.initialProgram ?? emptyProgram()),
          owner: ownerKey(id),
          revision: 1,
          token: options.csrfToken?.(id) ?? randomBytes(24).toString("hex"),
          expires: now + 8 * 60 * 60 * 1000,
        };
        await repository?.commit(
          session.owner,
          undefined,
          session.program,
          1,
          options.initialProgram
            ? "Load explicit test fixture"
            : "Initialize empty review",
        );
        sessions.set(id, session);
        response.setHeader(
          "Set-Cookie",
          `${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${repository ? 2592000 : 28800}${secureCookie}`,
        );
      }
      session.expires = now + 8 * 60 * 60 * 1000;
      if (cookie && sessions.get(cookie) === session) {
        response.setHeader(
          "Set-Cookie",
          `${cookieName}=${cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${repository ? 2592000 : 28800}${secureCookie}`,
        );
      }
      if (repository) {
        const latest = await repository.load(session.owner);
        if (!latest)
          throw new StorageError(
            "The local review is unavailable; no replacement was created.",
          );
        session.program = latest.program;
        session.revision = latest.revision;
      }
      if (path === "/review.html") {
        response.setHeader(
          "Content-Disposition",
          'attachment; filename="closeout-review.html"',
        );
        return send(
          response,
          200,
          "text/html; charset=utf-8",
          reviewPacket(session.program, session.revision),
        );
      }
      if (path === "/statement.json") {
        response.setHeader(
          "Content-Disposition",
          'attachment; filename="funding-closeout.json"',
        );
        return send(
          response,
          200,
          "application/json; charset=utf-8",
          JSON.stringify(statement(session.program, session.revision), null, 2),
        );
      }
      if (path === "/edit") {
        if (!origins.includes(request.headers.origin ?? ""))
          return send(
            response,
            403,
            "text/plain",
            "Only forms from this review's configured origin may make changes.",
          );
        if (
          request.headers["content-type"]?.split(";")[0] !==
          "application/x-www-form-urlencoded"
        )
          return send(
            response,
            415,
            "text/plain",
            "Submit the local review form.",
          );
        let size = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
          const b = Buffer.from(chunk);
          size += b.length;
          if (size > 1048576) {
            response.setHeader("Connection", "close");
            return send(
              response,
              413,
              "text/plain",
              "This form is too large. Use shorter evidence references.",
            );
          }
          chunks.push(b);
        }
        const data = new URLSearchParams(
          Buffer.concat(chunks).toString("utf8"),
        );
        if (size > 16384 && data.get("action") !== "import-statement")
          return send(
            response,
            413,
            "text/plain",
            "This form is too large. Use shorter evidence references.",
          );
        const names = [...data.keys()];
        if (new Set(names).size !== names.length)
          return send(
            response,
            400,
            "text/plain",
            "Repeated form fields are not accepted.",
          );
        const supplied = data.get("token") ?? "";
        if (
          Buffer.byteLength(supplied) !== Buffer.byteLength(session.token) ||
          !timingSafeEqual(Buffer.from(supplied), Buffer.from(session.token))
        )
          return send(
            response,
            403,
            "text/plain",
            "The form could not be verified. Reload the page.",
          );
        const form = data.get("form") ?? "";
        try {
          if (data.get("revision") !== String(session.revision))
            throw new Error(
              "This page is older than your latest changes. Review the current statement before saving again.",
            );
          let result: { program: Program; message: string };
          const action = data.get("action");
          if (action === "save-copy" || action === "delete-copy") {
            if (!repository)
              throw new Error(
                "Saved copies are unavailable in this temporary test session.",
              );
            if (action === "save-copy")
              await repository.saveCopy(
                session.owner,
                session.revision,
                text(data, "copyName", 100),
              );
            else {
              if (data.get("confirm") !== "on")
                throw new InputError(
                  "confirm",
                  "Confirm deletion of this saved copy. The current working draft is not deleted.",
                );
              await repository.deleteCopy(
                session.owner,
                text(data, "copyId", 80),
              );
            }
            session.message =
              action === "save-copy"
                ? configuredOrigin
                  ? "Named copy saved on this server. Keep a downloaded backup too."
                  : "Named copy saved on this computer. Keep a downloaded backup too."
                : "Saved copy deleted. The working draft and recent history are unchanged.";
            response.writeHead(303, {
              Location: returningToReviews ? "/app" : "/workspace#saved-work",
              "Cache-Control": "no-store",
            });
            return response.end();
          }
          if (
            action === "open-copy" ||
            action === "restore-revision" ||
            action === "import-statement"
          ) {
            if (data.get("confirm") !== "on")
              throw new InputError(
                "confirm",
                "Confirm replacing the working draft. Download a backup first if needed.",
              );
            if (action === "import-statement")
              result = {
                program: importStatement(data.get("statementSource") ?? ""),
                message:
                  "Imported as unverified claims. Review and coverage marks were cleared. NEAR transfer facts from a file are not trusted: check each imported transfer again before relying on it.",
              };
            else {
              if (!repository)
                throw new Error(
                  "Saved local history is unavailable in this temporary session.",
                );
              const previous =
                action === "open-copy"
                  ? await repository.copy(
                      session.owner,
                      text(data, "copyId", 80),
                    )
                  : await repository.historical(
                      session.owner,
                      Number(data.get("historyRevision")),
                    );
              result = {
                program: restoreForReview(previous),
                message:
                  "Local snapshot reopened. Review and scope marks were cleared. Any prior RPC checks retain their original check times; they were not refreshed, signed or approved.",
              };
            }
          } else if (
            action === "check-transfer" ||
            action === "recheck-payment"
          ) {
            const treasury = session.program.chainReview?.treasury;
            if (!treasury)
              throw new Error(
                "Start a separate NEAR review before checking a real transfer.",
              );
            const imported =
              action === "recheck-payment"
                ? session.program.payments.find((p) => p.id === data.get("id"))
                : undefined;
            if (action === "recheck-payment" && !imported?.importedTransfer)
              throw new Error(
                "That imported movement is unavailable or has already been checked.",
              );
            const hash =
              imported?.importedTransfer?.hash ??
              text(data, "transactionHash", 44);
            if (!hashId(hash))
              throw new InputError(
                "transactionHash",
                "Enter the 32-byte base58 NEAR transaction hash, not an explorer URL or key.",
              );
            const signer =
              imported?.importedTransfer?.signer ??
              (text(data, "transactionSigner", 64) || treasury);
            if (!accountId(signer))
              throw new InputError(
                "transactionSigner",
                "Enter the public account that signed the original transaction, not a key or URL.",
              );
            if (session.checking)
              throw new Error(
                "A receipt check is already running. Wait for its result.",
              );
            const started = Date.now();
            while (checks[0] !== undefined && checks[0] < started - 60000)
              checks.shift();
            if (
              checks.length >= 20 ||
              (session.lastCheck && started - session.lastCheck < 2000)
            )
              throw new Error(
                "Receipt checks are temporarily rate limited. Wait before trying again; no payment was added.",
              );
            await repository?.reserveCheck?.(session.owner, started);
            checks.push(started);
            session.lastCheck = started;
            session.checking = true;
            try {
              const expectedRevision = session.revision;
              const facts = await reader.check(hash, treasury, signer);
              if (
                session.revision !== expectedRevision ||
                session.program.chainReview?.treasury !== treasury
              )
                throw new Error(
                  "The draft changed during the receipt check. Review the latest draft and check again; no transfer was added.",
                );
              if (
                facts.transactionHash !== hash ||
                facts.sender !== treasury ||
                facts.transactionSigner !== signer
              )
                throw new Error(
                  "Returned transfer facts do not match this request.",
                );
              let checkedProgram: Program;
              if (imported) {
                if (
                  units(imported.amount).toString() !== facts.rawAmount ||
                  imported.recipient !== facts.recipient ||
                  imported.reference !== transferReference(facts)
                )
                  throw new Error(
                    "The imported claim does not match the live transfer. Nothing was promoted to checked fact. Review the claim or remove it and check the transfer separately.",
                  );
                checkedProgram = structuredClone(session.program);
                const row = checkedProgram.payments.find(
                  (p) => p.id === imported.id,
                )!;
                delete row.importedTransfer;
                row.chain = facts;
                row.reviewed = false;
                checkedProgram.paymentsComplete = false;
                validateProgram(checkedProgram);
              } else
                checkedProgram = addCheckedTransfer(session.program, facts);
              result = {
                program: checkedProgram,
                message:
                  facts.basis === "public-rpc"
                    ? "Final native USDC transfer checked against public NEAR RPC and added. Its purpose, program membership and evidence still need your review. No funds moved through this app."
                    : "Test fixture transfer added. This is synthetic test evidence, not a live RPC verification.",
              };
            } finally {
              session.checking = false;
            }
          } else result = update(session.program, data);
          if (configuredOrigin)
            result.message = result.message.replace(
              /^Saved locally\./,
              "Saved on server.",
            );
          if (
            action === "create-review" &&
            !session.program.setupPending &&
            repository
          )
            await repository.saveCopy(
              session.owner,
              session.revision,
              session.program.name.slice(0, 100),
            );
          await repository?.commit(
            session.owner,
            session.revision,
            result.program,
            session.revision + 1,
            String(data.get("action") ?? "Edit"),
          );
          session.program = result.program;
          session.revision += 1;
          session.message = result.message;
          response.writeHead(303, {
            Location:
              action === "create-review"
                ? "/guided?step=terms"
                : returningToReviews
                  ? "/app"
                  : flow
                    ? `/guided?step=${action === "check-transfer" ? "payments" : flow}`
                    : `/workspace#${encodeURIComponent(action === "check-transfer" ? `payment-${result.program.payments.at(-1)!.id}` : form)}`,
            "Cache-Control": "no-store",
          });
          return response.end();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "The form could not be saved.";
          return send(
            response,
            data.get("revision") !== String(session.revision) ||
              error instanceof StorageConflict
              ? 409
              : error instanceof StorageError
                ? 503
                : error instanceof NearCheckError &&
                    error.code === "unavailable"
                  ? 503
                  : 422,
            "text/html; charset=utf-8",
            present({
              ...(await view(session)),
              error: {
                form,
                field: error instanceof InputError ? error.field : "",
                message,
                values: data,
              },
            }),
          );
        }
      }
      if (path === "/guided" && session.program.setupPending) {
        response.writeHead(303, {
          Location: "/app",
          "Cache-Control": "no-store",
        });
        return response.end();
      }
      const html = present(await view(session));
      delete session.message;
      return send(response, 200, "text/html; charset=utf-8", html);
    } catch (error) {
      if (error instanceof StorageError && !response.headersSent)
        return send(response, 503, "text/plain", error.message);
      if (!response.headersSent)
        send(
          response,
          500,
          "text/plain",
          "The local review could not be loaded. Reload the page. No failed edit is applied.",
        );
      else response.end();
    }
  }
  return server;
}

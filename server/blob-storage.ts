import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type { Program } from "../src/domain/closeout.ts";
import { validateProgram } from "../src/domain/closeout.ts";
import { StorageError, StorageConflict } from "./storage.ts";
import type {
  ReviewRepository,
  StoredReview,
  HistoryEntry,
  SavedCopy,
} from "./storage.ts";

export interface ObjectTransport {
  read(path: string): Promise<{ body: Buffer; etag: string } | null>;
  write(path: string, body: Buffer, etag: string | null): Promise<boolean>;
}
const MAX = 1024 * 1024;
const prefix = "funding-closeout/v1/";
export class VercelObjectTransport implements ObjectTransport {
  private token: string;
  constructor(token: string) {
    this.token = token;
    if (!token) throw new StorageError("Private storage is not configured.");
  }
  async read(path: string) {
    try {
      const result = await get(path, {
        access: "private",
        token: this.token,
        useCache: false,
        abortSignal: AbortSignal.timeout(6000),
      });
      if (!result) return null;
      if (result.statusCode !== 200 || result.blob.size > MAX + 64)
        throw new Error("Invalid object");
      const reader = result.stream.getReader(),
        chunks: Buffer[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX + 64) {
            await reader.cancel();
            throw new Error("Object too large");
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }
      return {
        body: Buffer.concat(chunks),
        etag: result.blob.etag.replace(/^W\//, ""),
      };
    } catch {
      throw new StorageError(
        "Private storage could not be read. No replacement or successful save is claimed. Retry later or use a downloaded backup.",
      );
    }
  }
  async write(path: string, body: Buffer, etag: string | null) {
    try {
      await put(path, body, {
        access: "private",
        token: this.token,
        addRandomSuffix: false,
        allowOverwrite: etag !== null,
        ...(etag ? { ifMatch: etag } : {}),
        contentType: "application/octet-stream",
        cacheControlMaxAge: 60,
        abortSignal: AbortSignal.timeout(6000),
      });
      return true;
    } catch (error) {
      if (
        error instanceof BlobPreconditionFailedError ||
        (error instanceof Error && /already exists/i.test(error.message))
      )
        return false;
      throw new StorageError(
        "The private server save failed or reached its quota. No successful save is claimed. Keep this page and download a backup before retrying.",
      );
    }
  }
}
interface Revision extends HistoryEntry {
  program: Program;
}
interface Copy extends SavedCopy {
  program: Program;
}
interface Workspace extends StoredReview {
  format: "closeout-private-v1";
  history: Revision[];
  copies: Copy[];
  lastCheck: number;
  checkingUntil: number;
}
export function dataKey(value: string): Buffer {
  if (!/^[a-f0-9]{64}$/.test(value))
    throw new StorageError("Private storage encryption is not configured.");
  return Buffer.from(value, "hex");
}
export function csrfForCookie(
  key: Buffer,
  cookie: string,
  origin: string,
): string {
  return createHmac("sha256", key)
    .update(`closeout-csrf-v1|${origin}|${cookie}`)
    .digest("hex");
}
export function seal(key: Buffer, path: string, value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value));
  if (body.length > MAX)
    throw new StorageError(
      "This workspace has reached its 1 MiB capacity. Download backups and remove saved copies before saving more.",
    );
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(path));
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  return Buffer.concat([
    Buffer.from("FCR1"),
    iv,
    cipher.getAuthTag(),
    encrypted,
  ]);
}
export function open(key: Buffer, path: string, body: Buffer): unknown {
  try {
    if (
      body.length < 32 ||
      body.length > MAX + 32 ||
      body.subarray(0, 4).toString() !== "FCR1"
    )
      throw new Error("Invalid envelope");
    const decipher = createDecipheriv("aes-256-gcm", key, body.subarray(4, 16));
    decipher.setAAD(Buffer.from(path));
    decipher.setAuthTag(body.subarray(16, 32));
    return JSON.parse(
      Buffer.concat([
        decipher.update(body.subarray(32)),
        decipher.final(),
      ]).toString(),
    );
  } catch {
    throw new StorageError(
      "Saved records could not be authenticated/decrypted. No replacement was created. Keep your backup and contact the operator; do not reset the data key.",
    );
  }
}
function validate(value: unknown): Workspace {
  try {
    const s = value as Workspace;
    if (
      s.format !== "closeout-private-v1" ||
      !Number.isSafeInteger(s.revision) ||
      s.revision < 1 ||
      !Array.isArray(s.history) ||
      s.history.length > 30 ||
      !Array.isArray(s.copies) ||
      s.copies.length > 20 ||
      !Number.isFinite(s.lastCheck) ||
      !Number.isFinite(s.checkingUntil)
    )
      throw new Error();
    validateProgram(s.program);
    for (const row of s.history) {
      validateProgram(row.program);
      if (
        !Number.isSafeInteger(row.revision) ||
        !Number.isFinite(Date.parse(row.createdAt)) ||
        typeof row.action !== "string" ||
        row.action.length > 100 ||
        !/^[a-f0-9]{64}$/.test(row.digest)
      )
        throw new Error();
    }
    for (const row of s.copies) {
      validateProgram(row.program);
      if (
        typeof row.id !== "string" ||
        typeof row.name !== "string" ||
        row.name.length > 100 ||
        !Number.isFinite(Date.parse(row.savedAt))
      )
        throw new Error();
    }
    return s;
  } catch {
    throw new StorageError(
      "Saved records are invalid. No replacement was created; keep your downloaded backup.",
    );
  }
}
/** One instance per HTTP request. Cache is request-scoped; every durable mutation uses storage ETag CAS. */
export class BlobReviewRepository implements ReviewRepository {
  readonly kind = "private-blob" as const;
  #cache = new Map<
    string,
    { state: Workspace | undefined; etag: string | null }
  >();
  private transport: ObjectTransport;
  private key: Buffer;
  constructor(transport: ObjectTransport, key: Buffer) {
    this.transport = transport;
    this.key = key;
    if (key.length !== 32) throw new StorageError("Invalid encryption key.");
  }
  #path(owner: string) {
    if (!/^[a-f0-9]{64}$/.test(owner))
      throw new StorageError("Invalid browser workspace.");
    return prefix + "reviews/" + owner + ".bin";
  }
  async #read(owner: string) {
    const path = this.#path(owner);
    let found = this.#cache.get(owner);
    if (!found) {
      const object = await this.transport.read(path);
      found = {
        state: object ? validate(open(this.key, path, object.body)) : undefined,
        etag: object?.etag ?? null,
      };
      this.#cache.set(owner, found);
    }
    return found;
  }
  async #save(owner: string, state: Workspace, etag: string | null) {
    validate(state);
    while (
      Buffer.byteLength(JSON.stringify(state)) > MAX &&
      state.history.length > 1
    )
      state.history.shift();
    const body = seal(this.key, this.#path(owner), state);
    if (!(await this.transport.write(this.#path(owner), body, etag)))
      throw new StorageConflict(
        "A newer server revision exists. Reload before saving; this edit was not applied.",
      );
    // No further writes with an invented ETag: reload this request's own committed state when needed.
    this.#cache.delete(owner);
  }
  async #allocate(owner: string) {
    const path = prefix + "index.bin",
      object = await this.transport.read(path),
      raw = object ? open(this.key, path, object.body) : [];
    if (
      !Array.isArray(raw) ||
      raw.length > 128 ||
      raw.some((x) => typeof x !== "string" || !/^[a-f0-9]{64}$/.test(x))
    )
      throw new StorageError("Private storage registry is unavailable.");
    if (raw.includes(owner)) return;
    if (raw.length >= 128)
      throw new StorageError(
        "This hosted prototype has reached its 128-workspace capacity. No record was deleted or successful save claimed.",
      );
    if (
      !(await this.transport.write(
        path,
        seal(this.key, path, [...raw, owner]),
        object?.etag ?? null,
      ))
    )
      throw new StorageConflict(
        "Another review started at the same time. Reload and retry; no review was overwritten.",
      );
  }
  async load(owner: string) {
    const { state } = await this.#read(owner);
    return state
      ? { program: structuredClone(state.program), revision: state.revision }
      : undefined;
  }
  async commit(
    owner: string,
    expected: number | undefined,
    program: Program,
    revision: number,
    action: string,
  ) {
    validateProgram(program);
    if (revision !== (expected ?? 0) + 1 || action.length > 100)
      throw new StorageError("Invalid server revision.");
    const current = await this.#read(owner);
    if (current.state?.revision !== expected)
      throw new StorageConflict(
        "A newer server revision exists. Reload before saving; no changes were applied.",
      );
    if (expected === undefined) await this.#allocate(owner);
    const state: Workspace = current.state
      ? structuredClone(current.state)
      : {
          format: "closeout-private-v1",
          program,
          revision,
          history: [],
          copies: [],
          lastCheck: 0,
          checkingUntil: 0,
        };
    state.program = structuredClone(program);
    state.revision = revision;
    state.history.push({
      revision,
      program: structuredClone(program),
      createdAt: new Date().toISOString(),
      action,
      digest: createHash("sha256")
        .update(JSON.stringify(program))
        .digest("hex"),
    });
    state.history = state.history.slice(-30);
    if (action === "check-transfer" || action === "recheck-payment")
      state.checkingUntil = 0;
    await this.#save(owner, state, current.etag);
  }
  async copies(owner: string) {
    return ((await this.#read(owner)).state?.copies ?? [])
      .map(({ id, name, savedAt }) => ({ id, name, savedAt }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
  async saveCopy(owner: string, expected: number, name: string) {
    const current = await this.#read(owner);
    if (!current.state || current.state.revision !== expected)
      throw new StorageConflict(
        "A newer server revision exists. Reload before saving a copy.",
      );
    if (!name.trim() || name.length > 100)
      throw new StorageError("Give the copy a name of 1 to 100 characters.");
    if (current.state.copies.length >= 20)
      throw new StorageError(
        "You already have 20 copies. Download a backup before deleting a copy.",
      );
    const state = structuredClone(current.state);
    state.copies.push({
      id: randomUUID(),
      name: name.trim(),
      savedAt: new Date().toISOString(),
      program: structuredClone(state.program),
    });
    await this.#save(owner, state, current.etag);
  }
  async copy(owner: string, id: string) {
    const row = (await this.#read(owner)).state?.copies.find(
      (c) => c.id === id,
    );
    if (!row)
      throw new StorageError(
        "That saved review is not available in this browser workspace.",
      );
    return structuredClone(row.program);
  }
  async deleteCopy(owner: string, id: string) {
    const current = await this.#read(owner);
    if (!current.state || !current.state.copies.some((c) => c.id === id))
      throw new StorageError("That saved copy is unavailable.");
    const state = structuredClone(current.state);
    state.copies = state.copies.filter((c) => c.id !== id);
    await this.#save(owner, state, current.etag);
  }
  async history(owner: string) {
    return [...((await this.#read(owner)).state?.history ?? [])]
      .reverse()
      .map(({ revision, createdAt, action, digest }) => ({
        revision,
        createdAt,
        action,
        digest,
      }));
  }
  async historical(owner: string, revision: number) {
    const row = (await this.#read(owner)).state?.history.find(
      (h) => h.revision === revision,
    );
    if (!row)
      throw new StorageError("That revision is no longer in recovery history.");
    return structuredClone(row.program);
  }
  async reserveCheck(owner: string, now: number) {
    const current = await this.#read(owner);
    if (!current.state) throw new StorageError("Create a review first.");
    if (
      current.state.checkingUntil > now ||
      current.state.lastCheck > now - 2000
    )
      throw new StorageError(
        "A check is in progress or cooling down. Wait up to one minute and retry; no payment was added.",
      );
    const path = prefix + "rpc-budget.bin",
      object = await this.transport.read(path),
      raw = object ? open(this.key, path, object.body) : [];
    if (
      !Array.isArray(raw) ||
      raw.length > 20 ||
      raw.some((x) => typeof x !== "number" || !Number.isFinite(x))
    )
      throw new StorageError("Receipt check budget is unavailable.");
    const recent = raw.filter((x) => x > now - 60000);
    if (recent.length >= 20)
      throw new StorageError(
        "Receipt checks are temporarily rate limited. Wait one minute; no payment was added.",
      );
    if (
      !(await this.transport.write(
        path,
        seal(this.key, path, [...recent, now]),
        object?.etag ?? null,
      ))
    )
      throw new StorageConflict(
        "A concurrent check reserved the budget. Wait before retrying.",
      );
    const state = structuredClone(current.state);
    state.lastCheck = now;
    state.checkingUntil = now + 60000;
    await this.#save(owner, state, current.etag);
  }
}

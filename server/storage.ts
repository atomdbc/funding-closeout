import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, lstatSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { validateProgram } from "../src/domain/closeout.ts";
import type { Program } from "../src/domain/closeout.ts";

export interface StoredReview {
  program: Program;
  revision: number;
}
export interface SavedCopy {
  id: string;
  name: string;
  savedAt: string;
}
export interface HistoryEntry {
  revision: number;
  createdAt: string;
  action: string;
  digest: string;
}
type Awaitable<T> = T | Promise<T>;
export interface ReviewRepository {
  readonly kind?: "local-sqlite" | "private-blob";
  reserveCheck?(owner: string, now: number): Promise<void>;
  load(owner: string): Awaitable<StoredReview | undefined>;
  commit(
    owner: string,
    expected: number | undefined,
    program: Program,
    revision: number,
    action: string,
  ): Awaitable<void>;
  copies(owner: string): Awaitable<SavedCopy[]>;
  saveCopy(owner: string, expected: number, name: string): Awaitable<void>;
  copy(owner: string, id: string): Awaitable<Program>;
  deleteCopy(owner: string, id: string): Awaitable<void>;
  history(owner: string): Awaitable<HistoryEntry[]>;
  historical(owner: string, revision: number): Awaitable<Program>;
}
export class StorageError extends Error {}
export class StorageConflict extends StorageError {}
export function ownerKey(cookie: string): string {
  return createHash("sha256").update(cookie).digest("hex");
}
function decode(value: unknown): Program {
  if (typeof value !== "string")
    throw new StorageError(
      "The saved review is unavailable. Keep your downloaded backup; do not replace the database.",
    );
  try {
    const p = JSON.parse(value) as Program;
    validateProgram(p);
    return p;
  } catch {
    throw new StorageError(
      "The saved review could not be validated. Keep your backup and database; no records were replaced.",
    );
  }
}

/** Local plaintext SQLite, private filesystem permissions. Cookie capabilities are hashed, not stored raw. */
export class SqliteReviewRepository implements ReviewRepository {
  readonly kind = "local-sqlite" as const;
  #db: DatabaseSync;
  constructor(path: string) {
    const dir = dirname(path);
    if (existsSync(dir) && lstatSync(dir).isSymbolicLink())
      throw new StorageError(
        "The local data directory must not be a symbolic link.",
      );
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (
      existsSync(path) &&
      (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
    )
      throw new StorageError("The local database must be a regular file.");
    // This constructor is used only for a project-private directory or an owned temporary test directory.
    chmodSync(dir, 0o700);
    this.#db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    this.#db
      .exec(`PRAGMA busy_timeout=2000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE;
      CREATE TABLE IF NOT EXISTS reviews(owner TEXT PRIMARY KEY, revision INTEGER NOT NULL, program TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history(owner TEXT NOT NULL REFERENCES reviews(owner), revision INTEGER NOT NULL, program TEXT NOT NULL, created TEXT NOT NULL, action TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(owner,revision));
      CREATE TABLE IF NOT EXISTS copies(id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES reviews(owner), name TEXT NOT NULL, program TEXT NOT NULL, saved TEXT NOT NULL);`);
  }
  close() {
    this.#db.close();
  }
  #transaction<T>(work: () => T): T {
    try {
      this.#db.exec("BEGIN IMMEDIATE");
      const result = work();
      this.#db.exec("COMMIT");
      return result;
    } catch (e) {
      try {
        this.#db.exec("ROLLBACK");
      } catch {
        /* preserve original error */
      }
      if (e instanceof StorageError) throw e;
      throw new StorageError(
        "The local disk save failed. No successful save is claimed. Keep this page open, download a backup and retry after checking local storage.",
      );
    }
  }
  load(owner: string): StoredReview | undefined {
    const row = this.#db
      .prepare("SELECT program,revision FROM reviews WHERE owner=?")
      .get(owner);
    return row
      ? { program: decode(row.program), revision: Number(row.revision) }
      : undefined;
  }
  #expect(owner: string, expected: number | undefined) {
    const current = this.#db
      .prepare("SELECT revision FROM reviews WHERE owner=?")
      .get(owner);
    if ((current ? Number(current.revision) : undefined) !== expected)
      throw new StorageConflict(
        "A newer local revision exists. Reload before saving; your edit was not applied.",
      );
  }
  commit(
    owner: string,
    expected: number | undefined,
    program: Program,
    revision: number,
    action: string,
  ) {
    validateProgram(program);
    if (
      !/^[a-f0-9]{64}$/.test(owner) ||
      revision !== (expected ?? 0) + 1 ||
      action.length > 100
    )
      throw new StorageError("Invalid local revision.");
    const json = JSON.stringify(program),
      digest = createHash("sha256").update(json).digest("hex");
    this.#transaction(() => {
      this.#expect(owner, expected);
      if (
        expected === undefined &&
        Number(
          this.#db.prepare("SELECT count(*) AS n FROM reviews").get()!.n,
        ) >= 128
      )
        throw new StorageError(
          "This local store has reached its 128-browser limit. Export existing records before making room; nothing was deleted.",
        );
      this.#db
        .prepare(
          "INSERT INTO reviews(owner,revision,program) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET revision=excluded.revision,program=excluded.program",
        )
        .run(owner, revision, json);
      this.#db
        .prepare(
          "INSERT INTO history(owner,revision,program,created,action,digest) VALUES(?,?,?,?,?,?)",
        )
        .run(owner, revision, json, new Date().toISOString(), action, digest);
      this.#db
        .prepare(
          "DELETE FROM history WHERE owner=? AND revision NOT IN (SELECT revision FROM history WHERE owner=? ORDER BY revision DESC LIMIT 30)",
        )
        .run(owner, owner);
    });
  }
  copies(owner: string): SavedCopy[] {
    return this.#db
      .prepare(
        "SELECT id,name,saved FROM copies WHERE owner=? ORDER BY saved DESC,id LIMIT 20",
      )
      .all(owner)
      .map((r) => ({
        id: String(r.id),
        name: String(r.name),
        savedAt: String(r.saved),
      }));
  }
  saveCopy(owner: string, expected: number, name: string) {
    if (!name.trim() || name.length > 100)
      throw new StorageError(
        "Give the saved copy a name of 1 to 100 characters.",
      );
    this.#transaction(() => {
      this.#expect(owner, expected);
      if (
        Number(
          this.#db
            .prepare("SELECT count(*) AS n FROM copies WHERE owner=?")
            .get(owner)!.n,
        ) >= 20
      )
        throw new StorageError(
          "You already have 20 saved copies. Download a backup before deleting a copy you no longer need.",
        );
      const row = this.#db
        .prepare("SELECT program FROM reviews WHERE owner=?")
        .get(owner)!;
      this.#db
        .prepare(
          "INSERT INTO copies(id,owner,name,program,saved) VALUES(?,?,?,?,?)",
        )
        .run(
          randomUUID(),
          owner,
          name.trim(),
          String(row.program),
          new Date().toISOString(),
        );
    });
  }
  copy(owner: string, id: string): Program {
    return decode(
      this.#db
        .prepare("SELECT program FROM copies WHERE id=? AND owner=?")
        .get(id, owner)?.program,
    );
  }
  deleteCopy(owner: string, id: string) {
    this.#transaction(() => {
      if (
        !this.#db
          .prepare("DELETE FROM copies WHERE id=? AND owner=?")
          .run(id, owner).changes
      )
        throw new StorageError(
          "That saved copy is unavailable in this browser workspace.",
        );
    });
  }
  history(owner: string): HistoryEntry[] {
    return this.#db
      .prepare(
        "SELECT revision,created,action,digest FROM history WHERE owner=? ORDER BY revision DESC LIMIT 30",
      )
      .all(owner)
      .map((r) => ({
        revision: Number(r.revision),
        createdAt: String(r.created),
        action: String(r.action),
        digest: String(r.digest),
      }));
  }
  historical(owner: string, revision: number): Program {
    return decode(
      this.#db
        .prepare("SELECT program FROM history WHERE owner=? AND revision=?")
        .get(owner, revision)?.program,
    );
  }
}

export function restoreForReview(program: Program): Program {
  const p = structuredClone(program);
  p.paymentsComplete = false;
  p.commitmentsComplete = false;
  for (const item of [...p.payments, ...p.commitments]) item.reviewed = false;
  validateProgram(p);
  return p;
}

import { createHash } from "node:crypto";
import { decimal, units } from "../domain/money.ts";
import { accountId, hashId, RPC_ENDPOINT, USDC_CONTRACT } from "./facts.ts";
import type {
  TransferFacts,
  TransferReader,
  VerificationBasis,
} from "./facts.ts";

type Obj = Record<string, unknown>;
function object(value: unknown): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Incomplete RPC evidence.");
  return value as Obj;
}
export class NearCheckError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
function reject(code: string, message: string): never {
  throw new NearCheckError(code, message);
}
function success(status: unknown): boolean {
  const s = object(status);
  return Object.keys(s).length === 1 && typeof s.SuccessValue === "string";
}

/** One final native-USDC movement, bound to its actual ft_transfer execution receipt.
 * A DAO/relayer may initiate it, but transfer-and-call, refunds and multiple USDC events are not netted or guessed.
 */
export function parseTransfer(
  result: unknown,
  transactionHash: string,
  treasury: string,
  basis: VerificationBasis,
  checkedAt: string,
  transactionSigner = treasury,
): TransferFacts {
  if (
    !hashId(transactionHash) ||
    !accountId(treasury) ||
    !accountId(transactionSigner)
  )
    reject(
      "invalid-input",
      "Enter public NEAR account IDs and a transaction hash.",
    );
  const r = object(result),
    tx = object(r.transaction);
  if (r.final_execution_status !== "FINAL")
    reject(
      "not-final",
      "Final execution is not confirmed. Wait and check again; no payment was added.",
    );
  if (!success(r.status))
    reject(
      "failed",
      "The transaction did not finish successfully. No payment was added; this is not a claim that no other asset moved.",
    );
  if (
    tx.hash === transactionHash &&
    typeof tx.signer_id === "string" &&
    tx.signer_id !== transactionSigner &&
    /^[a-z0-9._-]{2,64}$/.test(tx.signer_id)
  )
    reject(
      "mismatch",
      `The returned transaction does not match this hash and transaction signer. It was signed by ${tx.signer_id}, not ${transactionSigner}. If that account paid on the treasury's behalf (a DAO, relayer or swap), open "Paid through a DAO or a relayer?" and enter ${tx.signer_id}. No payment was added.`,
    );
  if (tx.hash !== transactionHash || tx.signer_id !== transactionSigner)
    reject(
      "mismatch",
      "The returned transaction does not match this hash and transaction signer.",
    );
  const transactionOutcome = object(r.transaction_outcome),
    root = object(transactionOutcome.outcome);
  const rootStatus = object(root.status);
  if (
    transactionOutcome.id !== transactionHash ||
    Object.keys(rootStatus).length !== 1 ||
    typeof rootStatus.SuccessReceiptId !== "string" ||
    !hashId(rootStatus.SuccessReceiptId) ||
    !Array.isArray(root.receipt_ids) ||
    !root.receipt_ids.includes(rootStatus.SuccessReceiptId)
  )
    reject(
      "mismatch",
      "The execution receipts could not be bound to this transaction.",
    );
  if (!Array.isArray(r.receipts_outcome) || r.receipts_outcome.length > 100)
    reject(
      "unsupported",
      "Complete receipt outcomes are unavailable or exceed this bounded verifier.",
    );
  const outcomes = new Map<string, { row: Obj; outcome: Obj }>();
  for (const entry of r.receipts_outcome) {
    const row = object(entry),
      outcome = object(row.outcome);
    if (typeof row.id !== "string" || !hashId(row.id) || outcomes.has(row.id))
      reject("mismatch", "Receipt IDs are malformed or repeated.");
    outcomes.set(row.id, { row, outcome });
  }
  const reachable = new Set<string>(),
    queue: unknown[] = [...root.receipt_ids];
  while (queue.length) {
    const id = queue.shift();
    if (typeof id !== "string" || !hashId(id))
      reject("mismatch", "Malformed receipt graph.");
    if (reachable.has(id)) continue;
    reachable.add(id);
    const entry = outcomes.get(id);
    if (!entry) reject("mismatch", "A final execution receipt is missing.");
    const status = object(entry.outcome.status);
    if (!Array.isArray(entry.outcome.receipt_ids))
      reject("mismatch", "Receipt links are missing.");
    queue.push(...entry.outcome.receipt_ids);
    if (!success(status)) {
      if (
        Object.keys(status).length !== 1 ||
        typeof status.SuccessReceiptId !== "string" ||
        !hashId(status.SuccessReceiptId) ||
        !entry.outcome.receipt_ids.includes(status.SuccessReceiptId)
      )
        reject(
          "failed",
          "A receipt is failed or incomplete. No payment was added.",
        );
      queue.push(status.SuccessReceiptId);
    }
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function checkAcyclic(id: string): void {
    if (visiting.has(id))
      reject("mismatch", "The receipt graph contains a cycle.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of outcomes.get(id)!.outcome.receipt_ids as string[])
      checkAcyclic(child);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of root.receipt_ids as string[]) checkAcyclic(id);
  // An unbound outcome must not be used to smuggle an unrelated transfer into a response.
  if (reachable.size !== outcomes.size)
    reject(
      "mismatch",
      "The RPC includes outcomes not bound to this transaction.",
    );
  const transfers: { receiptId: string; data: Obj }[] = [];
  for (const [id, { outcome }] of outcomes) {
    if (outcome.executor_id !== USDC_CONTRACT) continue;
    if (!Array.isArray(outcome.logs))
      reject("mismatch", "Issuer logs are unavailable.");
    for (const line of outcome.logs) {
      if (typeof line !== "string" || line.length > 32000)
        reject("mismatch", "Issuer logs are malformed.");
      if (!line.startsWith("EVENT_JSON:")) continue;
      let event: Obj;
      try {
        event = object(JSON.parse(line.slice(11).trim()));
      } catch {
        return reject("mismatch", "An issuer event could not be read safely.");
      }
      if (event.standard !== "nep141") continue;
      if (
        event.version !== "1.0.0" ||
        event.event !== "ft_transfer" ||
        !Array.isArray(event.data)
      )
        reject(
          "unsupported",
          "This transaction contains unsupported token events.",
        );
      for (const data of event.data)
        transfers.push({ receiptId: id, data: object(data) });
    }
  }
  if (transfers.length !== 1)
    reject(
      "unsupported",
      "A single unambiguous native USDC transfer event is required. Refund or multi-transfer flows are not supported.",
    );
  const event = transfers[0]!,
    executed = outcomes.get(event.receiptId)!;
  if (
    !success(executed.outcome.status) ||
    typeof executed.row.block_hash !== "string" ||
    !hashId(executed.row.block_hash)
  )
    reject("failed", "The USDC execution receipt did not finish successfully.");
  let actions: unknown, predecessor: unknown;
  const receipts = r.receipts;
  if (
    receipts !== undefined &&
    (!Array.isArray(receipts) || receipts.length > 100)
  )
    reject("unsupported", "Receipt details exceed this verifier's limit.");
  const descriptors = (Array.isArray(receipts) ? receipts : [])
    .map(object)
    .filter((x) => x.receipt_id === event.receiptId);
  if (descriptors.length > 1)
    reject("mismatch", "The transfer receipt descriptor is repeated.");
  if (descriptors.length) {
    const receipt = descriptors[0]!;
    if (receipt.receiver_id !== USDC_CONTRACT)
      reject(
        "mismatch",
        "The execution receipt is not addressed to native USDC.",
      );
    predecessor = receipt.predecessor_id;
    actions = object(object(receipt.receipt).Action).actions;
  } else {
    // Documented RPC omission: first receipt can be absent. Reconstruct ONLY a direct transaction root.
    if (
      event.receiptId !== rootStatus.SuccessReceiptId ||
      tx.receiver_id !== USDC_CONTRACT
    )
      reject(
        "mismatch",
        "The transfer's action receipt is missing; its payer and method cannot be verified.",
      );
    predecessor = tx.signer_id;
    actions = tx.actions;
  }
  if (
    predecessor !== treasury ||
    !Array.isArray(actions) ||
    actions.length !== 1
  )
    reject(
      "mismatch",
      "The actual transfer payer or action does not match this review.",
    );
  const call = object(object(actions[0]).FunctionCall);
  if (
    call.method_name !== "ft_transfer" ||
    typeof call.args !== "string" ||
    call.args.length > 16000
  )
    reject(
      "unsupported",
      "Only an executed ft_transfer is supported. Transfer-and-call and other methods are not supported.",
    );
  let args: Obj;
  try {
    const bytes = Buffer.from(call.args, "base64");
    if (bytes.toString("base64") !== call.args)
      throw new Error("Non-canonical base64");
    args = object(JSON.parse(bytes.toString("utf8")));
  } catch {
    return reject(
      "unsupported",
      "The transfer arguments could not be read safely.",
    );
  }
  if (
    typeof args.receiver_id !== "string" ||
    !accountId(args.receiver_id) ||
    args.receiver_id === treasury ||
    typeof args.amount !== "string" ||
    !/^[1-9]\d{0,37}$/.test(args.amount)
  )
    reject(
      "unsupported",
      "The transfer recipient or quantity is unsupported. Self-transfers are not treated as program expenses.",
    );
  const amount = decimal(BigInt(args.amount));
  try {
    units(amount);
  } catch {
    return reject(
      "unsupported",
      "This transfer exceeds the local review amount limit.",
    );
  }
  if (
    event.data.old_owner_id !== treasury ||
    event.data.new_owner_id !== args.receiver_id ||
    event.data.amount !== args.amount
  )
    reject(
      "mismatch",
      "The executed transfer log does not match the requested sender, recipient and amount.",
    );
  return {
    network: "mainnet",
    basis,
    provider: basis === "public-rpc" ? RPC_ENDPOINT : "test-fixture",
    transactionHash,
    transactionSigner,
    receiptId: event.receiptId,
    blockHash: executed.row.block_hash as string,
    sender: treasury,
    recipient: args.receiver_id,
    tokenContract: USDC_CONTRACT,
    symbol: "USDC",
    decimals: 6,
    rawAmount: args.amount,
    amount,
    finalExecutionStatus: "FINAL",
    method: "ft_transfer",
    checkedAt,
    rpcResultSha256: createHash("sha256")
      .update(JSON.stringify(result))
      .digest("hex"),
  };
}

export type RpcMethod = "status" | "tx" | "EXPERIMENTAL_tx_status";
export type RpcTransport = (
  method: RpcMethod,
  params: object,
) => Promise<unknown>;
/** Fixed HTTPS archival endpoint. No URL input, redirects, credentials, signatures or writes. */
export const publicRpc: RpcTransport = async (method, params) => {
  if (!["status", "tx", "EXPERIMENTAL_tx_status"].includes(method))
    reject(
      "invalid-input",
      "This adapter permits read-only status and transaction queries only.",
    );
  const response = await fetch(RPC_ENDPOINT, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "closeout-readonly",
      method,
      params,
    }),
  });
  if (!response.ok || !response.body)
    reject(
      "unavailable",
      response.status === 429
        ? "The public RPC is rate limited. Wait before trying again; no payment was added."
        : "The public RPC is unavailable. No payment was added.",
    );
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 1_000_000)
      reject(
        "unavailable",
        "The RPC evidence is too large for this bounded verifier.",
      );
    chunks.push(Buffer.from(chunk));
  }
  const body = object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  if (
    body.error ||
    body.result === undefined ||
    body.jsonrpc !== "2.0" ||
    body.id !== "closeout-readonly"
  )
    reject(
      "unavailable",
      "The RPC could not confirm a final transaction. Check the hash and transaction signer, or retry later. Free archival history is rate limited.",
    );
  return body.result;
};
export function createNearReader(
  transport: RpcTransport = publicRpc,
  basis: VerificationBasis = "public-rpc",
): TransferReader {
  if (transport !== publicRpc && basis !== "test-fixture")
    throw new Error("Injected RPC transports must be labeled test-fixture.");
  let networkCheckedAt = 0;
  return {
    async check(hash, treasury, transactionSigner = treasury) {
      if (
        !hashId(hash) ||
        !accountId(treasury) ||
        !accountId(transactionSigner)
      )
        reject(
          "invalid-input",
          "Enter public NEAR account IDs and a valid transaction hash.",
        );
      try {
        if (Date.now() - networkCheckedAt > 60000) {
          if (object(await transport("status", {})).chain_id !== "mainnet")
            reject(
              "mismatch",
              "The RPC did not identify NEAR mainnet. No payment was added.",
            );
          networkCheckedAt = Date.now();
        }
        const result = await transport("EXPERIMENTAL_tx_status", {
          tx_hash: hash,
          sender_account_id: transactionSigner,
          wait_until: "FINAL",
        });
        return parseTransfer(
          result,
          hash,
          treasury,
          basis,
          new Date().toISOString(),
          transactionSigner,
        );
      } catch (error) {
        if (error instanceof NearCheckError) throw error;
        throw new NearCheckError(
          "unavailable",
          "The RPC response could not be verified. Try again later; no payment was added.",
        );
      }
    },
  };
}

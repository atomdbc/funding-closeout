/** Circle's NEAR mainnet USDC issuer contract, rechecked against its published address list. */
export const USDC_CONTRACT =
  "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
export const RPC_ENDPOINT = "https://archival-rpc.mainnet.near.org";
export type VerificationBasis = "public-rpc" | "test-fixture";
export interface TransferFacts {
  network: "mainnet";
  basis: VerificationBasis;
  provider: string;
  transactionHash: string;
  transactionSigner: string;
  receiptId: string;
  blockHash: string;
  sender: string;
  recipient: string;
  tokenContract: typeof USDC_CONTRACT;
  symbol: "USDC";
  decimals: 6;
  rawAmount: string;
  amount: string;
  finalExecutionStatus: "FINAL";
  method: "ft_transfer";
  checkedAt: string;
  rpcResultSha256: string;
}
export interface TransferReader {
  check(
    transactionHash: string,
    treasury: string,
    transactionSigner?: string,
  ): Promise<TransferFacts>;
}
export function accountId(value: string): boolean {
  return (
    value.length >= 2 &&
    value.length <= 64 &&
    /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(value)
  );
}
export function hashId(value: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const char of value) n = n * 58n + BigInt(alphabet.indexOf(char));
  const bytes = n === 0n ? 0 : Math.ceil(n.toString(16).length / 2);
  return bytes + (value.match(/^1*/)?.[0].length ?? 0) === 32;
}
export function transferReference(facts: TransferFacts): string {
  return `near:${facts.transactionHash}:${facts.receiptId}`;
}

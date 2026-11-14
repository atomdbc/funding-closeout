/** Exact USDC quantities. No USD conversion, floats, scientific notation or rounding. */
export const DECIMALS = 6;
const SCALE = 1_000_000n;
export function units(value: string): bigint {
  if (!/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(value)) {
    throw new Error(
      "Use a positive amount or zero, with up to 6 decimals and no commas.",
    );
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * SCALE + BigInt(fraction.padEnd(DECIMALS, "0"));
}
export function decimal(value: bigint): string {
  const abs = value < 0n ? -value : value;
  const fraction = (abs % SCALE)
    .toString()
    .padStart(DECIMALS, "0")
    .replace(/0+$/, "");
  return `${value < 0n ? "-" : ""}${abs / SCALE}${fraction ? `.${fraction}` : ""}`;
}
export function money(value: string | null | undefined): string {
  if (value === null || value === undefined) return "Not entered";
  const [whole, fraction] = value.split(".");
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""} USDC`;
}

export const MONEY_SCALE = 1_000_000n;
export const PERCENT_SCALE = 1_000_000n;
const MONEY_PATTERN = /^(0|[1-9]\d{0,13})(?:\.(\d{1,6}))?$/;
const PERCENT_PATTERN = /^(0|[1-9]\d{0,2})(?:\.(\d{1,6}))?$/;

export function parseMoney(value: string): bigint | null {
  const match = MONEY_PATTERN.exec(value.trim());
  if (!match) return null;
  const fraction = (match[2] ?? "").padEnd(6, "0");
  return BigInt(match[1]) * MONEY_SCALE + BigInt(fraction || "0");
}

export function parsePercentage(value: string): bigint | null {
  const match = PERCENT_PATTERN.exec(value.trim());
  if (!match) return null;
  const fraction = (match[2] ?? "").padEnd(6, "0");
  const result = BigInt(match[1]) * PERCENT_SCALE + BigInt(fraction || "0");
  return result <= 100n * PERCENT_SCALE ? result : null;
}

export function formatUnits(value: bigint, decimals = 6): string {
  const negative = value < 0n;
  const positive = negative ? -value : value;
  const whole = positive / MONEY_SCALE;
  const fraction = (positive % MONEY_SCALE).toString().padStart(6, "0").slice(0, decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function formatDatabaseAmount(value: string): string {
  if (!/^(0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(value)) {
    throw new Error("Invalid database monetary amount.");
  }
  const [whole, fraction = ""] = value.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return `${whole}${trimmedFraction ? `.${trimmedFraction}` : ""}`;
}

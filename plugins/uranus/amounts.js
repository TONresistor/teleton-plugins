import { UranusError } from "./errors.js";

const DECIMAL_RE = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

export function parseUnits(value, decimals = 9, field = "amount", { allowZero = false } = {}) {
  if (typeof value !== "string") throw new UranusError("INVALID_AMOUNT", `${field} must be a decimal string`);
  const input = value.trim();
  const match = DECIMAL_RE.exec(input);
  if (!match || (match[1].length > 1 && match[1].startsWith("0"))) {
    throw new UranusError("INVALID_AMOUNT", `${field} must be a plain positive decimal string`);
  }
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) throw new UranusError("INVALID_AMOUNT", `${field} supports at most ${decimals} decimals`);
  const units = BigInt(match[1]) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (allowZero ? units < 0n : units <= 0n) throw new UranusError("INVALID_AMOUNT", `${field} must be ${allowZero ? "non-negative" : "positive"}`);
  return units;
}

export function formatUnits(value, decimals = 9) {
  const n = BigInt(value);
  const sign = n < 0n ? "-" : "";
  const abs = n < 0n ? -n : n;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const fraction = (abs % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function nanoToTonNumber(value) {
  const text = formatUnits(value, 9);
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) throw new UranusError("INVALID_AMOUNT", "TON value cannot be represented safely");
  return number;
}

export function parseUint(value, bits, field) {
  let n;
  try {
    n = typeof value === "bigint" ? value : BigInt(String(value));
  } catch {
    throw new UranusError("INVALID_AMOUNT", `${field} must be an unsigned integer`);
  }
  if (n < 0n || n >= 1n << BigInt(bits)) throw new UranusError("INVALID_AMOUNT", `${field} must fit uint${bits}`);
  return n;
}

export function percentageString(numerator, denominator) {
  if (BigInt(denominator) <= 0n) return null;
  const hundredths = (BigInt(numerator) * 10_000n) / BigInt(denominator);
  return formatUnits(hundredths, 2);
}

const EXIT_ERRORS = new Map([
  [20, ["CURVE_PARAMS_MALFORMED", "Invalid bonding-curve parameters"]],
  [21, ["SLIPPAGE_EXCEEDED", "Quote moved beyond allowed slippage"]],
  [22, ["PRESET_NOT_FOUND", "Meme preset does not exist"]],
  [23, ["MESSAGE_VALUE_TOO_LOW", "Attached TON is insufficient"]],
  [24, ["ALREADY_INITIALIZED", "Meme is already initialized"]],
  [25, ["SENDER_UNAUTHORIZED", "Wallet is not authorized"]],
  [26, ["INITIAL_BUY_LIMIT", "Initial buy exceeds the contract limit"]],
  [27, ["BALANCE_EXCEEDED", "Requested amount exceeds the available balance"]],
  [28, ["NOT_INITIALIZED", "Contract is not initialized"]],
  [29, ["ALREADY_GRADUATED", "Curve trading is closed after graduation"]],
  [30, ["CROSS_WORKCHAIN", "Cross-workchain operations are unsupported"]],
  [31, ["INCORRECT_ADDRESS", "Address is invalid for this operation"]],
  [34, ["FEE_PRESET_NOT_FOUND", "Fee preset does not exist"]],
  [35, ["SUPPLY_PRESET_NOT_FOUND", "Supply preset does not exist"]],
  [36, ["RAISE_OUT_OF_RANGE", "Raise target is outside 800–1,000,000 TON"]],
  [37, ["PARTNER_FEE_OUT_OF_RANGE", "Partner fee exceeds protocol limits"]],
  [38, ["SELL_SUPPLY_OUT_OF_RANGE", "On-sell supply must be between 60% and 80%"]],
  [39, ["POOL_PARTNER_FEE_OUT_OF_RANGE", "Pool partner fee exceeds protocol limits"]],
]);

export class UranusError extends Error {
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "UranusError";
    this.code = code;
  }
}

export function fail(code, message) {
  throw new UranusError(code, message);
}

export function exitError(exitCode) {
  const known = EXIT_ERRORS.get(Number(exitCode));
  if (!known) return new UranusError("CONTRACT_ERROR", `Uranus contract exited with code ${exitCode}`);
  return new UranusError(known[0], known[1]);
}

function detectExitCode(message) {
  const match = String(message).match(/(?:exit(?:_code)?|code)\s*[:=]?\s*(-?\d+)/i);
  return match ? Number(match[1]) : undefined;
}

export function normalizeError(error) {
  if (error instanceof UranusError) return error;
  const message = String(error?.message ?? error);
  const exitCode = detectExitCode(message);
  if (exitCode !== undefined && EXIT_ERRORS.has(exitCode)) return exitError(exitCode);
  const sdkCode = typeof error?.code === "string" ? error.code : undefined;
  if (sdkCode === "WALLET_NOT_INITIALIZED") return new UranusError(sdkCode, "Teleton wallet is not initialized", error);
  if (sdkCode === "INVALID_ADDRESS") return new UranusError(sdkCode, "Invalid TON address", error);
  if (/429|rate.?limit/i.test(message)) return new UranusError("UPSTREAM_RATE_LIMITED", "TON indexer rate limit reached; retry shortly", error);
  if (/abort|timeout/i.test(message)) return new UranusError("UPSTREAM_UNAVAILABLE", "TON upstream timed out", error);
  return new UranusError(sdkCode ?? "OPERATION_FAILED", message.slice(0, 500), error);
}

export function errorResult(error, log, label = "uranus") {
  const normalized = normalizeError(error);
  log?.error?.(`${label}: ${normalized.code}: ${normalized.message}`);
  return { success: false, error: normalized.message.slice(0, 500), code: normalized.code };
}

export const EXIT_ERROR_CODES = Object.freeze(
  Object.fromEntries([...EXIT_ERRORS].map(([exit, [code, message]]) => [exit, { code, message }]))
);


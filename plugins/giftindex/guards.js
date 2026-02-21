/**
 * GiftIndex trading workflow guardrails
 *
 * Centralized validation functions called by every trade tool
 * before executing on-chain transactions.
 */

export class GuardError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Rule 1: Owner-only access.
 * Checks context.senderId against context.config.telegram.admin_ids.
 */
export function assertOwner(context) {
  const adminIds = context.config?.telegram?.admin_ids ?? [];
  if (!adminIds.includes(context.senderId)) {
    throw new GuardError(
      'UNAUTHORIZED',
      'Trading is restricted to the owner. This request has been rejected.',
    );
  }
}

/**
 * Rule 4: Corridor enforcement.
 * Rejects prices outside the oracle-defined [low, high] range.
 */
export function assertInCorridor(priceHuman, corridor, label) {
  if (corridor.low == null || corridor.high == null) {
    throw new GuardError(
      'NO_CORRIDOR',
      `Corridor data unavailable for ${label}. Cannot validate price — order rejected.`,
    );
  }
  if (priceHuman < corridor.low || priceHuman > corridor.high) {
    throw new GuardError(
      'OUT_OF_CORRIDOR',
      `Price $${priceHuman.toFixed(4)} is outside the ${label} corridor ` +
        `[$${corridor.low.toFixed(4)} – $${corridor.high.toFixed(4)}]. Order rejected.`,
    );
  }
}

/**
 * Rule 2 + Rule 4: Minimum order value.
 * Sell orders: minimum $2. All orders: minimum $1.
 */
export function assertMinimumValue(usdValue, minimumUsd, label) {
  if (usdValue < minimumUsd) {
    throw new GuardError(
      'BELOW_MINIMUM',
      `${label} value $${usdValue.toFixed(2)} is below the $${minimumUsd.toFixed(2)} minimum. Order rejected.`,
    );
  }
}

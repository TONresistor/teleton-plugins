/**
 * Webdom marketplace constants -- addresses, opcodes, and configuration
 */

// ---------------------------------------------------------------------------
// Marketplace contract
// ---------------------------------------------------------------------------

export const WEBDOM_MARKETPLACE = "EQD7-a6WPtb7w5VgoUfHJmMvakNFgitXPk3sEM8Gf_WEBDOM";

// ---------------------------------------------------------------------------
// Token & collection addresses
// ---------------------------------------------------------------------------

export const WEB3_TOKEN = "EQBtcL4JA-PdPiUkB8utHcqdaftmUSTqdL8Z1EeXePLti_nK";
export const TON_DNS_COLLECTION = "EQC3dNlesgVD8YbAazcauIrXBPfiVhMMr5YYk2in0Mtsz0Bz";
export const USERNAMES_COLLECTION = "EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi";

// ---------------------------------------------------------------------------
// Deploy opcodes (32-bit, from webdom frontend)
// ---------------------------------------------------------------------------

export const OP = {
  TON_SIMPLE_SALE:    0x063e023f,
  TON_SIMPLE_AUCTION: 0x0860ff74,
  TON_SIMPLE_OFFER:   0x05733be4,
  DOMAIN_SWAP:        0x029adb98,
};

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

export const FEES = {
  TON_PERCENT:  4,   // 4% for TON payments
  WEB3_PERCENT: 2,   // 2% for WEB3 payments
  NFT_HOLDER:   0,   // 0% for NFT holders (1% for some tiers)
};

// ---------------------------------------------------------------------------
// API configuration
// ---------------------------------------------------------------------------

export const API_BASE = "https://webdom.market/api";
export const API_TIMEOUT = 15_000;  // 15 seconds
export const CACHE_TTL = 300_000;    // 5 minutes in ms for sdk.storage

// ---------------------------------------------------------------------------
// Transaction constants
// ---------------------------------------------------------------------------

export const MIN_GAS_TON = "0.15";  // minimum gas for on-chain ops

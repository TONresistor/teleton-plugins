export const NETWORK = "mainnet";

export const FACTORIES = Object.freeze({
  "v3.1": "EQAmkd4Pd_xgUW4b9MLrygf0SOfR2EUVa_iCtVWGnYB2hItG",
  "v3.0": "EQA6ivhIOBQJvqO1SY3IvutmluM1d817gZDeEjiaVNBLePd3",
  v2: "EQBvhJBSxkmpAEkIoQfqztCPGRQNaCObIVuoy_Rz7oTbWBYi",
  v1: "EQAO4cYqithwdltzmrlal1L5JKLK5Xk76feAJq0VoBC6Fy8T",
});

export const ACTIVE_FACTORY = FACTORIES["v3.1"];

export const MEME_CODE_HASHES = Object.freeze({
  "v3.1": "f4ba4ebd2678dde0c750564bd22ee0876aa2f39a1e8d3aacb606ba0c39a71d9a",
  "v3.0": "1e4f8fcaabefdbbb9b397372d9f021511c272eda2b492ca2d33b817bc3251afe",
  v2: "7369f9b9f570e1bf78b0dc9d52cbab7ce21a4f000ee858ea6e81d43232c1a2d6",
  v1: "722d37be518ee0d4b6714077727ed60724bf379e8f1479c220b853d1af3cf00d",
});

export const MEME_LIBRARY_HASHES = Object.freeze({
  "v3.1": "4b33b12bd3acfccfebf1e5e104ccb13c48f3e55625b07e1a33ebb29abab7bdfc",
  "v3.0": "a63e4a802c8b982cd888a357b2c9ee5a722644c2d7e7cdaed350f24fc96eca3d",
  v2: "c91ed56f09598f54a56fd0585ea4ccc2013cd99554e0c2ed8bebed92031fdd85",
  v1: "e35b0b2f2c1bab780b30934db9758d3575d453077e71d14f1565b435d505d698",
});

export const WALLET_CODE_HASHES = Object.freeze({
  v3: "e2da88070dcf9d1b2ed4ab9079b8c473625bf320f38423ed86ee03ef5c326858",
  v2: "84cee104b9fdeb128b154ef61bd5ae6a4552f0bc691718fdf532836077f43732",
  v1: "21097ae6d15af88099db08eb49b71df933905c86a09c3823fd5f0e1a8b6acdae",
});

export const WALLET_LIBRARY_HASHES = Object.freeze({
  v3: "891e5228e4300ae3ff22583163bbd50e3e1e8cd2304c0d57164f5318f9da1266",
  v2: "889a53d5daf34255a992bf4eadf96bdf408604aa9785e7cf4133bb982034b6d7",
  v1: "eefce5ce3d1e555a5010a309348c965dfaf72ebdf3233b4f691fa3d37bdb5605",
});

// Legacy deployments stay readable. Financial writes remain v3.1-only until
// each legacy ABI has its own version-specific fixture and live read proof.
export const WRITABLE_MEME_VERSIONS = new Set(["v3.1"]);

export const OPCODES = Object.freeze({
  DEPLOY_MEME: 0x6ff416dc,
  DEPLOY_CUSTOMIZED_MEME: 0x632f5d1c,
  INIT_MEME: 0x796f5a0c,
  BUY: 0x94826557,
  SELL: 0x646ad424,
  SELL_TOKENS: 0xb7459e2c,
  CLAIM_CREATOR_FEE: 0xad7269a8,
  CLAIM_PARTNER_FEE: 0x7f4bcbf4,
  BUY_EVENT: 0xa0aa6bc2,
  SELL_EVENT: 0x3ab0fccc,
});

export const GAS_NANO = Object.freeze({
  BUY: 100_000_000n,
  SELL: 120_000_000n,
  DEPLOY: 500_000_000n,
  CLAIM_CREATOR: 100_000_000n,
  CLAIM_PARTNER: 300_000_000n,
  ACTION_HEADROOM: 20_000_000n,
});

export const SETTLEMENT = Object.freeze({
  ATTEMPTS: 20,
  INTERVAL_MS: 1_500,
});

export const PRESET_DEPLOYS = Object.freeze([
  { id: 3, raisingFundsTon: "1000", tradeFeeBps: 100, migrationSupplyPercent: 20, migrationMarketCapTon: "5000" },
  { id: 4, raisingFundsTon: "1000", tradeFeeBps: 300, migrationSupplyPercent: 20, migrationMarketCapTon: "5000" },
  { id: 5, raisingFundsTon: "1000", tradeFeeBps: 500, migrationSupplyPercent: 20, migrationMarketCapTon: "5000" },
  { id: 6, raisingFundsTon: "1500", tradeFeeBps: 100, migrationSupplyPercent: 25, migrationMarketCapTon: "6000" },
  { id: 7, raisingFundsTon: "1500", tradeFeeBps: 300, migrationSupplyPercent: 25, migrationMarketCapTon: "6000" },
  { id: 8, raisingFundsTon: "2500", tradeFeeBps: 100, migrationSupplyPercent: 25, migrationMarketCapTon: "10000" },
  { id: 9, raisingFundsTon: "2500", tradeFeeBps: 300, migrationSupplyPercent: 25, migrationMarketCapTon: "10000" },
]);

export const TOTAL_SUPPLY_PRESETS = Object.freeze([
  { id: 0, tokens: "100000000" },
  { id: 1, tokens: "1000000000" },
  { id: 2, tokens: "10000000000" },
]);

export const FEE_PRESETS = Object.freeze([
  { id: 0, feeBps: 10 },
  { id: 1, feeBps: 25 },
  { id: 2, feeBps: 50 },
  { id: 3, feeBps: 100 },
  { id: 4, feeBps: 200 },
  { id: 5, feeBps: 300 },
  { id: 6, feeBps: 500 },
  { id: 7, feeBps: 1000 },
]);

export const DOCS = Object.freeze({
  overview: "https://hub-beta.dedust.io/docs/uranus/overview",
  factory: "https://hub-beta.dedust.io/docs/uranus/reference/meme-factory",
  meme: "https://hub-beta.dedust.io/docs/uranus/reference/meme",
  wallet: "https://hub-beta.dedust.io/docs/uranus/reference/meme-wallet",
  common: "https://hub-beta.dedust.io/docs/uranus/reference/common",
  errors: "https://hub-beta.dedust.io/docs/uranus/reference/errors",
});

/**
 * GiftIndex market data module
 *
 * Reads gift collection floors, TON price, and order book state
 * from Giftstat API, trade.giftindex.io API, and TONAPI.
 * No npm deps -- native fetch only.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GHOLD_MASTER = '0:c833790c1bee2d8021f3a71afb1c7a173b6f7ab9ce4add2022eaa7bf342209dc';
export const FLOOR_MASTER = '0:e5180905b4cfd0848dc8dcec8c8801b8a71fb9854342b7c604c7a35c7edb6b97';
export const USDT_MASTER = '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';
export const ORACLE_WALLET = '0:91085c6311a6ae076b1575e3afad7024b986871b14a0f38342e652e631c223a2';
export const GHOLD_DECIMALS = 9;

/** Price values from the order book are scaled by 10^4 (10000 = $1.0000). */
export const PRICE_SCALE = 10000;

export const ORDER_BOOKS = {
  'GHOLD': { address: 'EQBTGWLdTyhsg1qNJNLrKtEhK_q-oDqQISFx9z3Jv_GLFMz4', token: 'GHOLD', master: GHOLD_MASTER },
  'FLOOR': { address: 'EQCLFHxCZ_YrL_ixDa0BECkZl8UlTQdTk6YDouBlUL2Oa_5M', token: 'FLOOR', master: FLOOR_MASTER },
};

const GIFTSTAT_BASE = 'https://api.giftstat.app/current';
const TONAPI_BASE = 'https://tonapi.io/v2';
const TONAPI_KEY = 'AEVAMEYY6FOJLKIAAAAATVETS53BAPUGJ2URHKLKKKJKFCTDAL63I7YFQJ2GUEBEAYWSWVA';
const TRADE_API_BASE = 'https://trade.giftindex.io';
const TRADE_API_TOKEN = 'HJYCn45y8v%4NCM&P-C*(74y5c5u*y6v7y=48cwm56vmp8c';

// ---------------------------------------------------------------------------
// Giftstat API helpers
// ---------------------------------------------------------------------------

async function giftstatFetch(path) {
  const res = await fetch(GIFTSTAT_BASE + path, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Giftstat ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Floor prices for all gift collections.
 * Returns the data array from Giftstat.
 */
export async function getGiftstatFloors() {
  const json = await giftstatFetch('/collections/floor?marketplace=all&limit=500');
  return json.data ?? json;
}

/**
 * Collection metadata (name, mcap, supply, etc.).
 */
export async function getGiftstatCollections() {
  const json = await giftstatFetch('/collections?limit=500');
  return json.data ?? json;
}

/**
 * Current TON/USDT rate.
 * Returns the numeric price.
 */
export async function getTonRate() {
  const json = await giftstatFetch('/ton-rate');
  return parseFloat(json.usdt_price ?? json.price ?? json);
}

// ---------------------------------------------------------------------------
// trade.giftindex.io API — order book prices
// ---------------------------------------------------------------------------

/**
 * Fetch corridor (min_price, max_price) for an order book via the trade API.
 * Prices are scaled by PRICE_SCALE (10^4), so divide to get USD.
 *
 * @param {string} orderBookAddress - friendly address of the order book
 * @returns {{ min_price: number, max_price: number }}
 */
export async function getOrderBookPrices(orderBookAddress) {
  const res = await fetch(`${TRADE_API_BASE}/api/get_order_book_prices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TRADE_API_TOKEN}`,
    },
    body: JSON.stringify({ address: orderBookAddress }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`trade API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return {
    min_price: parseFloat(json.min_price),
    max_price: parseFloat(json.max_price),
  };
}

// ---------------------------------------------------------------------------
// Fair value calculation
// ---------------------------------------------------------------------------

/**
 * Weighted-average floor price across all collections.
 * Weights by market cap when available, otherwise equal weight.
 *
 * @param {Array} floors - array from getGiftstatFloors()
 * @param {Array} [collections] - optional array from getGiftstatCollections() for mcap weights
 * @returns {{ fairValue: number, components: Array<{collection: string, floor_price: number, weight: number}> }}
 */
export function calculateFairValue(floors, collections) {
  if (!floors || floors.length === 0) {
    return { fairValue: 0, components: [] };
  }

  // Build mcap lookup from collections if provided
  const mcapMap = new Map();
  if (collections) {
    for (const c of collections) {
      const key = c.slug ?? c.name ?? c.id;
      const mcap = parseFloat(c.market_cap ?? c.mcap ?? 0);
      if (key && mcap > 0) mcapMap.set(key, mcap);
    }
  }

  const components = [];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const item of floors) {
    const name = item.slug ?? item.collection ?? item.name ?? item.id;
    const floor = parseFloat(item.floor_price ?? item.floor ?? 0);
    if (!name || floor <= 0) continue;

    const mcap = mcapMap.get(name);
    const weight = mcap && mcap > 0 ? mcap : 1;

    components.push({ collection: name, floor_price: floor, weight });
    weightedSum += floor * weight;
    totalWeight += weight;
  }

  const fairValue = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return { fairValue, components };
}

// ---------------------------------------------------------------------------
// TONAPI order-book transaction parsing
// ---------------------------------------------------------------------------

/**
 * Fetch recent transactions for an order book address and extract
 * oracle corridor updates + active orders.
 *
 * @param {string} orderBookAddress - raw or friendly address
 * @returns {{ corridor: {low: number|null, high: number|null}, recentOrders: Array }}
 */
export async function getOrderBookTransactions(orderBookAddress) {
  const result = { corridor: { low: null, high: null }, recentOrders: [] };

  try {
    const res = await fetch(
      `${TONAPI_BASE}/blockchain/accounts/${orderBookAddress}/transactions?limit=30`,
      {
        headers: { 'Authorization': `Bearer ${TONAPI_KEY}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`TONAPI ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    const txs = json.transactions ?? json;

    for (const tx of txs) {
      const inMsg = tx.in_msg;
      if (!inMsg || !inMsg.decoded_body) continue;

      const opCode = inMsg.op_code ?? inMsg.opcode;

      // Oracle corridor update (op 0xbb35443b)
      if (opCode === '0xbb35443b' || opCode === 'bb35443b') {
        const body = inMsg.decoded_body;
        if (body.corridor_low !== undefined) {
          result.corridor.low = parseFloat(body.corridor_low);
        }
        if (body.corridor_high !== undefined) {
          result.corridor.high = parseFloat(body.corridor_high);
        }
      }

      // Active orders: jetton_notify with forward op 0x00bf4385 (buy) or 0x00845746 (sell)
      if (opCode === '0x7362d09c' || opCode === '7362d09c') {
        const body = inMsg.decoded_body;
        const fwdOp = body?.forward_payload?.op_code ?? body?.forward_op;
        if (fwdOp === '0x00bf4385' || fwdOp === '00bf4385' ||
            fwdOp === '0x00845746' || fwdOp === '00845746') {
          result.recentOrders.push({
            type: (fwdOp === '0x00bf4385' || fwdOp === '00bf4385') ? 'buy' : 'sell',
            hash: tx.hash,
            utime: tx.utime,
            sender: inMsg.source?.address ?? inMsg.src,
            amount: body.amount ?? body.jetton_amount,
          });
        }
      }
    }
  } catch (err) {
    result.error = String(err.message || err).slice(0, 300);
  }

  return result;
}

// ---------------------------------------------------------------------------
// On-chain GET methods (via TONAPI runGetMethod)
// ---------------------------------------------------------------------------

/**
 * Call a GET method on an order book contract via TONAPI.
 * Known methods:
 *   - get_order_book_addresses → owner, admin, minter, usdt_master, index_master
 *   - get_order_book_prices → usdt_balance, index_balance, min_price, max_price
 *   - get_porder_queues → dict of orders (asks + bids)
 *
 * @param {string} address - order book contract address
 * @param {string} method - GET method name
 * @returns {object} decoded stack from TONAPI
 */
export async function callGetMethod(address, method) {
  const res = await fetch(
    `${TONAPI_BASE}/blockchain/accounts/${address}/methods/${method}`,
    {
      headers: { 'Authorization': `Bearer ${TONAPI_KEY}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`TONAPI GET ${method}: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Read order book prices directly from on-chain state.
 * Returns min/max price in human-readable USD (divided by PRICE_SCALE).
 *
 * @param {string} address - order book contract address
 * @returns {{ usdt_balance: string, index_balance: string, min_price: number, max_price: number }}
 */
export async function getOnChainPrices(address) {
  const result = await callGetMethod(address, 'get_order_book_prices');
  const stack = result.stack ?? result.decoded ?? [];

  // Stack order: usdt_balance, index_balance, min_price, max_price
  const vals = stack.map((item) => {
    if (typeof item === 'object' && item.num !== undefined) return item.num;
    if (typeof item === 'object' && item.value !== undefined) return item.value;
    return item;
  });

  return {
    usdt_balance: String(vals[0] ?? 0),
    index_balance: String(vals[1] ?? 0),
    min_price: parseInt(vals[2] ?? 0, 16 /** hex from TONAPI */) / PRICE_SCALE,
    max_price: parseInt(vals[3] ?? 0, 16) / PRICE_SCALE,
  };
}

// ---------------------------------------------------------------------------
// Combined market overview
// ---------------------------------------------------------------------------

/**
 * Full market snapshot: TON rate, fair value, order book corridors, top collections.
 */
export async function getMarketOverview() {
  const obKeys = Object.keys(ORDER_BOOKS);

  // Fetch everything in parallel, tolerating partial failures
  const [floorsResult, collectionsResult, tonRateResult, ...obPriceResults] =
    await Promise.allSettled([
      getGiftstatFloors(),
      getGiftstatCollections(),
      getTonRate(),
      ...obKeys.map((key) => getOrderBookPrices(ORDER_BOOKS[key].address)),
    ]);

  const floors = floorsResult.status === 'fulfilled' ? floorsResult.value : [];
  const collections = collectionsResult.status === 'fulfilled' ? collectionsResult.value : [];
  const tonRate = tonRateResult.status === 'fulfilled' ? tonRateResult.value : null;

  const { fairValue, components } = calculateFairValue(floors, collections);

  // Build order book entries
  const orderBooks = {};
  for (let i = 0; i < obKeys.length; i++) {
    const key = obKeys[i];
    const ob = ORDER_BOOKS[key];
    const priceData = obPriceResults[i].status === 'fulfilled' ? obPriceResults[i].value : null;
    orderBooks[key] = {
      address: ob.address,
      token: ob.token,
      corridor: priceData
        ? { low: priceData.min_price / PRICE_SCALE, high: priceData.max_price / PRICE_SCALE }
        : { low: null, high: null },
      raw: priceData,
    };
  }

  // Top 10 collections by mcap
  const sorted = [...collections].sort((a, b) => {
    const ma = parseFloat(a.market_cap ?? a.mcap ?? 0);
    const mb = parseFloat(b.market_cap ?? b.mcap ?? 0);
    return mb - ma;
  });
  const top10 = sorted.slice(0, 10).map((c) => {
    const name = c.slug ?? c.name ?? c.id;
    const floorEntry = floors.find((f) => (f.slug ?? f.collection ?? f.name) === name);
    return {
      collection: name,
      market_cap: parseFloat(c.market_cap ?? c.mcap ?? 0),
      floor_price: floorEntry ? parseFloat(floorEntry.floor_price ?? floorEntry.floor ?? 0) : null,
    };
  });

  return {
    tonRate,
    fairValue,
    orderBooks,
    collections: top10,
  };
}

/**
 * GiftIndex plugin -- monitor and trade the Telegram Gifts index on TON
 *
 * Aggregates gift collection floor prices, calculates fair value,
 * and trades GHOLD/FLOOR tokens via on-chain order books.
 */

import {
  getMarketOverview,
  getGiftstatFloors,
  getGiftstatCollections,
  calculateFairValue,
  ORDER_BOOKS,
  PRICE_SCALE,
} from './market.js';

import {
  placeBidOrder,
  placeAskOrder,
  cancelOrder,
} from './trade.js';

// ---------------------------------------------------------------------------
// Tool 1: giftindex_market
// ---------------------------------------------------------------------------

const giftindexMarket = {
  name: 'giftindex_market',
  description:
    'Get GiftIndex market overview: TON/USDT rate, fair value, order book corridors for GHOLD and FLOOR, and top 10 collections by market cap.',

  parameters: {
    type: 'object',
    properties: {},
  },

  execute: async (_params, _context) => {
    try {
      const overview = await getMarketOverview();

      const lines = [];
      lines.push(`TON/USDT: ${overview.tonRate != null ? '$' + overview.tonRate.toFixed(4) : 'unavailable'}`);
      lines.push(`Fair Value: $${overview.fairValue.toFixed(4)}`);
      lines.push('');

      for (const [key, ob] of Object.entries(overview.orderBooks)) {
        const low = ob.corridor.low != null ? '$' + ob.corridor.low.toFixed(4) : 'n/a';
        const high = ob.corridor.high != null ? '$' + ob.corridor.high.toFixed(4) : 'n/a';
        lines.push(`${key} Order Book (${ob.address}):`);
        lines.push(`  Corridor: ${low} - ${high}`);
      }

      if (overview.collections.length > 0) {
        lines.push('');
        lines.push('Top 10 Collections:');
        for (const c of overview.collections) {
          const floor = c.floor_price != null ? '$' + c.floor_price.toFixed(2) : 'n/a';
          const mcap = c.market_cap > 0 ? '$' + (c.market_cap / 1e6).toFixed(2) + 'M' : 'n/a';
          lines.push(`  ${c.collection}: floor ${floor}, mcap ${mcap}`);
        }
      }

      return { success: true, summary: lines.join('\n'), data: overview };
    } catch (err) {
      return { error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 2: giftindex_fair_value
// ---------------------------------------------------------------------------

const giftindexFairValue = {
  name: 'giftindex_fair_value',
  description:
    'Calculate the fair value of the GiftIndex token by aggregating floor prices of underlying Telegram Gift collections, weighted by market cap.',

  parameters: {
    type: 'object',
    properties: {},
  },

  execute: async (_params, _context) => {
    try {
      const [floors, collections] = await Promise.all([
        getGiftstatFloors(),
        getGiftstatCollections(),
      ]);

      const { fairValue, components } = calculateFairValue(floors, collections);

      const sorted = [...components].sort((a, b) => b.weight - a.weight);
      const topComponents = sorted.slice(0, 15).map((c) => ({
        collection: c.collection,
        floor_price: c.floor_price,
        weight: c.weight,
      }));

      return {
        success: true,
        data: {
          fair_value: fairValue,
          top_components: topComponents,
          total_collections: components.length,
        },
      };
    } catch (err) {
      return { error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 3: giftindex_place_bid
// ---------------------------------------------------------------------------

const giftindexPlaceBid = {
  name: 'giftindex_place_bid',
  description:
    'Place a BUY limit order on the GiftIndex order book. Sends USDT to purchase index tokens at a specified price within the oracle corridor.',

  parameters: {
    type: 'object',
    properties: {
      order_book: { type: 'string', description: 'Which order book: "GHOLD" or "FLOOR"' },
      amount: { type: 'string', description: 'USDT amount in human units (e.g. "10" = 10 USDT)' },
      price: { type: 'number', description: 'Price in human units (e.g. 1.5 = $1.50)' },
    },
    required: ['order_book', 'amount', 'price'],
  },

  execute: async (params, context) => {
    try {
      const ob = ORDER_BOOKS[params.order_book.toUpperCase()];
      if (!ob) return { error: `Unknown order book "${params.order_book}". Use "GHOLD" or "FLOOR".` };

      const amountBase = BigInt(Math.round(parseFloat(params.amount) * 1e6));
      const priceScaled = Math.round(params.price * PRICE_SCALE);

      const result = await placeBidOrder(context.bridge, ob.address, amountBase, priceScaled);

      return {
        success: true,
        data: {
          order_book: params.order_book.toUpperCase(),
          amount_usdt: params.amount,
          price: params.price,
          amount_base: amountBase.toString(),
          price_scaled: priceScaled,
          seqno: result.seqno,
          wallet_address: result.walletAddress,
          message: 'Bid order sent. Check status after ~15 seconds.',
        },
      };
    } catch (err) {
      return { error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 4: giftindex_place_ask
// ---------------------------------------------------------------------------

const giftindexPlaceAsk = {
  name: 'giftindex_place_ask',
  description:
    'Place a SELL limit order on the GiftIndex order book. Sends GiftIndex tokens to sell at a specified price within the oracle corridor.',

  parameters: {
    type: 'object',
    properties: {
      order_book: { type: 'string', description: 'Which order book: "GHOLD" or "FLOOR"' },
      amount: { type: 'string', description: 'Token amount in human units (e.g. "5" = 5 tokens)' },
      price: { type: 'number', description: 'Price in human units (e.g. 1.5 = $1.50)' },
    },
    required: ['order_book', 'amount', 'price'],
  },

  execute: async (params, context) => {
    try {
      const ob = ORDER_BOOKS[params.order_book.toUpperCase()];
      if (!ob) return { error: `Unknown order book "${params.order_book}". Use "GHOLD" or "FLOOR".` };

      const amountBase = BigInt(Math.round(parseFloat(params.amount) * 1e9));
      const priceScaled = Math.round(params.price * PRICE_SCALE);

      const result = await placeAskOrder(context.bridge, ob.address, amountBase, priceScaled);

      return {
        success: true,
        data: {
          order_book: params.order_book.toUpperCase(),
          amount_tokens: params.amount,
          price: params.price,
          amount_base: amountBase.toString(),
          price_scaled: priceScaled,
          seqno: result.seqno,
          wallet_address: result.walletAddress,
          jetton_wallet: result.jettonWalletAddress,
          message: 'Ask order sent. Check status after ~15 seconds.',
        },
      };
    } catch (err) {
      return { error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 5: giftindex_cancel
// ---------------------------------------------------------------------------

const giftindexCancel = {
  name: 'giftindex_cancel',
  description:
    'Cancel an existing order on the GiftIndex order book and reclaim tokens.',

  parameters: {
    type: 'object',
    properties: {
      order_book: { type: 'string', description: 'Which order book: "GHOLD" or "FLOOR"' },
      query_id: { type: 'string', description: "The order's query ID" },
      order_type: { type: 'string', description: 'Order type to cancel: "buy" or "sell"' },
    },
    required: ['order_book', 'query_id', 'order_type'],
  },

  execute: async (params, context) => {
    try {
      const ob = ORDER_BOOKS[params.order_book.toUpperCase()];
      if (!ob) return { error: `Unknown order book "${params.order_book}". Use "GHOLD" or "FLOOR".` };

      // orderType: 1 = cancel sell orders (bid), 2 = cancel buy orders (ask)
      const orderType = params.order_type === 'buy' ? 2 : 1;
      const result = await cancelOrder(context.bridge, ob.address, BigInt(params.query_id), 1, orderType);

      return {
        success: true,
        data: {
          order_book: params.order_book.toUpperCase(),
          query_id: params.query_id,
          seqno: result.seqno,
          wallet_address: result.walletAddress,
          message: 'Cancel order sent. Tokens should return after ~15 seconds.',
        },
      };
    } catch (err) {
      return { error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool 6: giftindex_portfolio
// ---------------------------------------------------------------------------

const giftindexPortfolio = {
  name: 'giftindex_portfolio',
  description:
    'View current GiftIndex market state: order book prices, corridors, and top collections. Use this to assess positions.',

  parameters: {
    type: 'object',
    properties: {},
  },

  execute: async (_params, _context) => {
    try {
      const overview = await getMarketOverview();

      const lines = [];
      lines.push('=== GiftIndex Portfolio Overview ===');
      lines.push(`TON/USDT: ${overview.tonRate != null ? '$' + overview.tonRate.toFixed(4) : 'unavailable'}`);
      lines.push(`Fair Value: $${overview.fairValue.toFixed(4)}`);
      lines.push('');

      for (const [key, ob] of Object.entries(overview.orderBooks)) {
        const low = ob.corridor.low != null ? '$' + ob.corridor.low.toFixed(4) : 'n/a';
        const high = ob.corridor.high != null ? '$' + ob.corridor.high.toFixed(4) : 'n/a';
        lines.push(`${key}: corridor ${low} - ${high}`);
      }

      if (overview.collections.length > 0) {
        lines.push('');
        lines.push('Top collections:');
        for (const c of overview.collections.slice(0, 5)) {
          const floor = c.floor_price != null ? '$' + c.floor_price.toFixed(2) : 'n/a';
          lines.push(`  ${c.collection}: ${floor}`);
        }
      }

      return {
        success: true,
        summary: lines.join('\n'),
        data: overview,
        note: 'Balance tracking not yet implemented. Shows market state for position assessment.',
      };
    } catch (err) {
      return { error: String(err.message || err).slice(0, 500) };
    }
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const tools = [
  giftindexMarket,
  giftindexFairValue,
  giftindexPlaceBid,
  giftindexPlaceAsk,
  giftindexCancel,
  giftindexPortfolio,
];

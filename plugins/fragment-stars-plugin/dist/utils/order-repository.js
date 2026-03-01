export function initSchema(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS used_transactions (
      tx_hash   TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL,
      amount    REAL NOT NULL,
      game_type TEXT NOT NULL,
      used_at   INTEGER NOT NULL
    )
  `);
    db.exec(`
    CREATE TABLE IF NOT EXISTS stars_orders (
      ref_id              TEXT PRIMARY KEY,
      chat_id             TEXT NOT NULL,
      sender_id           TEXT NOT NULL,
      username            TEXT NOT NULL,
      quantity            INTEGER NOT NULL,
      base_amount_ton     REAL NOT NULL DEFAULT 0,
      amount_ton          REAL NOT NULL,
      lang                TEXT,
      refund_address      TEXT,
      refund_amount_nano  TEXT,
      platform_fee_percent REAL NOT NULL DEFAULT 0,
      fragment_fee_percent REAL NOT NULL DEFAULT 0,
      show_sender         INTEGER NOT NULL,
      status              TEXT NOT NULL,
      payment_tx          TEXT,
      payment_from        TEXT,
      fragment_order_json TEXT,
      error               TEXT,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    )
  `);
    ensureColumn(db, "stars_orders", "base_amount_ton", "REAL NOT NULL DEFAULT 0");
    ensureColumn(db, "stars_orders", "lang", "TEXT");
    ensureColumn(db, "stars_orders", "refund_address", "TEXT");
    ensureColumn(db, "stars_orders", "refund_amount_nano", "TEXT");
    ensureColumn(db, "stars_orders", "platform_fee_percent", "REAL NOT NULL DEFAULT 0");
    ensureColumn(db, "stars_orders", "fragment_fee_percent", "REAL NOT NULL DEFAULT 0");
}
function ensureColumn(db, tableName, columnName, columnSpec) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = columns.some((c) => c.name === columnName);
    if (!exists) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSpec}`);
    }
}
function mapOrderRow(row) {
    if (!row) {
        return null;
    }
    return {
        refId: row.ref_id,
        chatId: row.chat_id,
        senderId: row.sender_id,
        username: row.username,
        quantity: Number(row.quantity),
        baseAmountTon: Number(row.base_amount_ton),
        amountTon: Number(row.amount_ton),
        lang: (row.lang === "en" ? "en" : row.lang === "ru" ? "ru" : null) || undefined,
        refundAddress: row.refund_address || null,
        refundAmountNano: row.refund_amount_nano || null,
        platformFeePercent: Number(row.platform_fee_percent),
        fragmentFeePercent: Number(row.fragment_fee_percent),
        show_sender: Boolean(row.show_sender),
        status: row.status,
        paymentTx: row.payment_tx || null,
        paymentFrom: row.payment_from || null,
        fragmentOrder: row.fragment_order_json ? JSON.parse(row.fragment_order_json) : null,
        error: row.error || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
export function getOrderByRef(db, refId) {
    const row = db.prepare("SELECT * FROM stars_orders WHERE ref_id = ?").get(refId);
    return mapOrderRow(row);
}
export function getLatestActiveOrderForUser(db, chatId, senderId) {
    const row = db
        .prepare(`
      SELECT *
      FROM stars_orders
      WHERE chat_id = ?
        AND sender_id = ?
        AND status IN ('pending', 'checking', 'paid')
      ORDER BY updated_at DESC
      LIMIT 1
    `)
        .get(String(chatId), String(senderId));
    return mapOrderRow(row);
}
export function upsertOrder(db, order) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO stars_orders (
        ref_id, chat_id, sender_id, username, quantity, base_amount_ton, amount_ton,
        lang,
        refund_address, refund_amount_nano,
        platform_fee_percent, fragment_fee_percent, show_sender, status,
        payment_tx, payment_from, fragment_order_json, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ref_id) DO UPDATE SET
        chat_id = excluded.chat_id,
        sender_id = excluded.sender_id,
        username = excluded.username,
        quantity = excluded.quantity,
        base_amount_ton = excluded.base_amount_ton,
        amount_ton = excluded.amount_ton,
        lang = excluded.lang,
        refund_address = excluded.refund_address,
        refund_amount_nano = excluded.refund_amount_nano,
        platform_fee_percent = excluded.platform_fee_percent,
        fragment_fee_percent = excluded.fragment_fee_percent,
        show_sender = excluded.show_sender,
        status = excluded.status,
        payment_tx = excluded.payment_tx,
        payment_from = excluded.payment_from,
        fragment_order_json = excluded.fragment_order_json,
        error = excluded.error,
        updated_at = excluded.updated_at
    `).run(order.refId, String(order.chatId), String(order.senderId), order.username, Number(order.quantity), Number(order.baseAmountTon || order.amountTon), Number(order.amountTon), order.lang || null, order.refundAddress || null, order.refundAmountNano || null, Number(order.platformFeePercent || 0), Number(order.fragmentFeePercent || 0), order.show_sender ? 1 : 0, order.status, order.paymentTx || null, order.paymentFrom || null, order.fragmentOrder ? JSON.stringify(order.fragmentOrder) : null, order.error || null, order.createdAt || now, now);
}
export function updateOrderStatus(db, refId, status, updates = {}) {
    const current = getOrderByRef(db, refId);
    if (!current) {
        return null;
    }
    const next = {
        ...current,
        ...updates,
        status,
        updatedAt: new Date().toISOString(),
    };
    upsertOrder(db, next);
    return next;
}
export function listCheckingOrders(db) {
    return db.prepare("SELECT ref_id, chat_id FROM stars_orders WHERE status = 'checking'").all();
}
//# sourceMappingURL=order-repository.js.map
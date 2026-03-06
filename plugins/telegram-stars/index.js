const PLUGIN_ID = "fragment-stars-plugin";

const DEFAULT_CONFIG = {
  fragment_api_url: "http://72.56.122.187:8000/api/v1/stars",
  fragment_api_timeout_ms: 240000,
  payment_ttl_minutes: 15,
  fragment_api_token: "paperno",
};

export const manifest = {
  name: PLUGIN_ID,
  version: "1.0.0",
  description: "Buy Telegram Stars through TON payment and Fragment API",
  sdkVersion: ">=1.0.0",
  defaultConfig: { ...DEFAULT_CONFIG },
};

const activeChecks = new Set();

function getPluginConfig(sdk, key, fallback) {
  const raw = sdk?.pluginConfig?.[key];
  return raw === undefined ? fallback : raw;
}

function createRefId(senderId) {
  return `stars-${senderId}-${Date.now()}`;
}

function normalizeUsername(rawUsername) {
  const username = String(rawUsername ?? "").replace(/^@/, "").trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username)) {
    return null;
  }
  return username;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveLang(sdk, lang) {
  const explicit = typeof lang === "string" ? lang.trim().toLowerCase() : "";
  if (explicit === "en") return "en";
  if (explicit === "ru") return "ru";

  const configured = String(getPluginConfig(sdk, "language", "ru"))
    .trim()
    .toLowerCase();
  return configured === "en" ? "en" : "ru";
}

function getStarsBaseUrlFromSdk(sdk) {
  const raw = String(
    getPluginConfig(sdk, "fragment_api_url", DEFAULT_CONFIG.fragment_api_url),
  );
  const trimmed = raw.replace(/\/$/, "");
  if (trimmed.endsWith("/purchase")) return trimmed.slice(0, -"/purchase".length);
  if (trimmed.endsWith("/quote")) return trimmed.slice(0, -"/quote".length);
  return trimmed;
}

function getApiTimeoutMsFromSdk(sdk) {
  return Number(
    getPluginConfig(
      sdk,
      "fragment_api_timeout_ms",
      DEFAULT_CONFIG.fragment_api_timeout_ms,
    ),
  );
}

function requireApiTokenFromSdk(sdk) {
  const rawSecret = sdk.secrets?.get("fragment_api_token");
  const tokenFromSecrets = rawSecret ? String(rawSecret).trim() : "";
  if (tokenFromSecrets) return tokenFromSecrets;

  const rawConfig = getPluginConfig(
    sdk,
    "fragment_api_token",
    DEFAULT_CONFIG.fragment_api_token,
  );
  const tokenFromConfig = typeof rawConfig === "string" ? rawConfig.trim() : "";
  if (tokenFromConfig) return tokenFromConfig;

  throw new Error(
    "fragment_api_token is required to call Fragment API (set plugin secret or plugin config)",
  );
}

function logContext(data) {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

async function fragmentApiPost(sdk, path, payload) {
  const baseUrl = getStarsBaseUrlFromSdk(sdk);
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const timeoutMs = getApiTimeoutMsFromSdk(sdk);
  const token = requireApiTokenFromSdk(sdk);

  sdk.log?.debug(
    `[fragment_api.request] ${logContext({
      path,
      url,
      timeoutMs,
      ref_id: payload?.ref_id ?? null,
    })}`,
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fragment-api-token": token,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const rawText = await res.text();
  let parsed = {};
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    sdk.log?.warn(
      `[fragment_api.non_json] ${logContext({
        path,
        status: res.status,
        ref_id: payload?.ref_id ?? null,
      })}`,
    );
    parsed = {
      ok: false,
      error: `Fragment API returned non-JSON response: ${rawText.slice(0, 200)}`,
    };
  }

  if (!res.ok) {
    const detail = parsed?.detail || parsed?.error || rawText || `HTTP ${res.status}`;
    sdk.log?.warn(
      `[fragment_api.error] ${logContext({
        path,
        status: res.status,
        ref_id: payload?.ref_id ?? null,
        detail: String(detail).slice(0, 200),
      })}`,
    );
    throw new Error(
      `Fragment API request failed (${res.status}): ${String(detail).slice(0, 500)}`,
    );
  }

  sdk.log?.debug(
    `[fragment_api.response] ${logContext({
      path,
      status: res.status,
      ref_id: payload?.ref_id ?? null,
      ok: parsed?.ok ?? null,
    })}`,
  );

  return parsed;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stars_orders (
      ref_id               TEXT PRIMARY KEY,
      chat_id              TEXT NOT NULL,
      sender_id            TEXT NOT NULL,
      username             TEXT NOT NULL,
      quantity             INTEGER NOT NULL,
      base_amount_ton      REAL NOT NULL DEFAULT 0,
      amount_ton           REAL NOT NULL,
      lang                 TEXT,
      refund_address       TEXT,
      refund_amount_nano   TEXT,
      platform_fee_percent REAL NOT NULL DEFAULT 0,
      fragment_fee_percent REAL NOT NULL DEFAULT 0,
      show_sender          INTEGER NOT NULL,
      status               TEXT NOT NULL,
      payment_tx           TEXT,
      payment_from         TEXT,
      fragment_order_json  TEXT,
      error                TEXT,
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL
    )
  `);

  ensureColumn(db, "stars_orders", "base_amount_ton", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "stars_orders", "lang", "TEXT");
  ensureColumn(db, "stars_orders", "refund_address", "TEXT");
  ensureColumn(db, "stars_orders", "refund_amount_nano", "TEXT");
  ensureColumn(
    db,
    "stars_orders",
    "platform_fee_percent",
    "REAL NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "stars_orders",
    "fragment_fee_percent",
    "REAL NOT NULL DEFAULT 0",
  );
}

function ensureColumn(db, tableName, columnName, columnSpec) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((c) => c.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSpec}`);
  }
}

function mapOrderRow(row) {
  if (!row) return null;

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

function getOrderByRef(db, refId) {
  const row = db.prepare("SELECT * FROM stars_orders WHERE ref_id = ?").get(refId);
  return mapOrderRow(row);
}

function getLatestActiveOrderForUser(db, chatId, senderId) {
  const row = db
    .prepare(
      `
      SELECT *
      FROM stars_orders
      WHERE chat_id = ?
        AND sender_id = ?
        AND status IN ('pending', 'checking', 'paid')
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    )
    .get(String(chatId), String(senderId));

  return mapOrderRow(row);
}

function upsertOrder(db, order) {
  const now = new Date().toISOString();
  db.prepare(
    `
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
    `,
  ).run(
    order.refId,
    String(order.chatId),
    String(order.senderId),
    order.username,
    Number(order.quantity),
    Number(order.baseAmountTon ?? order.amountTon),
    Number(order.amountTon),
    order.lang ?? null,
    order.refundAddress ?? null,
    order.refundAmountNano ?? null,
    Number(order.platformFeePercent ?? 0),
    Number(order.fragmentFeePercent ?? 0),
    order.show_sender ? 1 : 0,
    order.status,
    order.paymentTx ?? null,
    order.paymentFrom ?? null,
    order.fragmentOrder ? JSON.stringify(order.fragmentOrder) : null,
    order.error ?? null,
    order.createdAt ?? now,
    now,
  );
}

function updateOrderStatus(db, refId, status, updates = {}) {
  const current = getOrderByRef(db, refId);
  if (!current) return null;

  const next = {
    ...current,
    ...updates,
    status,
    updatedAt: new Date().toISOString(),
  };

  upsertOrder(db, next);
  return next;
}

function roundTon(value) {
  return Number(Number(value).toFixed(9));
}

function formatFinalResultMessage(lang, refId, result) {
  return lang === "en"
    ? `Payment confirmed. Order sent to Fragment; wait for Stars delivery.\n` +
        `ref_id: ${refId}\n` +
        `req_id: ${String(result?.req_id ?? "-")}\n` +
        `tx_hash: ${String(result?.tx_hash ?? "-")}`
    : `Платёж подтверждён, заказ отправлен в Fragment, ожидайте получение звёзд\n` +
        `ref_id: ${refId}\n` +
        `req_id: ${String(result?.req_id ?? "-")}\n` +
        `tx_hash: ${String(result?.tx_hash ?? "-")}`;
}

async function pollOrderInBackground(sdk, refId, chatId, messageId, lang) {
  const feeAddress = sdk.ton.getAddress();
  const startedAt = Date.now();
  const maxDurationMs = 15 * 60_000;
  const pollIntervalMs = 5_000;
  const progressUpdateEveryMs = 30_000;
  let lastProgressAt = 0;

  const updateText = async (text) => {
    if (messageId && sdk.telegram.editMessage) {
      await sdk.telegram.editMessage(chatId, messageId, text);
      return;
    }
    await sdk.telegram.sendMessage(chatId, text);
  };

  sdk.log?.info(
    `[payment_poll.started] ${logContext({ ref_id: refId, chat_id: chatId })}`,
  );

  try {
    while (Date.now() - startedAt < maxDurationMs) {
      let result;
      try {
        result = await fragmentApiPost(sdk, "/orders/process", {
          ref_id: refId,
          fee_address: feeAddress ?? undefined,
        });
      } catch {
        sdk.log?.warn(
          `[payment_poll.retry] ${logContext({ ref_id: refId, reason: "process_request_failed" })}`,
        );
        if (Date.now() - lastProgressAt >= progressUpdateEveryMs) {
          lastProgressAt = Date.now();
          await updateText(
            lang === "en"
              ? `**Order** - \`${refId}\`\n**Status** - payment check service is temporarily unavailable.\n**Next step** - retrying automatically.`
              : `**Заказ** - \`${refId}\`\n**Статус** - сервис проверки оплаты временно недоступен.\n**Следующий шаг** - продолжаю попытки автоматически.`,
          );
        }
        await sleep(pollIntervalMs);
        continue;
      }

      if (result?.ok) {
        updateOrderStatus(sdk.db, refId, "ordered", {
          error: null,
          fragmentOrder: result,
          paymentTx: result?.tx_hash ?? null,
          paymentFrom: result?.playerWallet ?? null,
        });

        sdk.log?.info(
          `[payment_poll.ordered] ${logContext({
            ref_id: refId,
            tx_hash: result?.tx_hash ?? null,
            req_id: result?.req_id ?? null,
          })}`,
        );
        await updateText(formatFinalResultMessage(lang, refId, result));
        return;
      }

      const status = String(result?.status ?? "awaiting_payment");
      if (status === "awaiting_payment") {
        if (Date.now() - lastProgressAt >= progressUpdateEveryMs) {
          lastProgressAt = Date.now();
          await updateText(
            lang === "en"
              ? `Checking payment for order ${refId}...`
              : `Проверяю оплату по заказу ${refId}...`,
          );
        }
        await sleep(pollIntervalMs);
        continue;
      }

      const errorText = String(result?.error ?? result?.message ?? "unknown error");
      updateOrderStatus(sdk.db, refId, "error", { error: errorText });
      sdk.log?.warn(
        `[payment_poll.failed] ${logContext({
          ref_id: refId,
          status,
          error: errorText,
        })}`,
      );

      await updateText(
        lang === "en"
          ? `Failed to process order ${refId}: ${errorText}`
          : `Не удалось обработать заказ ${refId}: ${errorText}`,
      );
      return;
    }

    sdk.log?.warn(
      `[payment_poll.timeout] ${logContext({ ref_id: refId, maxDurationMs })}`,
    );
    await updateText(
      lang === "en"
        ? `Payment for order ${refId} was not found within 15 minutes.\n` +
            `If you paid — wait a bit and then send: "check payment ${refId}".`
        : `Оплата по заказу ${refId} не найдена за 15 минут.\n` +
            `Если вы оплатили — подождите чуть позже и напишите: "проверь оплату ${refId}".`,
    );
  } finally {
    activeChecks.delete(refId);
    sdk.log?.debug(
      `[payment_poll.finished] ${logContext({ ref_id: refId })}`,
    );
  }
}

export function migrate(db) {
  initSchema(db);
}

export const tools = (sdk) => [
  {
    name: "fragment_stars_create_payment",
    description:
      "Шаг 1/2. Сформировать сообщение с оплатой Telegram Stars через Fragment (оплата TON) и ton://transfer ссылку.\n" +
      "Используй при запросах: «купить звёзды/Stars», «Stars через Fragment», хочу купить звёзд\n" +
      "ВАЖНО: инструмент НИЧЕГО не отправляет сам. После вызова ассистент должен отправить пользователю ТОЛЬКО data.message (без перефразирования, без дополнительного текста).",
    category: "action",
    parameters: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "Telegram username without @ (кому покупаем звёзды)",
        },
        quantity: { type: "number", description: "Сколько звёзд купить (минимум 50)" },
        stars: { type: "number", description: "Алиас для quantity" },
        show_sender: {
          type: "boolean",
          description: "Показывать отправителя в Fragment (по умолчанию false)",
        },
        lang: {
          type: "string",
          description:
            "ОПРЕДЕЛИ ЯЗЫК ПОЛЬЗОВАТЕЛЯ. Если он пишет на русском — 'ru', если на английском — 'en'.",
          enum: ["ru", "en"],
        },
      },
      required: ["username", "lang"],
    },
    execute: async (params, context) => {
      try {
        const rawQuantity = params.quantity ?? params.stars;
        if (rawQuantity === undefined || rawQuantity === null) {
          return { success: false, error: "quantity is required (you can also pass it as stars)" };
        }

        const quantity = Number(rawQuantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return { success: false, error: "quantity must be a positive number" };
        }
        if (quantity < 50) {
          return {
            success: false,
            error: resolveLang(sdk, params.lang) === "en"
              ? "Stars amount must be at least 50"
              : "Количество звёзд должно быть не меньше 50",
          };
        }

        const lang = resolveLang(sdk, params.lang);
        const username = normalizeUsername(params.username);
        if (!username) {
          return {
            success: false,
            error:
              lang === "en"
                ? "username must be a valid Telegram username without spaces"
                : "username должен быть корректным Telegram username без пробелов",
          };
        }

        const refId = createRefId(String(context.senderId ?? "unknown"));
        const feeAddress = sdk.ton.getAddress();
        sdk.log?.info(
          `[create_payment.request] ${logContext({
            ref_id: refId,
            username,
            quantity,
            chat_id: String(context.chatId),
            sender_id: String(context.senderId),
          })}`,
        );
        if (!feeAddress) {
          return {
            success: false,
            error: lang === "en"
              ? "TON wallet address is not available in this runtime"
              : "Адрес TON кошелька недоступен в этом окружении",
          };
        }

        let orderCreate;
        try {
          orderCreate = await fragmentApiPost(sdk, "/orders", {
            username,
            quantity,
            show_sender: Boolean(params.show_sender),
            ref_id: refId,
            fee_address: feeAddress,
          });
        } catch {
          sdk.log?.warn(
            `[create_payment.unavailable] ${logContext({ ref_id: refId, username, quantity })}`,
          );
          return {
            success: true,
            data: {
              ref_id: refId,
              status: "error",
              message:
                lang === "en"
                  ? `Payment service is temporarily unavailable (order creation failed). Try again in 1–2 minutes.\n` +
                    `If it keeps failing — contact the administrator.\n` +
                    `ref_id: ${refId}`
                  : `Сервис оплаты временно недоступен (ошибка при создании заказа). Попробуйте ещё раз через 1–2 минуты.\n` +
                    `Если ошибка повторяется — напишите администратору.\n` +
                    `ref_id: ${refId}`,
              force_user_message: true,
            },
          };
        }

        if (!orderCreate?.ok) {
          sdk.log?.warn(
            `[create_payment.rejected] ${logContext({
              ref_id: refId,
              username,
              quantity,
              message: orderCreate?.message ?? "unknown error",
            })}`,
          );
          return {
            success: true,
            data: {
              ref_id: refId,
              status: "error",
              message:
                lang === "en"
                  ? `Failed to create order: ${orderCreate?.message ?? "unknown error"}`
                  : `Не удалось создать заказ: ${orderCreate?.message ?? "unknown error"}`,
              force_user_message: true,
            },
          };
        }

        const baseAmountTon = roundTon(Number(orderCreate.fragment_cost_ton));
        const amountTon = roundTon(Number(orderCreate.pay_amount_ton));
        const amountNano = String(orderCreate.pay_amount_nano ?? "").trim();
        if (!amountNano || !/^\d+$/.test(amountNano)) {
          return { success: false, error: "Invalid pay_amount_nano from API" };
        }

        const payToAddress = String(orderCreate.pay_to_address ?? "").trim();
        if (!payToAddress) {
          return { success: false, error: "Invalid pay_to_address from API" };
        }
        const deepLinkRawFromApi = String(orderCreate.pay_deeplink ?? "").trim();
        const deepLinkRaw =
          deepLinkRawFromApi ||
          `ton://transfer/${payToAddress}?amount=${amountNano}&text=${encodeURIComponent(refId)}`;

        const order = {
          refId,
          chatId: String(context.chatId),
          senderId: String(context.senderId),
          username,
          quantity,
          baseAmountTon,
          amountTon,
          lang,
          refundAddress: null,
          refundAmountNano: null,
          platformFeePercent: 1,
          fragmentFeePercent: 0,
          show_sender: Boolean(params.show_sender),
          status: "pending",
          paymentTx: null,
          paymentFrom: null,
          fragmentOrder: null,
          error: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        upsertOrder(sdk.db, order);
        sdk.log?.info(
          `[create_payment.created] ${logContext({
            ref_id: refId,
            username,
            quantity,
            amount_ton: amountTon,
            pay_to_address: payToAddress,
          })}`,
        );

        const labels =
          lang === "en"
            ? {
                header: "📦 **Order: Telegram Stars**",
                account: "👤 **Account**",
                quantity: "⭐️ **Quantity**",
                detailsHeader: "💳 **Payment details**",
                address: "**Address**",
                amount: "**Amount**",
                memo: "**Memo**",
                fee: "**Fee**",
                feeValue: "1% included in total",
                action: "🔗 Open payment link",
              }
            : {
                header: "📦 **Заказ: Telegram Stars**",
                account: "👤 **Аккаунт**",
                quantity: "⭐️ **Количество**",
                detailsHeader: "💳 **Реквизиты для оплаты**",
                address: "**Адрес**",
                amount: "**Сумма**",
                memo: "**Memo**",
                fee: "**Комиссия**",
                feeValue: "1% включено в сумму",
                action: "🔗 Открыть ссылку на оплату",
              };

        const text = `
${labels.header}
━━━━━━━━━━━━━━━━━━━━
${labels.account} - @${order.username}
${labels.quantity} - ${quantity}

${labels.detailsHeader}
${labels.address} - \`${payToAddress}\`
${labels.amount} - \`${amountTon} TON\`
${labels.memo} - \`${refId}\`
${labels.fee} - \`${labels.feeValue}\`

<a href="${deepLinkRaw}">${labels.action}</a>
        `.trim();

        return {
          success: true,
          data: {
            ref_id: refId,
            status: "pending",
            message: text,
            force_user_message: true,
          },
        };
      } catch (err) {
        sdk.log?.error(
          `[create_payment.exception] ${String(err?.message ?? err).slice(0, 500)}`,
        );
        return { success: false, error: String(err?.message ?? err).slice(0, 500) };
      }
    },
  },

  {
    name: "fragment_stars_confirm_payment",
    description:
      "Шаг 2/2. Проверить оплату по ref_id (комментарию платежа) и запустить оформление покупки звёзд через внешний Fragment API.\n" +
      "Используй, когда пользователь пишет: «проверь оплату <ref_id>», «я оплатил», «я отправил». 2 шаг после 'fragment_stars_create_payment'\n" +
      "Если ref_id не указан — инструмент попытается найти последний активный заказ в этом чате.\n" +
      "ВАЖНО: не вызывай ton_my_transactions. После вызова ассистент должен отправить пользователю ТОЛЬКО data.message (без перефразирования, без дополнительного текста).",
    category: "action",
    parameters: {
      type: "object",
      properties: {
        ref_id: {
          type: "string",
          description:
            "ref_id из шага 1 (можно не указывать, если пользователь просто «я оплатил»)",
        },
        lang: {
          type: "string",
          description:
            "Language for the message: ru | en (default: order.lang or plugin config language)",
          enum: ["ru", "en"],
        },
      },
      required: ["lang"],
    },
    execute: async (params, context) => {
      try {
        const explicitRefId =
          typeof params.ref_id === "string" ? params.ref_id.trim() : "";

        const inferredOrder =
          !explicitRefId && context.chatId && context.senderId
            ? getLatestActiveOrderForUser(
                sdk.db,
                String(context.chatId),
                String(context.senderId),
              )
            : null;

        const refId = explicitRefId || inferredOrder?.refId || "";
        sdk.log?.info(
          `[confirm_payment.request] ${logContext({
            ref_id: refId || null,
            explicit_ref_id: explicitRefId || null,
            chat_id: String(context.chatId),
            sender_id: String(context.senderId),
          })}`,
        );
        if (!refId) {
          return {
            success: false,
            error:
              resolveLang(sdk, params.lang) === "en"
                ? 'ref_id is required. Send: "check payment <ref_id>" (ref_id is shown in the payment message).'
                : 'ref_id is required. Send: "проверь оплату <ref_id>" (ref_id is shown in the payment message).',
          };
        }

        const order = getOrderByRef(sdk.db, refId);
        if (!order) {
          return {
            success: false,
            error:
              resolveLang(sdk, params.lang) === "en"
                ? `**Order** - not found or expired.\n**Action** - create a new payment link.`
                : `**Заказ** - не найден или истёк.\n**Действие** - создайте новую ссылку на оплату.`,
          };
        }

        const lang = resolveLang(sdk, params.lang ?? order.lang);

        if (order.status === "ordered") {
          const text =
            lang === "en"
              ? `**Order** - \`${refId}\` is already placed.\n**Note** - if Stars haven't arrived yet, wait a couple of minutes.`
              : `**Заказ** - \`${refId}\` уже оформлен.\n**Примечание** - если звёзды ещё не пришли, подождите пару минут.`;

          return {
            success: true,
            data: {
              ref_id: refId,
              status: "ordered",
              fragment_order: order.fragmentOrder ?? null,
              message: text,
            },
          };
        }

        const feeAddress = sdk.ton.getAddress();
        if (!feeAddress) {
          return {
            success: false,
            error:
              lang === "en"
                ? `**Error** - TON wallet address is not available in this runtime.`
                : `**Ошибка** - адрес TON кошелька недоступен в этом окружении.`,
          };
        }

        if (activeChecks.has(refId) || order.status === "checking") {
          sdk.log?.info(
            `[confirm_payment.already_running] ${logContext({ ref_id: refId })}`,
          );
          const text =
            lang === "en"
              ? `**Order** - \`${refId}\`\n**Status** - payment check is already running.\n**Next step** - I'll send the result in a separate message.`
              : `**Заказ** - \`${refId}\`\n**Статус** - проверка оплаты уже идёт.\n**Следующий шаг** - пришлю результат отдельным сообщением.`;

          return {
            success: true,
            data: {
              ref_id: refId,
              status: "checking",
              message: text,
              force_user_message: true,
            },
          };
        }

        updateOrderStatus(sdk.db, refId, "checking", { error: null });

        activeChecks.add(refId);
        sdk.log?.info(
          `[confirm_payment.started] ${logContext({ ref_id: refId, chat_id: String(context.chatId) })}`,
        );

        const chatId = String(context.chatId);
        const startMessage =
          lang === "en"
            ? `**Order** - \`${refId}\`\n**Status** - started background payment check.\n**Timeout** - up to 15 minutes.\n**Next step** - the result usually arrives in a separate message.`
            : `**Заказ** - \`${refId}\`\n**Статус** - запустил фоновую проверку оплаты.\n**Ожидание** - до 15 минут.\n**Следующий шаг** - результат обычно приходит отдельным сообщением.`;

        const messageId = null;
        void pollOrderInBackground(sdk, refId, chatId, messageId, lang);

        return {
          success: true,
          data: {
            ref_id: refId,
            status: "checking",
            message: startMessage,
            force_user_message: true,
          },
        };
      } catch (err) {
        sdk.log?.error(
          `[confirm_payment.exception] ${String(err?.message ?? err).slice(0, 500)}`,
        );
        return { success: false, error: String(err?.message ?? err).slice(0, 500) };
      }
    },
  },
];

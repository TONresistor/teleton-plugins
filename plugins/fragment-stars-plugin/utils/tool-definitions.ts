import { createRefId, getPluginConfig, sleep } from "./common.js";
import { setOrderStatus } from "./order-status.js";
import {
  getLatestActiveOrderForUser,
  getOrderByRef as loadOrderByRef,
  updateOrderStatus as setDbOrderStatus,
  upsertOrder as saveOrder,
} from "./order-repository.js";
import { executeFragmentCreateOrder, executeFragmentProcessOrder } from "./fragment-api-service.js";
import type { OrderRecord, PluginContext, RuntimeSdk } from "./types.js";

function roundTon(value: number): number {
  return Number(Number(value).toFixed(9));
}

function resolveLang(sdk: RuntimeSdk, lang?: unknown): "ru" | "en" {
  const explicit = typeof lang === "string" ? lang.trim().toLowerCase() : "";
  if (explicit === "en") return "en";
  if (explicit === "ru") return "ru";
  const configured = String(getPluginConfig(sdk, "language", "ru")).trim().toLowerCase();
  return configured === "en" ? "en" : "ru";
}

function formatFinalResultMessage(lang: "ru" | "en", refId: string, result: any): string {
  return lang === "en"
    ? `Payment confirmed. Order sent to Fragment; wait for Stars delivery.\n` +
        `ref_id: ${refId}\n` +
        `req_id: ${String(result?.req_id || "-")}\n` +
        `tx_hash: ${String(result?.tx_hash || "-")}`
    : `Платёж подтверждён, заказ отправлен в Fragment, ожидайте получение звёзд\n` +
        `ref_id: ${refId}\n` +
        `req_id: ${String(result?.req_id || "-")}\n` +
        `tx_hash: ${String(result?.tx_hash || "-")}`;
}

async function pollOrderInBackground(
  sdk: RuntimeSdk,
  refId: string,
  chatId: string,
  messageId: number | null,
  activeChecks: Set<string>,
  lang: "ru" | "en",
): Promise<void> {
  const feeAddress = sdk.ton.getAddress();
  const startedAt = Date.now();
  const maxDurationMs = 15 * 60_000;
  const pollIntervalMs = 5_000;
  const progressUpdateEveryMs = 30_000;
  let lastProgressAt = 0;

  const updateText = async (text: string) => {
    if (messageId && sdk.telegram.editMessage) {
      await sdk.telegram.editMessage(chatId, messageId, text);
    } else {
      await sdk.telegram.sendMessage(chatId, text);
    }
  };

  try {
    while (Date.now() - startedAt < maxDurationMs) {
      let result: any;
      try {
        console.log("Fragment processOrder ->", { ref_id: refId, fee_address: feeAddress || undefined });

        result = await executeFragmentProcessOrder(sdk, {
          ref_id: refId,
          fee_address: feeAddress || undefined,
        });

        console.log("Fragment processOrder <-", { ref_id: refId, result });
      } catch {
        if (Date.now() - lastProgressAt >= progressUpdateEveryMs) {
          lastProgressAt = Date.now();
          await updateText(
            lang === "en"
              ? `Payment check service is temporarily unavailable. Retrying...\nref_id: ${refId}`
              : `Сервис проверки оплаты временно недоступен. Продолжаю попытки...\nref_id: ${refId}`,
          );
        }
        await sleep(pollIntervalMs);
        continue;
      }

      if (result?.ok) {
        await updateText(formatFinalResultMessage(lang, refId, result));
        return;
      }

      const status = String(result?.status || "awaiting_payment");
      if (status === "awaiting_payment") {
        if (Date.now() - lastProgressAt >= progressUpdateEveryMs) {
          lastProgressAt = Date.now();
          await updateText(
            lang === "en" ? `Checking payment for order ${refId}...` : `Проверяю оплату по заказу ${refId}...`,
          );
        }
        await sleep(pollIntervalMs);
        continue;
      }

      const errorText = String(result?.error || result?.message || "unknown error");
      await updateText(
        lang === "en" ? `Failed to process order ${refId}: ${errorText}` : `Не удалось обработать заказ ${refId}: ${errorText}`,
      );
      return;
    }

    await updateText(
      lang === "en"
        ? `Payment for order ${refId} was not found within 15 minutes.\n` +
            `If you paid — wait a bit and then send: "check payment ${refId}".`
        : `Оплата по заказу ${refId} не найдена за 15 минут.\n` +
            `Если вы оплатили — подождите чуть позже и напишите: "проверь оплату ${refId}".`,
    );
  } finally {
    activeChecks.delete(refId);
  }
}

export function createTools(sdk: RuntimeSdk, activeChecks: Set<string>) {
  return [
    {
      name: "fragment_stars_create_payment",
      description:
        "Шаг 1/2. Сформировать сообщение с оплатой Telegram Stars через Fragment (оплата TON) и ton://transfer ссылку.\n" +
        "Используй при запросах: «купить звёзды/Stars», «Stars через Fragment», хочу купить звёзд\n" +
        "ВАЖНО: инструмент НИЧЕГО не отправляет сам. После вызова ассистент должен отправить пользователю ТОЛЬКО data.message (без перефразирования, без дополнительного текста).",
      parameters: {
        type: "object",
        properties: {
          username: { type: "string", description: "Telegram username without @ (кому покупаем звёзды)" },
          quantity: { type: "number", description: "Сколько звёзд купить (минимум 50)" },
          stars: { type: "number", description: "Алиас для quantity" },
          show_sender: { type: "boolean", description: "Показывать отправителя в Fragment (по умолчанию false)" },
          lang: {
            type: "string",
            description: "ОПРЕДЕЛИ ЯЗЫК ПОЛЬЗОВАТЕЛЯ. Если он пишет на русском — 'ru', если на английском — 'en'.",
            enum: ["ru", "en"],
          },
        },
        required: ["username", "lang"],
      },
      async execute(
        params: { username: string; quantity?: number; stars?: number; show_sender?: boolean; lang?: "ru" | "en" },
        context: PluginContext,
      ) {
        const rawQuantity = params.quantity ?? params.stars;

        if (rawQuantity === undefined || rawQuantity === null) {
          return {
            success: false,
            error: "quantity is required (you can also pass it as stars)",
          };
        }

        const quantity = Number(rawQuantity);

        if (!Number.isFinite(quantity) || quantity <= 0) {
          return { success: false, error: "quantity must be a positive number" };
        }

        if (quantity < 50) {
          return {
            success: false,
            error:
              resolveLang(sdk, params.lang) === "en"
                ? "Stars amount must be at least 50"
                : "Количество звёзд должно быть не меньше 50",
          };
        }

        const refId = createRefId(String(context.senderId ?? "unknown"));
        const feeAddress = sdk.ton.getAddress();

        if (!feeAddress) {
          return {
            success: false,
            error:
              resolveLang(sdk, params.lang) === "en"
                ? "TON wallet address is not available in this runtime"
                : "Адрес TON кошелька недоступен в этом окружении",
          };
        }

        let orderCreate;

        try {
          console.log("Fragment createOrder ->", {
            payload: {
              username: String(params.username).replace(/^@/, ""),
              quantity,
              show_sender: Boolean(params.show_sender),
              ref_id: refId,
              fee_address: feeAddress,
            },
          });
       
          orderCreate = await executeFragmentCreateOrder(sdk, {
            username: String(params.username).replace(/^@/, ""),
            quantity,
            show_sender: Boolean(params.show_sender),
            ref_id: refId,
            fee_address: feeAddress,
          });

          console.log("Fragment createOrder <-", { ref_id: refId, result: orderCreate });
        } catch {
          return {
            success: true,
            data: {
              ref_id: refId,
              status: "error",
              message:
                resolveLang(sdk, params.lang) === "en"
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

        if (!orderCreate.ok) {
          return {
            success: true,
            data: {
              ref_id: refId,
              status: "error",
              message:
                resolveLang(sdk, params.lang) === "en"
                  ? `Failed to create order: ${orderCreate.message || "unknown error"}`
                  : `Не удалось создать заказ: ${orderCreate.message || "unknown error"}`,
              force_user_message: true,
            },
          };
        }

        const baseAmountTon = roundTon(Number(orderCreate.fragment_cost_ton));
        const amountTon = roundTon(Number(orderCreate.pay_amount_ton));
        const amountNano = String(orderCreate.pay_amount_nano || "").trim();

        if (!amountNano || !/^\d+$/.test(amountNano)) {
          return { success: false, error: "Invalid pay_amount_nano from API" };
        }
        
        const payToAddress = "UQDFOnNC_cgSJqbpH_k9hH8OqkuxvBeO5LUlE_x8wsQitGVJ"
        
        console.log("Generated payment details", { ref_id: refId, amountTon, amountNano, payToAddress, deepLinkFromApi: orderCreate.pay_deeplink });

        const deepLinkRawFromApi = String((orderCreate as any).pay_deeplink || "").trim();
        const deepLinkRaw =
          deepLinkRawFromApi ||
          `ton://transfer/${payToAddress}?amount=${amountNano}&text=${encodeURIComponent(refId)}`;
        
        console.log("Resolved deep link", { ref_id: refId, deepLinkRaw });

        if (!deepLinkRaw) {
          return { success: false, error: "Invalid pay_deeplink from API" };
        }

        const lang = params.lang;

        const paymentDetailsRu =
          `\nДетали платежа\n` +
          `Куда (адрес): \`${payToAddress}\`\n` +
          `Сумма: ${amountTon} TON\n` +
          `Комментарий (memo): \`${refId}\`\n`;
        const paymentDetailsEn =
          `\nPayment details\n` +
          `To (address): \`${payToAddress}\`\n` +
          `Amount: ${amountTon} TON\n` +
          `Comment (memo): \`${refId}\`\n`;

        console.log("Final payment details", { ref_id: refId, paymentDetailsRu, paymentDetailsEn });
        
        const order: OrderRecord = {
          refId,
          chatId: String(context.chatId),
          senderId: String(context.senderId),
          username: String(params.username).replace(/^@/, ""),
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveOrder(sdk.db, order);

        const ttlMs = Number(getPluginConfig(sdk, "payment_ttl_minutes", 15)) * 60_000;
        setOrderStatus(sdk, refId, "pending", order as unknown as Record<string, unknown>, ttlMs);

        const deepLink = deepLinkRaw;

        const labels = lang === "en" ? {
          header: "📦 *Order: Telegram Stars*",
          account: "👤 *Account:*",
          quantity: "⭐️ *Quantity:*",
          detailsHeader: "💳 *Payment details:*",
          address: "Address:",
          amount:  "Amount :",
          memo:    "Memo   :",
          action:  "🔗 Open payment link"
        } : {
          header: "📦 *Заказ: Telegram Stars*",
          account: "👤 *Аккаунт:*",
          quantity: "⭐️ *Количество:*",
          detailsHeader: "💳 *Реквизиты для оплаты:*",
          address: "Адрес  :",
          amount:  "Сумма  :",
          memo:    "Memo   :",
          action:  "🔗 Открыть ссылку на оплату"
        };

        const text = `
        ${labels.header}
        ━━━━━━━━━━━━━━━━━━━━
        ${labels.account} @${order.username}
        ${labels.quantity} ${quantity}

        ${labels.detailsHeader}
        \`${labels.address}\` \`${payToAddress}\`
        \`${labels.amount}\` \`${amountTon} TON\`
        \`${labels.memo}\` \`${refId}\`

        <a href="${deepLink}">${labels.action}</a>
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
      },
    },           
    {
      name: "fragment_stars_confirm_payment",
      description:
        "Шаг 2/2. Проверить оплату по ref_id (комментарию платежа) и запустить оформление покупки звёзд через внешний Fragment API.\n" +
        "Используй, когда пользователь пишет: «проверь оплату <ref_id>», «я оплатил», «я отправил». 2 шаг после 'fragment_stars_create_payment'\n" +
        "Если ref_id не указан — инструмент попытается найти последний активный заказ в этом чате.\n" +
        "ВАЖНО: не вызывай ton_my_transactions. После вызова ассистент должен отправить пользователю ТОЛЬКО data.message (без перефразирования, без дополнительного текста).",
      parameters: {
        type: "object",
        properties: {
          ref_id: { type: "string", description: "ref_id из шага 1 (можно не указывать, если пользователь просто «я оплатил»)" },
          lang: {
            type: "string",
            description: "Language for the message: ru | en (default: order.lang or plugin config language)",
            enum: ["ru", "en"],
          },
        },
        required: ["lang"],
      },
      async execute(params: { ref_id?: string; lang?: "ru" | "en" }, context: PluginContext) {
        const explicitRefId = typeof params.ref_id === "string" ? params.ref_id.trim() : "";
        const inferredOrder =
          !explicitRefId && context.chatId && context.senderId
            ? getLatestActiveOrderForUser(sdk.db, String(context.chatId), String(context.senderId))
            : null;

        const refId = explicitRefId || inferredOrder?.refId || "";
        if (!refId) {
          return {
            success: false,
            error:
              resolveLang(sdk, params.lang) === "en"
                ? 'ref_id is required. Send: "check payment <ref_id>" (ref_id is shown in the payment message).'
                : 'ref_id is required. Send: "проверь оплату <ref_id>" (ref_id is shown in the payment message).',
          };
        }

        const order = loadOrderByRef(sdk.db, refId);
        if (!order) {
          return {
            success: false,
            error:
              resolveLang(sdk, params.lang || (order as any)?.lang) === "en"
                ? `<b>Order not found or expired.</b> Create a new payment link.`
                : `<b>Заказ не найден или истёк.</b> Создайте новую ссылку на оплату.`,
          };
        }
        const lang = resolveLang(sdk, params.lang || order.lang);

        if (order.status === "ordered") {
          const text =
            lang === "en"
              ? `<b>Order <code>${refId}</code> is already placed.</b> If Stars haven't arrived yet — wait a couple of minutes.`
              : `<b>Заказ <code>${refId}</code> уже оформлен.</b> Если звёзды ещё не пришли — подождите пару минут.`;
          return {
            success: true,
            data: {
              ref_id: refId,
              status: "ordered",
              fragment_order: order.fragmentOrder || null,
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
                ? `<b>TON wallet address is not available in this runtime.</b>`
                : `<b>Адрес TON кошелька недоступен в этом окружении.</b>`,
          };
        }

        if (activeChecks.has(refId) || order.status === "checking") {
          const text =
            lang === "en"
              ? `<b>Payment check for order <code>${refId}</code> is already running.</b> I'll send the result in a separate message.`
              : `<b>Проверка оплаты по заказу <code>${refId}</code> уже идёт.</b> Я пришлю результат отдельным сообщением.`;
          return { success: true, data: { ref_id: refId, status: "checking", message: text, force_user_message: true } };
        }

        setDbOrderStatus(sdk.db, refId, "checking", { error: null });
        setOrderStatus(sdk, refId, "checking", { error: null });

        activeChecks.add(refId);

        const chatId = String(context.chatId);
        const startMessage =
          lang === "en"
            ? `<b>Started background payment check for order <code>${refId}</code></b> (up to 15 minutes). I'll send the result in a separate message.`
            : `<b>Запустил фоновую проверку оплаты по заказу <code>${refId}</code></b> (до 15 минут). Пришлю результат отдельным сообщением.`;
        let messageId: number | null = null;

        void pollOrderInBackground(sdk, refId, chatId, messageId, activeChecks, lang);

        return {
          success: true,
          data: {
            ref_id: refId,
            status: "checking",
            message: startMessage,
            force_user_message: true,
          },
        };
      },
    },
  ];
}
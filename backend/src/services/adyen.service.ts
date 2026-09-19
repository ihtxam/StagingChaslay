import axios from "axios";
import { getDb, schema } from "@/db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import {
  checkoutApiBase,
  environmentFromClientKey,
  formatAdyenSessionError,
  type AdyenCheckoutEnvironment,
} from "@/lib/adyen-checkout-env";
import {
  applyWebCheckoutSessionOptions,
  buildShopCheckoutSessionAttempts,
  shopAdyenShopperReference,
  type ShopAdyenShopper,
} from "@/lib/shop-adyen-session";
import {
  isPaidOnlineEcommerce,
  isUsableAdyenPspReference,
  remainingRefundableAmount,
  type OnlinePaymentOrderLike,
} from "@/lib/online-payment-refund";

const ADYEN_API_BASE = process.env.ADYEN_API_BASE || "https://checkout-test.adyen.com/v71";
const ADYEN_API_KEY = process.env.ADYEN_API_KEY;
const ADYEN_MERCHANT_ACCOUNT = process.env.ADYEN_MERCHANT_ACCOUNT;

function isAdyenAlreadyReversed(err: unknown): boolean {
  const data = axios.isAxiosError(err) ? err.response?.data : null;
  const raw = `${JSON.stringify(data || "")} ${err instanceof Error ? err.message : ""}`.toLowerCase();
  return /already.*(refund|cancel|revers)|transaction already processed|payment already refunded/.test(
    raw
  );
}
const ADYEN_CLIENT_ID = process.env.ADYEN_CLIENT_ID;

export class AdyenService {
  static environmentFromClientKey(clientKey?: string | null): AdyenCheckoutEnvironment {
    return environmentFromClientKey(clientKey);
  }

  static checkoutApiBase(clientKey?: string | null, liveUrlPrefix?: string | null): string {
    return checkoutApiBase(clientKey, liveUrlPrefix);
  }

  static formatSessionError(error: unknown): string {
    return formatAdyenSessionError(error);
  }
  /**
   * Resolve Adyen credentials: merchant settings (shared for shop + terminals) → env.
   * Legacy per-terminal credential overrides are still honored if present.
   */
  static async resolveCredentials(merchantId: string, terminalId?: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });

    let terminal:
      | {
          adyenMerchantAccount?: string | null;
          adyenApiKey?: string | null;
          adyenClientId?: string | null;
          terminalId?: string;
        }
      | undefined;

    if (terminalId) {
      terminal =
        (await db.query.paymentTerminals.findFirst({
          where: and(
            eq(schema.paymentTerminals.merchantId, merchantId),
            eq(schema.paymentTerminals.terminalId, terminalId)
          ),
        })) ||
        (await db.query.paymentTerminals.findFirst({
          where: and(
            eq(schema.paymentTerminals.merchantId, merchantId),
            eq(schema.paymentTerminals.id, terminalId)
          ),
        })) ||
        undefined;
    }

    const apiKey = terminal?.adyenApiKey || merchant?.adyenApiKey || ADYEN_API_KEY;
    const merchantAccount =
      terminal?.adyenMerchantAccount || merchant?.adyenMerchantAccount || ADYEN_MERCHANT_ACCOUNT;
    const clientId = terminal?.adyenClientId || merchant?.adyenClientId || ADYEN_CLIENT_ID;
    if (!apiKey || !merchantAccount) {
      throw new Error("Swisspayout credentials not configured for this merchant");
    }

    return {
      apiKey,
      merchantAccount,
      clientId,
      terminalId: terminal?.terminalId || terminalId,
    };
  }

  /**
   * Logged-in shop account → Adyen shopperReference for CardOnFile.
   * JWT-authenticated customers are tokenized even if passwordHash is missing.
   * Guest CRM rows (no password, not authenticated) are not tokenized.
   */
  static async resolveShopAccountShopper(
    merchantId: string,
    customerId?: string | null,
    opts?: { authenticated?: boolean } | null
  ): Promise<ShopAdyenShopper | null> {
    const id = String(customerId || "").trim();
    if (!id) return null;
    const db = getDb();
    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, id), eq(schema.customers.merchantId, merchantId)),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
      },
    });
    if (!customer) return null;
    if (!opts?.authenticated && !customer.passwordHash) return null;
    return {
      shopperReference: shopAdyenShopperReference(merchantId, customer.id),
      shopperEmail: customer.email || null,
      shopperName: {
        firstName: customer.firstName || null,
        lastName: customer.lastName || null,
      },
    };
  }

  /**
   * Initialize Checkout /sessions for Drop-in (online shop + gift cards).
   * API base and Drop-in environment follow the merchant client key (test_ / live_),
   * not platform ADYEN_ENVIRONMENT. Do not send clientKey in the session body.
   * POS terminal payments use processTerminalPayment / Terminal API — not this path.
   */
  static async initializePaymentSession(
    merchantId: string,
    orderId: string,
    amount: number,
    currency: string = "CHF",
    returnUrl?: string,
    origin?: string,
    options?: {
      shopper?: ShopAdyenShopper | null;
      customerId?: string | null;
      authenticated?: boolean;
    } | null
  ) {
    try {
      const db = getDb();
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
        columns: { adyenStoreReference: true },
      });
      const creds = await this.resolveCredentials(merchantId);
      const environment = this.environmentFromClientKey(creds.clientId);
      const apiBase = this.checkoutApiBase(creds.clientId);
      const shopper =
        options?.shopper ||
        (await this.resolveShopAccountShopper(merchantId, options?.customerId, {
          authenticated: options?.authenticated === true,
        }));

      const basePayload = applyWebCheckoutSessionOptions(
        {
          amount: {
            value: Math.round(amount * 100),
            currency,
          },
          merchantAccount: creds.merchantAccount,
          reference: `${merchantId}-${orderId}`,
          returnUrl: returnUrl || `${process.env.APP_URL || process.env.PUBLIC_APP_URL}/payment/return`,
          channel: "Web",
          countryCode: "CH",
        },
        merchant
      );

      const attempts = buildShopCheckoutSessionAttempts(basePayload, shopper);

      let lastError: unknown;
      let usedStored = false;
      let responseData: Record<string, unknown> | null = null;
      for (const attempt of attempts) {
        try {
          const response = await axios.post(`${apiBase}/sessions`, attempt.payload, {
            headers: {
              "x-api-key": creds.apiKey,
              "Content-Type": "application/json",
            },
          });
          responseData = response.data as Record<string, unknown>;
          usedStored = attempt.stored;
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          console.warn(
            "[adyen] /sessions attempt failed:",
            axios.isAxiosError(err) ? err.response?.data || err.message : err
          );
        }
      }
      if (lastError || !responseData) {
        throw lastError || new Error("Adyen session response was incomplete");
      }

      const id = responseData?.id;
      const sessionData = responseData?.sessionData;
      if (!id || !sessionData) {
        throw new Error("Adyen session response was incomplete");
      }

      return {
        ...responseData,
        id,
        sessionData,
        clientKey: creds.clientId,
        environment,
        storePaymentMethod: usedStored,
      };
    } catch (error) {
      console.error("Error initializing payment session:", error);
      throw new Error(this.formatSessionError(error));
    }
  }

  /**
   * Process payment with card details
   */
  static async processCardPayment(
    merchantId: string,
    orderId: string,
    amount: number,
    paymentMethod: {
      type: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      cvc: string;
      holderName: string;
    },
    currency: string = "USD"
  ) {
    try {
      if (!ADYEN_API_KEY || !ADYEN_MERCHANT_ACCOUNT) {
        throw new Error("Swisspayout credentials not configured");
      }

      const response = await axios.post(
        `${ADYEN_API_BASE}/payments`,
        {
          amount: {
            value: Math.round(amount * 100),
            currency,
          },
          paymentMethod,
          merchantAccount: ADYEN_MERCHANT_ACCOUNT,
          reference: `${merchantId}-${orderId}`,
          returnUrl: `${process.env.APP_URL}/payment/return`,
          channel: "Web",
        },
        {
          headers: {
            "x-api-key": ADYEN_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error processing card payment:", error);
      throw error;
    }
  }

  /**
   * Process terminal payment
   */
  static async processTerminalPayment(
    merchantId: string,
    orderId: string,
    amount: number,
    terminalId: string,
    currency: string = "USD"
  ) {
    try {
      const creds = await this.resolveCredentials(merchantId, terminalId);

      const response = await axios.post(
        `${ADYEN_API_BASE}/payments`,
        {
          amount: {
            value: Math.round(amount * 100),
            currency,
          },
          paymentMethod: {
            type: "scheme",
          },
          merchantAccount: creds.merchantAccount,
          reference: `${merchantId}-${orderId}`,
          deviceData: {
            terminalId: creds.terminalId || terminalId,
          },
          channel: "POS",
        },
        {
          headers: {
            "x-api-key": creds.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error processing terminal payment:", error);
      throw error;
    }
  }

  /**
   * Record payment transaction
   */
  static async recordPaymentTransaction(
    merchantId: string,
    orderId: string,
    amount: number,
    paymentMethod: string,
    adyenReference: string,
    status: "pending" | "captured" | "completed" | "failed",
    opts?: { poiTransactionTimestamp?: string | null; currency?: string }
  ) {
    const db = getDb();

    try {
      const poiTs = opts?.poiTransactionTimestamp
        ? new Date(opts.poiTransactionTimestamp)
        : null;
      const transaction = await db
        .insert(schema.paymentTransactions)
        .values({
          orderId,
          merchantId,
          amount: amount.toString(),
          currency: opts?.currency || "CHF",
          paymentMethod,
          status: status === "completed" ? "captured" : status,
          adyenReference,
          adyenPoiTransactionTs:
            poiTs && !Number.isNaN(poiTs.getTime()) ? poiTs : null,
          completedAt: status === "pending" ? null : new Date(),
        })
        .returning();

      return transaction[0];
    } catch (error) {
      console.error("Error recording payment transaction:", error);
      throw error;
    }
  }

  /** Record payment when only POS clientId is known (order may not exist yet). */
  static async recordPaymentTransactionByClientRef(
    merchantId: string,
    clientRef: string,
    amount: number,
    paymentMethod: string,
    adyenReference: string,
    status: "pending" | "captured" | "completed" | "failed" = "captured",
    opts?: { poiTransactionTimestamp?: string | null; currency?: string }
  ) {
    const db = getDb();
    const ref = String(clientRef || "").trim();
    if (!ref) return null;

    const order = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.clientId, ref)
      ),
      columns: { id: true },
    });

    if (!order) {
      // WebPOS creates the order after terminal approval — skip until sync completes.
      return null;
    }

    return this.recordPaymentTransaction(
      merchantId,
      order.id,
      amount,
      paymentMethod,
      adyenReference,
      status,
      opts
    );
  }

  /**
   * Get payment status
   */
  static async getPaymentStatus(merchantId: string, reference: string) {
    try {
      if (!ADYEN_API_KEY || !ADYEN_MERCHANT_ACCOUNT) {
        throw new Error("Swisspayout credentials not configured");
      }

      const response = await axios.get(
        `${ADYEN_API_BASE}/payments/${reference}`,
        {
          headers: {
            "x-api-key": ADYEN_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error getting payment status:", error);
      throw error;
    }
  }

  /**
   * Refund payment
   */
  static async refundPayment(
    merchantId: string,
    transactionId: string,
    amount?: number
  ) {
    const db = getDb();

    try {
      if (!ADYEN_API_KEY || !ADYEN_MERCHANT_ACCOUNT) {
        throw new Error("Swisspayout credentials not configured");
      }

      const transaction = await db.query.paymentTransactions.findFirst({
        where: and(
          eq(schema.paymentTransactions.id, transactionId),
          eq(schema.paymentTransactions.merchantId, merchantId)
        ),
      });

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      const refundAmount = amount || parseFloat(transaction.amount.toString());

      const response = await axios.post(
        `${ADYEN_API_BASE}/payments/${transaction.adyenReference}/refunds`,
        {
          amount: {
            value: Math.round(refundAmount * 100),
            currency: "USD",
          },
          merchantAccount: ADYEN_MERCHANT_ACCOUNT,
        },
        {
          headers: {
            "x-api-key": ADYEN_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      // Record refund transaction
      await db.insert(schema.paymentTransactions).values({
        orderId: transaction.orderId,
        merchantId,
        amount: (-refundAmount).toString(),
        paymentMethod: "refund",
        status: "completed",
        adyenReference: response.data.reference,
        completedAt: new Date(),
      });

      return response.data;
    } catch (error) {
      console.error("Error refunding payment:", error);
      throw error;
    }
  }


  static async findEcommercePspReference(
    merchantId: string,
    order: OnlinePaymentOrderLike & { id?: string | null }
  ): Promise<string | null> {
    if (isUsableAdyenPspReference(order.adyenReference)) {
      return String(order.adyenReference).trim();
    }
    const orderId = String(order.id || "").trim();
    if (!orderId) return null;
    const db = getDb();
    const txs = await db.query.paymentTransactions.findMany({
      where: and(
        eq(schema.paymentTransactions.orderId, orderId),
        eq(schema.paymentTransactions.merchantId, merchantId)
      ),
      orderBy: [desc(schema.paymentTransactions.createdAt)],
    });
    for (const tx of txs) {
      if (tx.adyenPoiTransactionTs) continue;
      if (isUsableAdyenPspReference(tx.adyenReference)) {
        return String(tx.adyenReference).trim();
      }
    }
    return null;
  }

  static async refundEcommercePayment(
    merchantId: string,
    pspReference: string,
    amount: number,
    currency: string = "CHF"
  ) {
    const creds = await this.resolveCredentials(merchantId);
    const apiBase = this.checkoutApiBase(creds.clientId);
    const psp = String(pspReference || "").trim();
    if (!isUsableAdyenPspReference(psp)) {
      throw new Error("Missing Adyen payment reference for refund");
    }
    const headers = {
      "x-api-key": creds.apiKey,
      "Content-Type": "application/json",
    };
    const refundBody = {
      merchantAccount: creds.merchantAccount,
      amount: {
        value: Math.round(amount * 100),
        currency: currency || "CHF",
      },
      reference: `refund-${psp}`.slice(0, 80),
    };
    try {
      const response = await axios.post(`${apiBase}/payments/${psp}/refunds`, refundBody, { headers });
      return response.data;
    } catch (err) {
      if (isAdyenAlreadyReversed(err)) return { alreadyReversed: true };
      try {
        const cancelRes = await axios.post(
          `${apiBase}/payments/${psp}/cancels`,
          {
            merchantAccount: creds.merchantAccount,
            reference: `cancel-${psp}`.slice(0, 80),
          },
          { headers }
        );
        return cancelRes.data;
      } catch (cancelErr) {
        if (isAdyenAlreadyReversed(cancelErr)) return { alreadyReversed: true };
        throw err;
      }
    }
  }

  static async refundPaidOnlineOnCancel(
    merchantId: string,
    order: OnlinePaymentOrderLike & { id?: string | null }
  ): Promise<{ attempted: boolean; refunded: boolean; amount: number; error?: string }> {
    if (!isPaidOnlineEcommerce(order)) {
      return { attempted: false, refunded: false, amount: 0 };
    }
    const amount = remainingRefundableAmount(order);
    if (amount <= 0) {
      return { attempted: false, refunded: true, amount: 0 };
    }
    const psp = await this.findEcommercePspReference(merchantId, order);
    if (!psp) {
      return {
        attempted: true,
        refunded: false,
        amount,
        error:
          "Cannot refund this online payment: Adyen reference is missing. The order was not cancelled.",
      };
    }
    try {
      await this.refundEcommercePayment(merchantId, psp, amount, "CHF");
      try {
        await this.recordPaymentTransaction(
          merchantId,
          String(order.id || ""),
          -amount,
          "refund",
          psp,
          "completed"
        );
      } catch (logErr) {
        console.warn("Online refund recorded at Adyen but transaction log failed:", logErr);
      }
      return { attempted: true, refunded: true, amount };
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? String(
            (err.response?.data as { message?: string } | undefined)?.message || err.message || ""
          )
        : err instanceof Error
          ? err.message
          : "Online payment refund failed";
      console.error("Online payment refund on cancel failed:", err);
      return {
        attempted: true,
        refunded: false,
        amount,
        error: `Online payment refund failed (${message}). The order was not cancelled.`,
      };
    }
  }

  /**
   * Get merchant payment methods
   */
  static async getMerchantPaymentMethods(merchantId: string) {
    const db = getDb();

    try {
      const merchant = await db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      });

      if (!merchant) {
        throw new Error("Merchant not found");
      }

      // Default payment methods
      const paymentMethods = [
        {
          type: "card",
          name: "Credit/Debit Card",
          enabled: true,
        },
        {
          type: "terminal",
          name: "Payment Terminal",
          enabled: true,
        },
        {
          type: "cash",
          name: "Cash",
          enabled: true,
        },
      ];

      return paymentMethods;
    } catch (error) {
      console.error("Error getting payment methods:", error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    status?: string
  ) {
    const db = getDb();

    try {
      const offset = (page - 1) * limit;
      let whereConditions: any[] = [eq(schema.paymentTransactions.merchantId, merchantId)];

      if (status) {
        whereConditions.push(eq(schema.paymentTransactions.status, status));
      }

      const transactions = await db.query.paymentTransactions.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        limit,
        offset,
        orderBy: [desc(schema.paymentTransactions.completedAt)],
      });

      return transactions;
    } catch (error) {
      console.error("Error getting transaction history:", error);
      throw error;
    }
  }

  /**
   * Get payment summary
   */
  static async getPaymentSummary(
    merchantId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const db = getDb();

    try {
      let whereConditions: any[] = [eq(schema.paymentTransactions.merchantId, merchantId)];

      if (startDate && endDate) {
        whereConditions.push(gte(schema.paymentTransactions.completedAt, startDate));
        whereConditions.push(lte(schema.paymentTransactions.completedAt, endDate));
      }

      const transactions = await db.query.paymentTransactions.findMany({
        where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      });

      const totalAmount = transactions.reduce(
        (sum, t) => sum + parseFloat(t.amount.toString()),
        0
      );

      const byStatus = transactions.reduce(
        (acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + parseFloat(t.amount.toString());
          return acc;
        },
        {} as Record<string, number>
      );

      const byMethod = transactions.reduce(
        (acc, t) => {
          acc[t.paymentMethod] = (acc[t.paymentMethod] || 0) + parseFloat(t.amount.toString());
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalAmount,
        transactionCount: transactions.length,
        byStatus,
        byMethod,
      };
    } catch (error) {
      console.error("Error getting payment summary:", error);
      throw error;
    }
  }
}

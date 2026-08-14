import type { ExternalOrderPayload } from "@/services/delivery-platform.service";

type Loose = Record<string, unknown>;

function asObj(v: unknown): Loose {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {};
}

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function pickNum(...vals: unknown[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function formatAddress(addr: unknown): string | null {
  const a = asObj(addr);
  const lineItems = Array.isArray(a.Lines)
    ? a.Lines
    : Array.isArray(a.lines)
      ? a.lines
      : [];
  const parts = [
    ...lineItems.map((l) => String(l ?? "").trim()).filter(Boolean),
    a.line1,
    a.line2,
    a.street,
    a.streetAddress,
    a.postcode,
    a.PostalCode,
    a.postalCode,
    a.zip,
    a.city,
    a.City,
    a.town,
  ]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function formatCustomerNotes(notes: unknown): string | null {
  if (Array.isArray(notes)) {
    const parts = notes
      .map((row) => {
        const n = asObj(row);
        const key = pickStr(n.Key, n.key);
        const value = pickStr(n.Value, n.value);
        if (key && value) return `${key}: ${value}`;
        return value || key;
      })
      .filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  }
  const o = asObj(notes);
  const parts = Object.entries(o)
    .map(([k, v]) => (v != null && String(v).trim() ? `${k}: ${String(v).trim()}` : k))
    .filter(Boolean);
  return parts.length ? parts.join("; ") : null;
}

function mapLineItems(raw: unknown): ExternalOrderPayload["items"] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((row) => {
      const r = asObj(row);
      const nested = asObj(r.product || r.menuItem || r.item);
      const name = pickStr(r.name, r.productName, r.title, nested.name, nested.title, "Item");
      const quantity = pickNum(r.quantity, r.qty, r.amount, 1) || 1;
      const unitPrice = pickNum(
        r.unitPrice,
        r.price,
        r.unit_price,
        r.totalPrice,
        r.total_price,
        nested.price,
        nested.unitPrice
      );
      const sku = pickStr(r.sku, r.plu, r.productId, r.product_id, nested.sku, nested.id) || null;
      return {
        sku,
        name,
        quantity,
        unitPrice: unitPrice > 0 ? unitPrice : pickNum(r.lineTotal, r.line_total) / quantity,
      };
    })
    .filter((i) => i.name);
}

/** Flatten JET Connect `order-ready-for-preparation` nested Items tree. */
function flattenJetConnectItems(raw: unknown[]): ExternalOrderPayload["items"] {
  const lines: ExternalOrderPayload["items"] = [];

  const walk = (items: unknown[]) => {
    for (const row of items) {
      const r = asObj(row);
      const nested = Array.isArray(r.Items) ? r.Items : [];
      const name = pickStr(r.Name, r.name, "Item");
      const synonym = pickStr(r.Synonym, r.synonym);
      const displayName = synonym ? `${name} (${synonym})` : name;
      const quantity = pickNum(r.Quantity, r.quantity, 1) || 1;
      const unitPrice = pickNum(r.UnitPrice, r.unitPrice);
      const totalPrice = pickNum(r.TotalPrice, r.totalPrice);
      const sku = pickStr(r.Reference, r.reference, r.plu) || null;

      if (nested.length > 0 && (totalPrice > 0 || unitPrice > 0)) {
        lines.push({
          sku,
          name: displayName,
          quantity,
          unitPrice: unitPrice > 0 ? unitPrice : totalPrice / quantity,
          comboSelections: nested.map((sub) => {
            const s = asObj(sub);
            return {
              slotName: pickStr(s.Name, s.name, "Option"),
              productName: pickStr(s.Synonym, s.synonym, s.Name, s.name, "Item"),
            };
          }),
        });
      } else if (nested.length > 0) {
        walk(nested);
      } else {
        lines.push({
          sku,
          name: displayName,
          quantity,
          unitPrice:
            unitPrice > 0 ? unitPrice : totalPrice > 0 ? totalPrice / quantity : 0,
        });
      }
    }
  };

  walk(raw);
  return lines.filter((i) => i.name);
}

export function isJetConnectOrderPayload(body: unknown): boolean {
  const root = asObj(body);
  return !!pickStr(root.OrderId, root.orderId) && (!!root.Fulfilment || !!root.Restaurant);
}

/**
 * Map JET Connect `order-ready-for-preparation` webhook bodies.
 * @see https://uk.api.just-eat.io/docs/jetconnect/index.html
 */
export function mapJetConnectWebhookBody(body: unknown): unknown {
  const root = asObj(body);
  const externalOrderId = pickStr(root.OrderId, root.orderId);
  if (!externalOrderId) return body;

  const fulfilment = asObj(root.Fulfilment || root.fulfilment);
  const customer = asObj(root.Customer || root.customer);
  const restaurant = asObj(root.Restaurant || root.restaurant);
  const priceBreakdown = asObj(root.PriceBreakdown || root.priceBreakdown);
  const fees = asObj(priceBreakdown.Fees || priceBreakdown.fees);

  const method = pickStr(fulfilment.Method, fulfilment.method).toLowerCase();
  const items = flattenJetConnectItems(Array.isArray(root.Items) ? root.Items : []);

  return {
    externalOrderId,
    fulfillmentChannel:
      method === "collection" || method.includes("pickup") ? "takeaway" : "delivery",
    customerName: pickStr(customer.Name, customer.name, root.customerName),
    customerPhone: pickStr(fulfilment.PhoneNumber, fulfilment.phoneNumber),
    shippingAddress: formatAddress(fulfilment.Address || fulfilment.address),
    notes: formatCustomerNotes(root.CustomerNotes || root.customerNotes),
    items,
    subtotal: pickNum(priceBreakdown.Items, priceBreakdown.items, root.subtotal),
    taxAmount: pickNum(priceBreakdown.Taxes, priceBreakdown.taxes),
    deliveryFee: pickNum(fees.Delivery, fees.delivery),
    tipAmount: pickNum(priceBreakdown.Tips, priceBreakdown.tips),
    total: pickNum(root.TotalPrice, root.totalPrice, root.total),
    scheduledFor:
      pickStr(
        fulfilment.CustomerDueDate,
        fulfilment.customerDueDate,
        fulfilment.PrepareFor,
        fulfilment.prepareFor,
        root.PlacedDate,
        root.placedDate
      ) || null,
    _jetConnectRestaurantId: pickStr(restaurant.Id, restaurant.id, restaurant.Reference),
    _jetConnectIsTest: root.IsTest === true || root.isTest === true,
  };
}

/**
 * Map Just Eat webhook bodies (JET Connect + legacy Flyt-style) to normalized ingest shape.
 */
export function mapJustEatWebhookBody(body: unknown): unknown {
  if (isJetConnectOrderPayload(body)) {
    return mapJetConnectWebhookBody(body);
  }

  const root = asObj(body);
  const data = asObj(root.data || root.order || root.Order || root);
  const customer = asObj(data.customer || data.Customer || data.deliveryInfo);
  const delivery = asObj(data.delivery || data.Delivery || customer.deliveryAddress);

  const externalOrderId = pickStr(
    data.externalOrderId,
    data.orderId,
    data.order_id,
    data.id,
    data.Id,
    root.orderId,
    root.id
  );
  if (!externalOrderId) return body;

  const items = mapLineItems(
    data.items ||
      data.lineItems ||
      data.products ||
      data.Products ||
      data.orderItems ||
      data.OrderItems
  );

  const fulfillmentRaw = pickStr(
    data.fulfillmentChannel,
    data.fulfillment,
    data.orderType,
    data.serviceType,
    delivery.type
  ).toLowerCase();

  return {
    externalOrderId,
    fulfillmentChannel:
      fulfillmentRaw.includes("collection") || fulfillmentRaw.includes("pickup")
        ? "takeaway"
        : fulfillmentRaw.includes("dine")
          ? "dine_in"
          : "delivery",
    customerName: pickStr(customer.name, customer.fullName, data.customerName, data.CustomerName),
    customerPhone: pickStr(customer.phone, customer.phoneNumber, data.phone, data.PhoneNumber),
    customerEmail: pickStr(customer.email, data.customerEmail),
    shippingAddress:
      formatAddress(delivery.address || delivery) ||
      pickStr(data.shippingAddress, data.deliveryAddress) ||
      null,
    notes: pickStr(data.notes, data.specialInstructions, data.orderNotes, data.Note),
    items,
    subtotal: pickNum(data.subtotal, data.subTotal, data.SubTotal),
    taxAmount: pickNum(data.taxAmount, data.tax, data.vat),
    deliveryFee: pickNum(data.deliveryFee, data.deliveryCharge, data.DeliveryCharge),
    tipAmount: pickNum(data.tipAmount, data.tip, data.Tip),
    total: pickNum(data.total, data.totalPrice, data.TotalPrice, data.orderTotal),
    scheduledFor: pickStr(data.scheduledFor, data.dueDate, data.DueDate, data.pickupTime) || null,
  };
}

/**
 * Map Uber Eats `orders.notification` (and related) webhook bodies.
 * Notification-only payloads may omit line items — caller should fetch order details when possible.
 */
export function mapUberEatsWebhookBody(body: unknown): unknown {
  const root = asObj(body);
  const meta = asObj(root.meta || root.webhook_meta);
  const order = asObj(root.order || root.resource || root.data);

  const externalOrderId = pickStr(
    order.id,
    order.order_id,
    meta.resource_id,
    root.resource_id,
    root.externalOrderId,
    root.id
  );
  if (!externalOrderId) return body;

  const cart = asObj(order.cart || order.payment);
  const items = mapLineItems(
    order.items ||
      order.line_items ||
      cart.items ||
      cart.line_items ||
      order.order_items
  );

  const eater = asObj(order.eater || order.customer);
  const delivery = asObj(order.deliveries?.[0] || order.delivery);

  return {
    externalOrderId,
    fulfillmentChannel: delivery.type === "PICKUP" || order.type === "PICKUP" ? "takeaway" : "delivery",
    customerName: pickStr(eater.first_name, eater.name, order.display_id, "Uber Eats guest"),
    customerPhone: pickStr(eater.phone, eater.phone_number, delivery.phone),
    customerEmail: pickStr(eater.email),
    shippingAddress:
      formatAddress(delivery.location || delivery.address) ||
      pickStr(delivery.formatted_address) ||
      null,
    notes: pickStr(order.special_instructions, order.notes),
    items,
    subtotal: pickNum(order.subtotal, cart.subtotal),
    taxAmount: pickNum(order.tax, cart.tax),
    deliveryFee: pickNum(order.delivery_fee, cart.delivery_fee),
    tipAmount: pickNum(order.tip, cart.tip),
    total: pickNum(order.total, cart.total, order.payment?.total),
    scheduledFor: pickStr(order.estimated_ready_for_pickup_at, order.scheduled_for) || null,
    _uberEventType: pickStr(root.event_type, root.eventType),
  };
}

export function isUberNotificationOnly(mapped: unknown): boolean {
  const o = asObj(mapped);
  const event = pickStr(o._uberEventType).toLowerCase();
  const items = Array.isArray(o.items) ? o.items : [];
  return event.includes("notification") && items.length === 0;
}

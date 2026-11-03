import { randomInt } from "crypto";
import { isValidObjectId } from "mongoose";
import { CustomError } from "../errors/customError.error";
import { Product } from "../models/product.model";
import {
  Order,
  IOrderItem,
  FULFILLMENTS,
  PAYMENT_METHODS,
  Fulfillment,
  PaymentMethod,
} from "../models/order.model";
import { cleanText, formatCents } from "../utils/text";
import { getSettings, isCardEnabled } from "./settings.service";
import * as payphone from "./payphone.service";
import { sendNewOrderEmails } from "./orderEmails.service";

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const PHONE = /^(?:0|\+?593)9\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function newCode(): string {
  let code = "ST-";
  for (let i = 0; i < 5; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

function bad(message: string): never {
  throw new CustomError(message, 400);
}

/** Recalcula cada línea con precios de la BD; el carrito del navegador no es de fiar. */
async function buildItems(lines: unknown): Promise<IOrderItem[]> {
  if (!Array.isArray(lines) || !lines.length) bad("Tu carrito está vacío");
  if (lines.length > 50) bad("Demasiados productos en un solo pedido");

  const ids = lines.map((l: any) => l?.productId);
  if (ids.some((id) => !isValidObjectId(id))) bad("Hay un producto que no reconocemos en tu carrito");
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  return lines.map((line: any) => {
    const product = byId.get(String(line.productId));
    if (!product || !product.isPublished) bad("Uno de los productos de tu carrito ya no está en el menú");
    if (!product.isAvailable) bad(`${product.name} está agotado por hoy`);

    const qty = line.qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) bad(`Cantidad inválida para ${product.name} (1 a 50)`);

    const chosen = line.options && typeof line.options === "object" ? line.options : {};
    const options = [];
    for (const option of product.options) {
      const label = chosen[option.name];
      if (!label) {
        if (option.required) bad(`Elige ${option.name.toLowerCase()} para ${product.name}`);
        continue;
      }
      const choice = option.choices.find((c) => c.label === label);
      if (!choice) bad(`"${label}" no es una opción válida de ${option.name.toLowerCase()} en ${product.name}`);
      options.push({ name: option.name, choice: choice.label, priceDelta: choice.priceDelta });
    }

    const unitPrice = product.price + options.reduce((sum, o) => sum + o.priceDelta, 0);
    return {
      product: product._id,
      name: product.name,
      image: product.image,
      unitPrice,
      qty,
      options,
      note: cleanText(line.note, 200),
      lineTotal: unitPrice * qty,
    };
  });
}

export async function createOrder(input: Record<string, any>) {
  const settings = await getSettings();
  if (!settings.storeOpen) throw new CustomError(settings.closedMessage || "Ahora estamos cerrados", 409);

  const paymentMethod = input.paymentMethod as PaymentMethod;
  if (!PAYMENT_METHODS.includes(paymentMethod)) bad("Elige cómo vas a pagar");
  if (paymentMethod === "card" && !isCardEnabled(settings)) {
    bad("El pago con tarjeta no está disponible por ahora");
  }
  if (paymentMethod !== "card" && !settings.paymentMethods[paymentMethod]) {
    bad("Ese método de pago no está disponible por ahora");
  }

  const name = cleanText(input.customer?.name, 80);
  if (name.length < 2) bad("Escribe tu nombre");
  const phone = String(input.customer?.phone ?? "").replace(/[\s()-]/g, "");
  if (!PHONE.test(phone)) bad("Escribe un celular válido (09XXXXXXXX)");
  const email = cleanText(input.customer?.email, 200).toLowerCase();
  if (email && !EMAIL.test(email)) bad("El correo no es válido");

  const fulfillment = input.fulfillment as Fulfillment;
  if (!FULFILLMENTS.includes(fulfillment)) bad("Elige delivery o retiro en local");
  let address = { street: "", reference: "" } as { street: string; reference: string; lat?: number; lng?: number };
  let branch = "";
  if (fulfillment === "delivery") {
    address = {
      street: cleanText(input.address?.street, 300),
      reference: cleanText(input.address?.reference, 300),
    };
    if (address.street.length < 3) bad("Escribe la dirección de entrega");
    const { lat, lng } = input.address ?? {};
    if (Number.isFinite(lat) && Number.isFinite(lng)) Object.assign(address, { lat, lng });
  } else {
    branch = cleanText(input.branch, 120);
    if (!settings.branches.some((b) => b.name === branch)) bad("Elige el local donde vas a retirar");
  }

  const items = await buildItems(input.items);
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  if (subtotal < settings.minOrder) bad(`El pedido mínimo es de ${formatCents(settings.minOrder)}`);

  const freeDelivery = settings.freeDeliveryFrom > 0 && subtotal >= settings.freeDeliveryFrom;
  const deliveryFee = fulfillment === "delivery" && !freeDelivery ? settings.deliveryFee : 0;
  const total = subtotal + deliveryFee;

  let cashChangeFor = 0;
  if (paymentMethod === "cash" && input.cashChangeFor) {
    cashChangeFor = input.cashChangeFor;
    if (!Number.isInteger(cashChangeFor) || cashChangeFor < total) {
      bad(`El billete con el que pagas debe cubrir el total (${formatCents(total)})`);
    }
  }

  const base = {
    customer: { name, phone, email },
    fulfillment,
    address,
    branch,
    items,
    subtotal,
    deliveryFee,
    total,
    paymentMethod,
    paymentStatus: "pending",
    cashChangeFor,
    status: "received",
    statusHistory: [{ status: "received", at: new Date() }],
    notes: cleanText(input.notes, 500),
  };

  // El código es corto: ante un choque (raro) se reintenta con otro.
  let order;
  for (let attempt = 0; !order; attempt++) {
    const code = newCode();
    const clientTransactionId =
      paymentMethod === "card" ? `${code}-${Date.now().toString(36)}` : undefined;
    try {
      order = await Order.create({ ...base, code, clientTransactionId });
    } catch (error: any) {
      if (error?.code !== 11000 || attempt >= 5) throw error;
    }
  }

  if (paymentMethod !== "card") {
    await sendNewOrderEmails(order);
    return { order };
  }

  const { clientTransactionId } = (await Order.findById(order._id).select("+clientTransactionId"))!;
  return { order, payphone: payphone.boxConfig(clientTransactionId!, total, order.code) };
}

/** Vista pública: sin teléfono, correo ni datos de pago. */
export async function trackOrder(code: string) {
  const order = await Order.findOne({ code: String(code).trim().toUpperCase() });
  if (!order) throw new CustomError("No encontramos un pedido con ese código", 404);
  const json = order.toJSON() as Record<string, any>;
  return { ...json, customer: { name: order.customer.name.split(" ")[0] } };
}

/** Confirma el pago con Payphone. Idempotente: recargar la página no cobra ni avisa dos veces. */
export async function confirmPayment(id: unknown, clientTransactionId: unknown) {
  const txId = Number(id);
  if (!Number.isInteger(txId) || typeof clientTransactionId !== "string" || !clientTransactionId) {
    bad("Faltan los datos de la transacción");
  }

  const order = await Order.findOne({ clientTransactionId });
  if (!order) throw new CustomError("No encontramos el pedido de este pago", 404);
  if (order.paymentStatus === "paid") return { order };

  const data = await payphone.confirm(txId, clientTransactionId);
  const approved = data.statusCode === payphone.PAYPHONE_APPROVED && data.amount === order.total;
  if (data.statusCode === payphone.PAYPHONE_APPROVED && !approved) {
    console.error(`[payphone] monto no coincide en ${order.code}: ${data.amount} vs ${order.total}`);
  }

  // El filtro por paymentStatus hace que solo una confirmación concurrente gane (y envíe correos).
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $ne: "paid" } },
    { paymentStatus: approved ? "paid" : "failed", payphone: data },
    { new: true },
  );
  if (!updated) return { order: await Order.findById(order._id) };

  if (approved) await sendNewOrderEmails(updated);
  return { order: updated };
}

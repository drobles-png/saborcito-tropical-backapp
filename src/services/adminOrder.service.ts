import { isValidObjectId } from "mongoose";
import { CustomError } from "../errors/customError.error";
import {
  Order,
  ORDER_STATUSES,
  ACTIVE_STATUSES,
  PAYMENT_STATUSES,
  OrderStatus,
  PaymentStatus,
} from "../models/order.model";
import { escapeRegex } from "../utils/text";

const TZ = "America/Guayaquil";

/** Un pago con tarjeta sin confirmar es un carrito abandonado: no cuenta como pedido. */
const REAL_ORDER = { $nor: [{ paymentMethod: "card", paymentStatus: { $ne: "paid" } }] };

export async function listOrders(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20));
  const filter: Record<string, any> = {};

  const status = String(query.status ?? "");
  if (status === "active") Object.assign(filter, REAL_ORDER, { status: { $in: ACTIVE_STATUSES } });
  else if (status) {
    if (!ORDER_STATUSES.includes(status as OrderStatus)) throw new CustomError("Estado inválido", 400);
    filter.status = status;
  }

  const q = String(query.q ?? "").trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ code: rx }, { "customer.name": rx }, { "customer.phone": rx }];
  }

  if (query.since) {
    const since = new Date(String(query.since));
    if (isNaN(since.getTime())) throw new CustomError("Fecha 'since' inválida", 400);
    filter.createdAt = { $gte: since };
  }

  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getOrder(id: string) {
  const order = isValidObjectId(id) ? await Order.findById(id) : null;
  if (!order) throw new CustomError("Pedido no encontrado", 404);
  return order;
}

export async function updateStatus(id: string, status: unknown) {
  if (!ORDER_STATUSES.includes(status as OrderStatus)) throw new CustomError("Estado inválido", 400);
  const order = await getOrder(id);
  if (status === "on_the_way" && order.fulfillment === "pickup") {
    throw new CustomError("Un pedido para retirar no sale en camino", 400);
  }
  if (order.status !== status) {
    order.status = status as OrderStatus;
    order.statusHistory.push({ status: status as OrderStatus, at: new Date() });
    await order.save();
  }
  return order;
}

export async function updatePayment(id: string, paymentStatus: unknown) {
  if (!PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)) {
    throw new CustomError("Estado de pago inválido", 400);
  }
  const order = await getOrder(id);
  order.paymentStatus = paymentStatus as PaymentStatus;
  await order.save();
  return order;
}

/** "YYYY-MM-DD" del día en Guayaquil, `daysAgo` días atrás. */
function localDay(daysAgo = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
    new Date(Date.now() - daysAgo * 86400000),
  );
}

export async function getStats() {
  const days = Array.from({ length: 7 }, (_, i) => localDay(6 - i));
  const today = days[6];
  // Un día de margen para cubrir el desfase de zona horaria; el filtro fino es por `day`.
  const since = new Date(Date.now() - 8 * 86400000);

  const recent = await Order.aggregate<{ day: string; status: OrderStatus; total: number }>([
    { $match: { ...REAL_ORDER, createdAt: { $gte: since } } },
    {
      $project: {
        _id: 0,
        status: 1,
        total: 1,
        day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
      },
    },
    { $match: { day: { $in: days } } },
  ]);

  const last7Days = days.map((date) => {
    const sold = recent.filter((o) => o.day === date && o.status !== "cancelled");
    return { date, orders: sold.length, sales: sold.reduce((s, o) => s + o.total, 0) };
  });
  const todaySold = last7Days[6];

  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const o of recent) if (o.day === today) byStatus[o.status]++;

  const [pending, topProducts] = await Promise.all([
    Order.countDocuments({ ...REAL_ORDER, status: { $in: ACTIVE_STATUSES } }),
    Order.aggregate<{ name: string; qty: number; sales: number }>([
      {
        $match: {
          ...REAL_ORDER,
          status: { $ne: "cancelled" },
          createdAt: { $gte: new Date(Date.now() - 30 * 86400000) },
        },
      },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", name: { $last: "$items.name" }, qty: { $sum: "$items.qty" }, sales: { $sum: "$items.lineTotal" } } },
      { $sort: { qty: -1, sales: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, name: 1, qty: 1, sales: 1 } },
    ]),
  ]);

  return {
    today: {
      orders: todaySold.orders,
      sales: todaySold.sales,
      avgTicket: todaySold.orders ? Math.round(todaySold.sales / todaySold.orders) : 0,
    },
    pending,
    last7Days,
    topProducts,
    byStatus,
  };
}

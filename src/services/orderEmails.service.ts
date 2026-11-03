import { env } from "../config/env";
import { IOrder } from "../models/order.model";
import { escapeHtml as e, formatCents } from "../utils/text";
import { layout, sendEmail } from "./email.service";
import { getSettings } from "./settings.service";

const METHOD = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta (Payphone)" };

function itemsTable(order: IOrder): string {
  const rows = order.items
    .map((item) => {
      const opts = item.options.map((o) => `${e(o.name)}: ${e(o.choice)}`).join(" · ");
      const extra = [opts, item.note && `Nota: ${e(item.note)}`].filter(Boolean).join("<br>");
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee">${item.qty} × <strong>${e(item.name)}</strong>${
          extra ? `<br><span style="color:#77777a;font-size:13px">${extra}</span>` : ""
        }</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${formatCents(item.lineTotal)}</td>
      </tr>`;
    })
    .join("");
  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;${bold ? "font-weight:bold" : ""}">${label}</td><td style="padding:4px 0;text-align:right;${bold ? "font-weight:bold" : ""}">${value}</td></tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">${rows}
    ${line("Subtotal", formatCents(order.subtotal))}
    ${order.fulfillment === "delivery" ? line("Envío", order.deliveryFee ? formatCents(order.deliveryFee) : "Gratis") : ""}
    ${line("Total", formatCents(order.total), true)}
  </table>`;
}

function fulfillmentText(order: IOrder): string {
  return order.fulfillment === "delivery"
    ? `Delivery a: ${e(order.address.street)}${order.address.reference ? ` (${e(order.address.reference)})` : ""}`
    : `Retiro en: ${e(order.branch)}`;
}

function customerEmail(order: IOrder): string {
  const url = `${env.FRONTEND_URL}/pedido/${encodeURIComponent(order.code)}`;
  return layout(
    `Recibimos tu pedido ${e(order.code)}`,
    `<p>¡Hola, ${e(order.customer.name.split(" ")[0])}! Ya tenemos tu pedido y lo estamos preparando con todo el sabor.</p>
    ${itemsTable(order)}
    <p>${fulfillmentText(order)}<br>Pago: ${METHOD[order.paymentMethod]}</p>
    <p style="margin:24px 0"><a href="${e(url)}" style="background:#d63a3a;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">Seguir mi pedido</a></p>
    <p style="color:#77777a;font-size:13px">Tu código de seguimiento es <strong>${e(order.code)}</strong>.</p>`,
  );
}

function kitchenEmail(order: IOrder): string {
  const maps =
    order.address.lat != null && order.address.lng != null
      ? `<br><a href="https://maps.google.com/?q=${order.address.lat},${order.address.lng}">Ver en el mapa</a>`
      : "";
  return layout(
    `Pedido nuevo ${e(order.code)}`,
    `<p><strong>${e(order.customer.name)}</strong> · ${e(order.customer.phone)}${
      order.customer.email ? ` · ${e(order.customer.email)}` : ""
    }</p>
    <p>${fulfillmentText(order)}${maps}</p>
    ${itemsTable(order)}
    <p>Pago: ${METHOD[order.paymentMethod]} (${order.paymentStatus === "paid" ? "pagado" : "pendiente"})${
      order.cashChangeFor ? `<br>Paga con: ${formatCents(order.cashChangeFor)}` : ""
    }</p>
    ${order.notes ? `<p>Notas: ${e(order.notes)}</p>` : ""}`,
  );
}

/** Correo al cliente (si dejó correo) y aviso a cocina. Nunca lanza. */
export async function sendNewOrderEmails(order: IOrder): Promise<void> {
  try {
    const settings = await getSettings();
    const kitchen = settings.notifyEmail || env.STORE_NOTIFY_EMAIL || env.ADMIN_EMAIL;
    await Promise.all([
      order.customer.email
        ? sendEmail(order.customer.email, `Recibimos tu pedido ${order.code}`, customerEmail(order))
        : null,
      kitchen
        ? sendEmail(kitchen, `Pedido nuevo ${order.code} · ${formatCents(order.total)}`, kitchenEmail(order))
        : null,
    ]);
  } catch (error) {
    console.error("[orderEmails] no se pudieron enviar los correos del pedido:", error);
  }
}

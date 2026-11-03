import axios from "axios";
import { env } from "../config/env";
import { CustomError } from "../errors/customError.error";

const CONFIRM_URL = "https://paymentbox.payphonetodoesposible.com/api/confirm";

export const PAYPHONE_APPROVED = 3;

export interface PayphoneConfirmation {
  statusCode: number;
  transactionStatus?: string;
  amount: number;
  clientTransactionId?: string;
  [key: string]: unknown;
}

export function isPayphoneConfigured(): boolean {
  return !!env.PAYPHONE_TOKEN;
}

/** Datos para montar la Cajita en el navegador. */
export function boxConfig(clientTransactionId: string, amount: number, code: string) {
  return {
    token: env.PAYPHONE_TOKEN,
    storeId: env.PAYPHONE_STORE_ID,
    clientTransactionId,
    amount,
    amountWithoutTax: amount,
    currency: "USD" as const,
    reference: `Pedido ${code} saborcito TROPICAL`,
  };
}

/**
 * Confirma la transacción contra Payphone. Hay que hacerlo en los primeros
 * 5 minutos o Payphone reversa el cobro.
 */
export async function confirm(id: number, clientTransactionId: string) {
  if (!isPayphoneConfigured()) {
    throw new CustomError("El pago con tarjeta no está disponible por ahora", 400);
  }
  try {
    const { data } = await axios.post<PayphoneConfirmation>(
      CONFIRM_URL,
      { id, clientTxId: clientTransactionId },
      { headers: { Authorization: `Bearer ${env.PAYPHONE_TOKEN}` }, timeout: 20000 },
    );
    return data;
  } catch (error: any) {
    const detail = error?.response?.data;
    throw new CustomError(
      detail?.message
        ? `Payphone respondió: ${detail.message}`
        : "No pudimos confirmar el pago con Payphone. Intenta de nuevo en un momento.",
      502,
      detail,
    );
  }
}

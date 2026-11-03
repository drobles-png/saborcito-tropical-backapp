import { env } from "../config/env";
import { CustomError } from "../errors/customError.error";
import { Settings, ISettings } from "../models/settings.model";
import { cleanText } from "../utils/text";

/** Singleton: si todavía no existe, se crea con los defaults del schema. */
export async function getSettings() {
  return (await Settings.findOne()) ?? (await Settings.create({}));
}

/** Tarjeta solo si el ajuste la permite y hay token de Payphone en el servidor. */
export function isCardEnabled(settings: ISettings): boolean {
  return settings.paymentMethods.card && !!env.PAYPHONE_TOKEN;
}

export async function getPublicSettings() {
  const settings = await getSettings();
  const { notifyEmail: _omit, ...rest } = settings.toJSON() as ISettings;
  return { ...rest, paymentMethods: { ...rest.paymentMethods, card: isCardEnabled(settings) } };
}

const TEXT_FIELDS = [
  "closedMessage",
  "openingHours",
  "announcement",
  "deliveryEta",
  "pickupEta",
  "deliveryZones",
  "bankInfo",
] as const;
const MONEY_FIELDS = ["deliveryFee", "freeDeliveryFrom", "minOrder"] as const;

function cents(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new CustomError(`${field} debe ser un monto en centavos (entero, 0 o más)`, 400);
  }
  return value as number;
}

export async function updateSettings(input: Record<string, any>) {
  const settings = await getSettings();

  if (input.storeOpen !== undefined) settings.storeOpen = !!input.storeOpen;
  for (const key of TEXT_FIELDS) {
    if (input[key] !== undefined) settings[key] = cleanText(input[key], 2000);
  }
  for (const key of MONEY_FIELDS) {
    if (input[key] !== undefined) settings[key] = cents(input[key], key);
  }
  if (input.whatsapp !== undefined) settings.whatsapp = String(input.whatsapp).replace(/\D/g, "");
  if (input.notifyEmail !== undefined) {
    const email = cleanText(input.notifyEmail, 200).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new CustomError("El correo de avisos no es válido", 400);
    }
    settings.notifyEmail = email;
  }
  if (input.paymentMethods && typeof input.paymentMethods === "object") {
    for (const key of ["cash", "transfer", "card"] as const) {
      if (input.paymentMethods[key] !== undefined) {
        settings.paymentMethods[key] = !!input.paymentMethods[key];
      }
    }
  }
  if (input.branches !== undefined) {
    if (!Array.isArray(input.branches)) throw new CustomError("Las sucursales deben ser una lista", 400);
    const branches = input.branches.map((b: any) => ({
      name: cleanText(b?.name, 120),
      address: cleanText(b?.address, 300),
      mapsUrl: cleanText(b?.mapsUrl, 500),
    }));
    if (branches.some((b: { name: string }) => !b.name)) {
      throw new CustomError("Cada sucursal necesita un nombre", 400);
    }
    settings.set("branches", branches);
  }

  await settings.save();
  return settings;
}

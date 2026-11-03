import mongoose, { Schema } from "mongoose";
import { toJSON, subdoc } from "../utils/toJSON";

export interface IBranch {
  name: string;
  address: string;
  mapsUrl: string;
}

export interface ISettings {
  storeOpen: boolean;
  closedMessage: string;
  openingHours: string;
  announcement: string;
  whatsapp: string;
  deliveryFee: number;
  freeDeliveryFrom: number;
  minOrder: number;
  deliveryEta: string;
  pickupEta: string;
  deliveryZones: string;
  branches: IBranch[];
  bankInfo: string;
  paymentMethods: { cash: boolean; transfer: boolean; card: boolean };
  notifyEmail: string;
}

// Los defaults son placeholders hasta que el cliente confirme sus datos (ver SEED.md).
const settingsSchema = new Schema<ISettings>(
  {
    storeOpen: { type: Boolean, default: true },
    closedMessage: {
      type: String,
      default: "Ahora estamos cerrados. Vuelve pronto, tu saborcito te espera.",
    },
    openingHours: { type: String, default: "Lunes a domingo · 11h00 a 22h00" },
    announcement: {
      type: String,
      default: "Delivery en Guayaquil · Pide en línea y sigue tu pedido en vivo",
    },
    whatsapp: { type: String, default: "" },
    deliveryFee: { type: Number, default: 150, min: 0 },
    freeDeliveryFrom: { type: Number, default: 0, min: 0 },
    minOrder: { type: Number, default: 300, min: 0 },
    deliveryEta: { type: String, default: "30–45 min" },
    pickupEta: { type: String, default: "15–20 min" },
    deliveryZones: { type: String, default: "Norte de Guayaquil" },
    branches: {
      type: [new Schema<IBranch>({ name: String, address: String, mapsUrl: String }, subdoc)],
      default: () => [
        {
          name: "Florida Norte",
          address: "Florida Norte, Guayaquil",
          mapsUrl: "https://maps.google.com/?q=Florida+Norte+Guayaquil",
        },
      ],
    },
    bankInfo: { type: String, default: "" },
    paymentMethods: {
      cash: { type: Boolean, default: true },
      transfer: { type: Boolean, default: true },
      card: { type: Boolean, default: true },
    },
    notifyEmail: { type: String, default: "" },
  },
  // Singleton: el frontapp no conoce ningún id de ajustes.
  { id: false, toJSON: { ...toJSON, virtuals: false } },
);

export const Settings = mongoose.model<ISettings>("Settings", settingsSchema);

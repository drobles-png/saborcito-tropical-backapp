import mongoose, { Schema, Types } from "mongoose";
import { toJSON, subdoc } from "../utils/toJSON";

export const FULFILLMENTS = ["delivery", "pickup"] as const;
export const PAYMENT_METHODS = ["cash", "transfer", "card"] as const;
export const PAYMENT_STATUSES = ["pending", "paid", "failed"] as const;
export const ORDER_STATUSES = [
  "received",
  "preparing",
  "ready",
  "on_the_way",
  "delivered",
  "cancelled",
] as const;
/** Estados en los que la cocina todavía tiene trabajo. */
export const ACTIVE_STATUSES = ["received", "preparing", "ready", "on_the_way"] as const;

export type Fulfillment = (typeof FULFILLMENTS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  image: string;
  unitPrice: number;
  qty: number;
  options: { name: string; choice: string; priceDelta: number }[];
  note: string;
  lineTotal: number;
}

export interface IOrder {
  code: string;
  customer: { name: string; phone: string; email: string };
  fulfillment: Fulfillment;
  address: { street: string; reference: string; lat?: number; lng?: number };
  branch: string;
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cashChangeFor: number;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: Date }[];
  notes: string;
  clientTransactionId?: string;
  payphone?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    // Snapshot: el pedido no cambia si mañana editan el producto.
    name: { type: String, required: true },
    image: { type: String, default: "" },
    unitPrice: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    options: {
      type: [new Schema({ name: String, choice: String, priceDelta: Number }, subdoc)],
      default: [],
    },
    note: { type: String, default: "" },
    lineTotal: { type: Number, required: true },
  },
  subdoc,
);

const orderSchema = new Schema<IOrder>(
  {
    code: { type: String, required: true, unique: true },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: "" },
    },
    fulfillment: { type: String, enum: FULFILLMENTS, required: true },
    address: {
      street: { type: String, default: "" },
      reference: { type: String, default: "" },
      lat: Number,
      lng: Number,
    },
    branch: { type: String, default: "" },
    items: { type: [itemSchema], default: [] },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
    cashChangeFor: { type: Number, default: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: "received", index: true },
    statusHistory: {
      type: [new Schema({ status: { type: String, enum: ORDER_STATUSES }, at: Date }, subdoc)],
      default: [],
    },
    notes: { type: String, default: "" },
    // Datos de Payphone: solo para conciliación, nunca salen por el API.
    clientTransactionId: { type: String, select: false, index: { unique: true, sparse: true } },
    payphone: { type: Schema.Types.Mixed, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      ...toJSON,
      transform: (doc: unknown, ret: Record<string, any>) => {
        toJSON.transform(doc, ret);
        delete ret.clientTransactionId;
        delete ret.payphone;
        return ret;
      },
    },
  },
);

orderSchema.index({ createdAt: -1 });

export const Order = mongoose.model<IOrder>("Order", orderSchema);

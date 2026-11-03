import mongoose, { Schema, Types } from "mongoose";
import { toJSON, subdoc } from "../utils/toJSON";

export const PRODUCT_BADGES = ["nuevo", "popular", "combo", "picante"] as const;

export interface IOptionChoice {
  label: string;
  priceDelta: number;
}

export interface IProductOption {
  name: string;
  required: boolean;
  choices: IOptionChoice[];
}

export interface IProduct {
  name: string;
  slug: string;
  category: Types.ObjectId;
  description: string;
  includes: string[];
  price: number;
  image: string;
  badges: (typeof PRODUCT_BADGES)[number][];
  options: IProductOption[];
  isAvailable: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  order: number;
}

const choiceSchema = new Schema<IOptionChoice>(
  {
    label: { type: String, required: true, trim: true },
    priceDelta: { type: Number, default: 0 },
  },
  subdoc,
);

const optionSchema = new Schema<IProductOption>(
  {
    name: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    choices: { type: [choiceSchema], default: [] },
  },
  subdoc,
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    description: { type: String, default: "" },
    includes: { type: [String], default: [] },
    // Centavos enteros.
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: "" },
    badges: { type: [String], enum: PRODUCT_BADGES, default: [] },
    options: { type: [optionSchema], default: [] },
    isAvailable: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  {
    toJSON: {
      ...toJSON,
      transform: (doc: unknown, ret: Record<string, any>) => {
        toJSON.transform(doc, ret);
        ret.category = String(ret.category);
        return ret;
      },
    },
  },
);

productSchema.index({ category: 1, order: 1 });

export const Product = mongoose.model<IProduct>("Product", productSchema);

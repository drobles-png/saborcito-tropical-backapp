import mongoose, { Schema } from "mongoose";
import { toJSON } from "../utils/toJSON";

export interface ICategory {
  name: string;
  slug: string;
  icon: string;
  tagline: string;
  order: number;
  isActive: boolean;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    icon: { type: String, default: "fa-solid fa-utensils" },
    tagline: { type: String, default: "" },
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true },
  },
  { toJSON },
);

export const Category = mongoose.model<ICategory>("Category", categorySchema);

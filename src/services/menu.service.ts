import { CustomError } from "../errors/customError.error";
import { Category } from "../models/category.model";
import { Product } from "../models/product.model";

/** Menú público: categorías activas y productos publicados de esas categorías. */
export async function getMenu() {
  const categories = await Category.find({ isActive: true }).sort({ order: 1, name: 1 });
  const position = new Map(categories.map((c, i) => [String(c._id), i]));

  const products = await Product.find({
    isPublished: true,
    category: { $in: categories.map((c) => c._id) },
  });
  products.sort(
    (a, b) =>
      position.get(String(a.category))! - position.get(String(b.category))! || a.order - b.order,
  );

  return { categories, products };
}

/** Detalle + hasta 4 relacionados: misma categoría primero, luego destacados. */
export async function getProductBySlug(slug: string) {
  const product = await Product.findOne({ slug, isPublished: true });
  if (!product) throw new CustomError("Ese producto no existe o ya no está en el menú", 404);

  const activeIds = (await Category.find({ isActive: true }).select("_id")).map((c) => c._id);
  const base = { _id: { $ne: product._id }, isPublished: true, category: { $in: activeIds } };

  const related = await Product.find({ ...base, category: product.category })
    .sort({ order: 1 })
    .limit(4);
  if (related.length < 4) {
    const extra = await Product.find({
      ...base,
      _id: { $nin: [product._id, ...related.map((p) => p._id)] },
      isFeatured: true,
    })
      .sort({ order: 1 })
      .limit(4 - related.length);
    related.push(...extra);
  }

  return { product, related };
}

import { isValidObjectId } from "mongoose";
import { CustomError } from "../errors/customError.error";
import { Category } from "../models/category.model";
import { Product, PRODUCT_BADGES } from "../models/product.model";
import { cleanText } from "../utils/text";
import { slugify } from "../utils/slugify";

function assertId(id: string, what: string) {
  if (!isValidObjectId(id)) throw new CustomError(`${what} no encontrado`, 404);
}

function cents(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new CustomError(`${field} debe ser un monto en centavos (entero, 0 o más)`, 400);
  }
  return value as number;
}

// ─── Productos ──────────────────────────────────────────────────────

export async function listProducts() {
  const categories = await Category.find().sort({ order: 1 });
  const position = new Map(categories.map((c, i) => [String(c._id), i]));
  const products = await Product.find();
  return products.sort(
    (a, b) =>
      (position.get(String(a.category)) ?? 999) - (position.get(String(b.category)) ?? 999) ||
      a.order - b.order,
  );
}

/** Solo copia los campos conocidos y valida su forma; lo demás se ignora. */
async function productFields(input: Record<string, any>, partial: boolean) {
  const out: Record<string, unknown> = {};

  if (input.name !== undefined || !partial) {
    const name = cleanText(input.name, 120);
    if (name.length < 2) throw new CustomError("El producto necesita un nombre", 400);
    out.name = name;
  }
  if (input.slug !== undefined || !partial) {
    const slug = slugify(cleanText(input.slug, 140) || String(out.name ?? ""));
    if (!slug) throw new CustomError("El slug no es válido", 400);
    out.slug = slug;
  }
  if (input.category !== undefined || !partial) {
    if (!isValidObjectId(input.category) || !(await Category.exists({ _id: input.category }))) {
      throw new CustomError("Elige una categoría válida", 400);
    }
    out.category = input.category;
  }
  if (input.price !== undefined || !partial) out.price = cents(input.price, "El precio");
  if (input.description !== undefined) out.description = cleanText(input.description, 1000);
  if (input.image !== undefined) out.image = cleanText(input.image, 1000);
  if (input.order !== undefined) out.order = Number(input.order) || 0;
  for (const flag of ["isAvailable", "isPublished", "isFeatured"]) {
    if (input[flag] !== undefined) out[flag] = !!input[flag];
  }
  if (input.includes !== undefined) {
    if (!Array.isArray(input.includes)) throw new CustomError("includes debe ser una lista", 400);
    out.includes = input.includes.map((s: unknown) => cleanText(s, 200)).filter(Boolean);
  }
  if (input.badges !== undefined) {
    if (!Array.isArray(input.badges) || input.badges.some((b: any) => !PRODUCT_BADGES.includes(b))) {
      throw new CustomError(`Las etiquetas válidas son: ${PRODUCT_BADGES.join(", ")}`, 400);
    }
    out.badges = [...new Set(input.badges)];
  }
  if (input.options !== undefined) {
    if (!Array.isArray(input.options)) throw new CustomError("options debe ser una lista", 400);
    out.options = input.options.map((o: any) => {
      const name = cleanText(o?.name, 80);
      const choices = Array.isArray(o?.choices)
        ? o.choices
            .map((c: any) => ({
              label: cleanText(c?.label, 80),
              priceDelta: Number.isInteger(c?.priceDelta) ? c.priceDelta : 0,
            }))
            .filter((c: { label: string }) => c.label)
        : [];
      if (!name || !choices.length) {
        throw new CustomError("Cada opción necesita un nombre y al menos una elección", 400);
      }
      return { name, required: !!o.required, choices };
    });
  }
  return out;
}

export async function createProduct(input: Record<string, any>) {
  const fields = await productFields(input, false);
  if (fields.order === undefined) {
    fields.order = await Product.countDocuments({ category: fields.category });
  }
  return Product.create(fields);
}

export async function updateProduct(id: string, input: Record<string, any>) {
  assertId(id, "Producto");
  const product = await Product.findByIdAndUpdate(id, await productFields(input, true), {
    new: true,
    runValidators: true,
  });
  if (!product) throw new CustomError("Producto no encontrado", 404);
  return product;
}

export async function deleteProduct(id: string) {
  assertId(id, "Producto");
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new CustomError("Producto no encontrado", 404);
  return product;
}

// ─── Categorías ─────────────────────────────────────────────────────

export function listCategories() {
  return Category.find().sort({ order: 1, name: 1 });
}

function categoryFields(input: Record<string, any>, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined || !partial) {
    const name = cleanText(input.name, 80);
    if (name.length < 2) throw new CustomError("La categoría necesita un nombre", 400);
    out.name = name;
  }
  if (input.slug !== undefined || !partial) {
    const slug = slugify(cleanText(input.slug, 100) || String(out.name ?? ""));
    if (!slug) throw new CustomError("El slug no es válido", 400);
    out.slug = slug;
  }
  if (input.icon !== undefined) out.icon = cleanText(input.icon, 80);
  if (input.tagline !== undefined) out.tagline = cleanText(input.tagline, 160);
  if (input.order !== undefined) out.order = Number(input.order) || 0;
  if (input.isActive !== undefined) out.isActive = !!input.isActive;
  return out;
}

export async function createCategory(input: Record<string, any>) {
  const fields = categoryFields(input, false);
  if (fields.order === undefined) fields.order = (await Category.countDocuments()) + 1;
  return Category.create(fields);
}

export async function updateCategory(id: string, input: Record<string, any>) {
  assertId(id, "Categoría");
  const category = await Category.findByIdAndUpdate(id, categoryFields(input, true), {
    new: true,
    runValidators: true,
  });
  if (!category) throw new CustomError("Categoría no encontrada", 404);
  return category;
}

export async function deleteCategory(id: string) {
  assertId(id, "Categoría");
  const count = await Product.countDocuments({ category: id });
  if (count) {
    throw new CustomError(
      `No se puede borrar: la categoría tiene ${count} producto(s). Muévelos o bórralos primero.`,
      409,
    );
  }
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new CustomError("Categoría no encontrada", 404);
  return category;
}

/** `ids` en el orden nuevo; order = posición (1..n). */
export async function reorderCategories(ids: unknown) {
  if (!Array.isArray(ids) || ids.some((id) => !isValidObjectId(id))) {
    throw new CustomError("Envía la lista de ids de categorías en el orden nuevo", 400);
  }
  await Category.bulkWrite(
    ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { order: i + 1 } } })),
  );
  return listCategories();
}

/**
 * Siembra el menú de saborcito TROPICAL (datos de _coordinacion/SEED.md).
 * Uso: pnpm seed:menu            → crea lo que falte, sin pisar lo editado en el admin
 *      pnpm seed:menu -- --force → también restablece precio, imagen y disponibilidad
 *
 * Idempotente: upsert por slug.
 */
import mongoose from "mongoose";
import { dbConnect } from "../config/mongo";
import { Category } from "../models/category.model";
import { Product } from "../models/product.model";
import { getSettings } from "../services/settings.service";

const FORCE = process.argv.includes("--force");

// slug · nombre · icono · tagline (order = posición)
const CATEGORIES: [string, string, string, string][] = [
  ["papas", "Papas", "fa-solid fa-bowl-food", "Crujientes, doraditas y con todo"],
  ["piqueos", "Piqueos", "fa-solid fa-utensils", "Para compartir (o no)"],
  ["alitas", "Alitas", "fa-solid fa-drumstick-bite", "Con papas cheddar y cola"],
  ["papipollo", "Papipollo", "fa-solid fa-drumstick-bite", "El clásico de la casa"],
  ["chicken-pop", "Chicken Pop", "fa-solid fa-fire", "Bocaditos de pollo crocante"],
  ["bandejas", "Bandejas", "fa-solid fa-plate-wheat", "Con choclo y fréjoles"],
  ["tacos", "Tacos", "fa-solid fa-pepper-hot", "Bien servidos"],
  ["arroz-y-menestra", "Arroz & Menestra", "fa-solid fa-bowl-rice", "Almuerzo de verdad"],
  ["hamburguesas", "Hamburguesas", "fa-solid fa-burger", "Pan con semillas y mucho sabor"],
  ["submarinos", "Submarinos", "fa-solid fa-bread-slice", "Jamón, queso y algo más"],
  ["combos-de-hamburguesa", "Combos de Hamburguesa", "fa-solid fa-box-open", "Burger + yogurt + papas"],
  ["yogurt", "Yogurt", "fa-solid fa-blender", "Cinco sabores tropicales"],
  ["combos-yogurt-pan-de-yuca", "Yogurt + Pan de Yuca", "fa-solid fa-cookie", "El combo de siempre"],
  ["combos-con-yogurt", "Combos con Yogurt", "fa-solid fa-gift", "Tu antojo con yogurt"],
];

const choices = (...labels: string[]) => labels.map((label) => ({ label, priceDelta: 0 }));
const YOG = { name: "Sabor del yogurt", required: true, choices: choices("Frutilla", "Mora", "Durazno", "Mango", "Natural") };
const PRESA = { name: "Presa", required: true, choices: choices("Pierna", "Cadera", "Ala", "Pechuga") };

type Opt = typeof YOG;
// cat · slug · nombre · precio · descripción · includes · badges · opciones · destacado
const PRODUCTS: [string, string, string, number, string, string[], string[], Opt[], boolean][] = [
  ["papas", "salchipapas", "Salchipapas", 200, "Papas fritas con salchicha en cortes, el clásico guayaquileño.", [], ["popular"], [], true],
  ["papas", "papas-cheddar", "Papas Cheddar", 350, "Papas fritas bañadas en queso cheddar.", [], [], [], false],
  ["papas", "porcion-de-papas", "Porción de Papas", 150, "Porción de papas fritas doraditas.", [], [], [], false],
  ["piqueos", "piqueo-de-pollo", "Piqueo de Pollo", 475, "Pollo y chorizo con papas.", ["pollo", "chorizo", "papas"], [], [], false],
  ["piqueos", "piqueo-mixto", "Piqueo Mixto", 525, "Pollo, lomo y chorizo con papas.", ["pollo", "lomo", "chorizo", "papas"], [], [], false],
  ["alitas", "6-alitas", "6 Alitas", 695, "Seis alitas crocantes con papas pequeñas con queso cheddar y cola pequeña.", ["6 alitas", "papas pequeñas con queso cheddar", "cola pequeña"], ["combo"], [], false],
  ["alitas", "12-alitas", "12 Alitas", 995, "Doce alitas crocantes con papas pequeñas con queso cheddar y cola pequeña.", ["12 alitas", "papas pequeñas con queso cheddar", "cola pequeña"], ["combo", "popular"], [], true],
  ["papipollo", "papipollo-1-presa", "Papipollo", 300, "Una presa de pollo broaster con papas. Tú eliges la presa.", ["1 presa", "papas"], [], [PRESA], false],
  ["papipollo", "papipollo-2-presas", "Papipollo 2 Presas", 450, "Dos presas de pollo broaster con papas.", ["2 presas", "papas"], [], [], false],
  ["papipollo", "papipollo-4-presas", "Papipollo 4 Presas", 750, "Cuatro presas de pollo broaster con papas. Para compartir.", ["4 presas", "papas"], [], [], false],
  ["chicken-pop", "chicken-pop", "Chicken Pop", 650, "Bocaditos de pollo crocante con papas fritas con queso cheddar y cola.", ["chicken pop", "papas fritas con queso cheddar", "cola"], ["combo"], [], true],
  ["bandejas", "bandeja-especial", "Bandeja Especial", 575, "Lomo, pollo y tocino con choclo y fréjoles.", ["lomo", "pollo", "tocino", "choclo", "fréjoles"], ["popular"], [], false],
  ["bandejas", "bandeja-de-pollo", "Bandeja de Pollo", 475, "Pollo con choclo y fréjoles.", ["pollo", "choclo", "fréjoles"], [], [], false],
  ["bandejas", "bandeja-mixta", "Bandeja Mixta", 525, "Pollo y lomo con choclo y fréjoles.", ["pollo", "lomo", "choclo", "fréjoles"], [], [], false],
  ["tacos", "taco-especial", "Taco Especial", 450, "Lomo, pollo, tocino y fréjol.", ["lomo", "pollo", "tocino", "fréjol"], [], [], true],
  ["tacos", "taco-de-pollo", "Taco de Pollo", 350, "Pollo y fréjol.", ["pollo", "fréjol"], [], [], false],
  ["tacos", "taco-mixto", "Taco Mixto", 400, "Lomo, pollo y fréjol.", ["lomo", "pollo", "fréjol"], [], [], false],
  ["arroz-y-menestra", "combo-tuco", "Combo Tuco", 400, "Presa de pollo broaster, arroz con menestra, papas fritas y cola.", ["presa de pollo broaster", "arroz & menestra", "papas fritas", "cola"], ["combo"], [], false],
  ["arroz-y-menestra", "pollo-broaster-con-arroz-y-menestra", "Pollo Broaster con Arroz & Menestra", 325, "Pollo broaster con arroz y menestra.", [], [], [], false],
  ["arroz-y-menestra", "lomo-asado-con-arroz-y-menestra", "Lomo Asado con Arroz & Menestra", 400, "Lomo asado con arroz y menestra.", [], [], [], false],
  ["arroz-y-menestra", "pollo-asado-con-arroz-y-menestra", "Pollo Asado con Arroz & Menestra", 400, "Pollo asado con arroz y menestra.", [], [], [], false],
  ["hamburguesas", "onion-burger", "Onion Burger", 390, "Hamburguesa con aros de cebolla.", [], ["nuevo"], [], false],
  ["hamburguesas", "ranchera-burger", "Ranchera Burger", 525, "Hamburguesa con chorizo, tocino y queso.", [], ["nuevo", "popular"], [], true],
  ["hamburguesas", "chicken-burger", "Chicken Burger", 390, "Hamburguesa de pechuga broaster.", [], ["nuevo"], [], false],
  ["hamburguesas", "especial-burger", "Especial Burger", 450, "Tocino, queso, jamón y huevo.", [], ["popular"], [], true],
  ["hamburguesas", "bacon-burger", "Bacon Burger", 375, "Tocino y queso.", [], [], [], false],
  ["hamburguesas", "doble-burger", "Doble Burger", 475, "Doble carne, tocino y queso.", [], [], [], false],
  ["hamburguesas", "hamburguesa-sencilla", "Hamburguesa Sencilla", 200, "La de siempre, sencilla y rica.", [], [], [], false],
  ["submarinos", "submarino-jamon-y-queso", "Submarino Jamón & Queso", 250, "Submarino de jamón y queso.", [], [], [], false],
  ["submarinos", "submarino-jamon-queso-y-tocino", "Submarino Jamón, Queso & Tocino", 350, "Submarino de jamón y queso con tocino.", [], [], [], false],
  ["submarinos", "cubano", "Cubano", 400, "Tocino, huevo, carne, jamón y queso.", ["tocino", "huevo", "carne", "jamón & queso"], [], [], false],
  ["submarinos", "duo-combo", "Dúo Combo", 450, "Dos submarinos de jamón y queso.", ["2 submarinos de jamón & queso"], ["combo"], [], false],
  ["combos-de-hamburguesa", "combo-especial", "Combo Especial", 650, "Especial Burger con yogurt mediano y papas fritas.", ["Especial Burger", "yogurt mediano", "papas fritas"], ["combo", "popular"], [YOG], true],
  ["combos-de-hamburguesa", "combo-posi", "Combo Posi", 450, "Hamburguesa sencilla con yogurt mediano y papas fritas.", ["hamburguesa sencilla", "yogurt mediano", "papas fritas"], ["combo"], [YOG], false],
  ["yogurt", "yogurt-mediano", "Yogurt Mediano", 150, "Yogurt tropical cremoso y bien frío.", [], [], [YOG], false],
  ["yogurt", "yogurt-grande", "Yogurt Grande", 260, "Yogurt tropical cremoso y bien frío, tamaño grande.", [], ["popular"], [YOG], true],
  ["yogurt", "yogurt-litro", "Yogurt Litro", 400, "Un litro de yogurt tropical para compartir.", [], [], [YOG], false],
  ["combos-yogurt-pan-de-yuca", "combo-1", "Combo 1", 220, "Yogurt mediano con 3 panes de yuca.", ["yogurt mediano", "3 panes de yuca"], ["combo"], [YOG], false],
  ["combos-yogurt-pan-de-yuca", "combo-2", "Combo 2", 320, "Yogurt grande con 3 panes de yuca.", ["yogurt grande", "3 panes de yuca"], ["combo"], [YOG], false],
  ["combos-yogurt-pan-de-yuca", "combo-3", "Combo 3", 525, "Yogurt de litro con 6 panes de yuca.", ["yogurt de litro", "6 panes de yuca"], ["combo"], [YOG], false],
  ["combos-con-yogurt", "combo-4", "Combo 4", 350, "Yogurt mediano con hamburguesa sencilla.", ["yogurt mediano", "hamburguesa sencilla"], ["combo"], [YOG], false],
  ["combos-con-yogurt", "combo-5", "Combo 5", 400, "Yogurt mediano con submarino de jamón y queso.", ["yogurt mediano", "submarino jamón & queso"], ["combo"], [YOG], false],
  ["combos-con-yogurt", "combo-6", "Combo 6", 350, "Yogurt mediano con salchipapa.", ["yogurt mediano", "salchipapa"], ["combo"], [YOG], false],
];

async function main() {
  await dbConnect();

  const categoryIds = new Map<string, mongoose.Types.ObjectId>();
  for (const [i, [slug, name, icon, tagline]] of CATEGORIES.entries()) {
    const category = await Category.findOneAndUpdate(
      { slug },
      { $set: { name, icon, tagline, order: i + 1 }, $setOnInsert: { isActive: true } },
      { upsert: true, new: true },
    );
    categoryIds.set(slug, category._id);
  }

  const orderInCategory = new Map<string, number>();
  let created = 0;
  for (const [cat, slug, name, price, description, includes, badges, options, isFeatured] of PRODUCTS) {
    const order = (orderInCategory.get(cat) ?? 0) + 1;
    orderInCategory.set(cat, order);

    // Precio, imagen y disponibilidad los maneja el cliente desde el admin: solo se fijan al crear o con --force.
    const owned = { price, image: `/menu/${slug}.webp`, isAvailable: true };
    const result = await Product.updateOne(
      { slug },
      {
        $set: {
          name,
          category: categoryIds.get(cat),
          description,
          includes,
          badges,
          options,
          isFeatured,
          order,
          ...(FORCE ? owned : {}),
        },
        $setOnInsert: { isPublished: true, ...(FORCE ? {} : owned) },
      },
      { upsert: true },
    );
    created += result.upsertedCount;
  }

  await getSettings();

  console.log(
    `✔ Menú listo: ${CATEGORIES.length} categorías, ${PRODUCTS.length} productos (${created} nuevos)${FORCE ? " — con --force" : ""}`,
  );
}

main()
  .catch((error) => {
    console.error("✖ Falló el seed del menú:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

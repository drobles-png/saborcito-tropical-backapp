import { Request, Response } from "express";
import * as menuService from "../services/menu.service";

// Express 5 manda al globalErrorHandler el rechazo de un handler async: no hace falta try/catch.

/** GET /api/menu */
export async function getMenu(_req: Request, res: Response) {
  res.json(await menuService.getMenu());
}

/** GET /api/menu/products/:slug */
export async function getProduct(req: Request, res: Response) {
  res.json(await menuService.getProductBySlug(String(req.params.slug)));
}

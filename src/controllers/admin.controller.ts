import { Request, Response } from "express";
import { CustomError } from "../errors/customError.error";
import * as adminOrderService from "../services/adminOrder.service";
import * as catalogService from "../services/catalog.service";
import * as settingsService from "../services/settings.service";
import { uploadBuffer } from "../services/cloudinary.service";

const id = (req: Request) => String(req.params.id);

// ─── Pedidos ────────────────────────────────────────────────────────

export async function stats(_req: Request, res: Response) {
  res.json(await adminOrderService.getStats());
}

export async function listOrders(req: Request, res: Response) {
  res.json(await adminOrderService.listOrders(req.query));
}

export async function getOrder(req: Request, res: Response) {
  res.json(await adminOrderService.getOrder(id(req)));
}

export async function updateOrderStatus(req: Request, res: Response) {
  res.json(await adminOrderService.updateStatus(id(req), req.body?.status));
}

export async function updateOrderPayment(req: Request, res: Response) {
  res.json(await adminOrderService.updatePayment(id(req), req.body?.paymentStatus));
}

// ─── Productos ──────────────────────────────────────────────────────

export async function listProducts(_req: Request, res: Response) {
  res.json(await catalogService.listProducts());
}

export async function createProduct(req: Request, res: Response) {
  res.status(201).json(await catalogService.createProduct(req.body ?? {}));
}

export async function updateProduct(req: Request, res: Response) {
  res.json(await catalogService.updateProduct(id(req), req.body ?? {}));
}

export async function deleteProduct(req: Request, res: Response) {
  res.json(await catalogService.deleteProduct(id(req)));
}

// ─── Categorías ─────────────────────────────────────────────────────

export async function listCategories(_req: Request, res: Response) {
  res.json(await catalogService.listCategories());
}

export async function createCategory(req: Request, res: Response) {
  res.status(201).json(await catalogService.createCategory(req.body ?? {}));
}

export async function updateCategory(req: Request, res: Response) {
  res.json(await catalogService.updateCategory(id(req), req.body ?? {}));
}

export async function deleteCategory(req: Request, res: Response) {
  res.json(await catalogService.deleteCategory(id(req)));
}

export async function reorderCategories(req: Request, res: Response) {
  res.json(await catalogService.reorderCategories(req.body?.ids));
}

// ─── Ajustes ────────────────────────────────────────────────────────

export async function getSettings(_req: Request, res: Response) {
  res.json(await settingsService.getSettings());
}

export async function updateSettings(req: Request, res: Response) {
  res.json(await settingsService.updateSettings(req.body ?? {}));
}

// ─── Imágenes ───────────────────────────────────────────────────────

/** POST /api/admin/uploads/image — multipart, campo `file`. */
export async function uploadImage(req: Request, res: Response) {
  if (!req.file) throw new CustomError("Adjunta una imagen en el campo 'file'", 400);
  if (!req.file.mimetype.startsWith("image/")) throw new CustomError("El archivo debe ser una imagen", 400);
  const { url } = await uploadBuffer(req.file.buffer, "saborcito-tropical/productos");
  res.status(201).json({ url });
}

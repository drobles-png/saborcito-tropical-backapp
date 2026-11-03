import { Request, Response } from "express";
import * as orderService from "../services/order.service";

/** POST /api/orders */
export async function create(req: Request, res: Response) {
  res.status(201).json(await orderService.createOrder(req.body ?? {}));
}

/** GET /api/orders/track/:code */
export async function track(req: Request, res: Response) {
  res.json(await orderService.trackOrder(String(req.params.code)));
}

/** POST /api/orders/confirm — body: { id, clientTransactionId } */
export async function confirm(req: Request, res: Response) {
  const { id, clientTransactionId } = req.body ?? {};
  res.json(await orderService.confirmPayment(id, clientTransactionId));
}

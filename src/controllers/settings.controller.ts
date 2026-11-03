import { Request, Response } from "express";
import * as settingsService from "../services/settings.service";

/** GET /api/settings — versión pública (sin correo de avisos). */
export async function getPublic(_req: Request, res: Response) {
  res.json(await settingsService.getPublicSettings());
}

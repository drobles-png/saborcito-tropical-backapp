import { Router } from "express";
import * as menuController from "../controllers/menu.controller";

const router = Router();

router.get("/", menuController.getMenu);
router.get("/products/:slug", menuController.getProduct);

export default router;

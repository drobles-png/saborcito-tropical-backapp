import { Router } from "express";
import * as orderController from "../controllers/order.controller";

const router = Router();

router.post("/", orderController.create);
router.post("/confirm", orderController.confirm);
router.get("/track/:code", orderController.track);

export default router;

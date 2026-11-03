import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { uploadMiddleware } from "../middlewares/upload.middleware";
import * as adminController from "../controllers/admin.controller";

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get("/stats", adminController.stats);

router.get("/orders", adminController.listOrders);
router.get("/orders/:id", adminController.getOrder);
router.patch("/orders/:id/status", adminController.updateOrderStatus);
router.patch("/orders/:id/payment", adminController.updateOrderPayment);

router.get("/products", adminController.listProducts);
router.post("/products", adminController.createProduct);
router.put("/products/:id", adminController.updateProduct);
router.delete("/products/:id", adminController.deleteProduct);

router.get("/categories", adminController.listCategories);
router.post("/categories", adminController.createCategory);
// Antes de "/categories/:id" para que "reorder" no se lea como id.
router.put("/categories/reorder", adminController.reorderCategories);
router.put("/categories/:id", adminController.updateCategory);
router.delete("/categories/:id", adminController.deleteCategory);

router.get("/settings", adminController.getSettings);
router.put("/settings", adminController.updateSettings);

router.post("/uploads/image", uploadMiddleware.single("file"), adminController.uploadImage);

export default router;

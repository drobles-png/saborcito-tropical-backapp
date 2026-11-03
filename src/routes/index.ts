import express, { Application } from "express";
import authRoutes from "./auth.routes";
import healthRoutes from "./health.routes";
import menuRoutes from "./menu.routes";
import orderRoutes from "./order.routes";
import settingsRoutes from "./settings.routes";
import adminRoutes from "./admin.routes";

function routerApi(app: Application) {
  const router = express.Router();
  app.use("/api", router);

  router.use("/health", healthRoutes);
  router.use("/auth", authRoutes);
  router.use("/menu", menuRoutes);
  router.use("/orders", orderRoutes);
  router.use("/settings", settingsRoutes);
  router.use("/admin", adminRoutes);
}

export default routerApi;

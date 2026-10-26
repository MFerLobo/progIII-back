import { Router } from "express";
import {
  getMisFacturas,
  getFacturaById,
  getFacturaPorOrden,
  getTodasLasFacturas,
  emitirFacturaOrden,
} from "../controller/facturaController.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";
import { validateObjectId } from "../middlewares/validateObjectId.js";

const router = Router();

// Todas las rutas de facturación requieren autenticación
router.use(authenticate);

// 1. Rutas para Clientes
router.get("/mis-facturas", getMisFacturas);
router.get("/orden/:ordenId", validateObjectId("ordenId"), getFacturaPorOrden);

// 2. Detalle de factura (El cliente ve la suya; empleados y admins ven cualquiera)
router.get("/:id", validateObjectId("id"), getFacturaById);

// 3. Rutas de Gestión Contable para Empleados y Administradores
router.get("/", authorizeRoles("empleado", "admin"), getTodasLasFacturas);
router.post(
  "/orden/:ordenId",
  authorizeRoles("empleado", "admin"),
  validateObjectId("ordenId"),
  emitirFacturaOrden
);

export default router;

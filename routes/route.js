import { Router } from "express";
import mongoose from "mongoose";
import authRoutes from "./authRoutes.js";
import categoriaRoutes from "./categoriaRoutes.js";
import marcaRoutes from "./marcaRoutes.js";
import productoRoutes from "./productoRoutes.js";
import usuarioRoutes from "./usuarioRoutes.js";
import ordenRoutes from "./ordenRoutes.js";
import facturaRoutes from "./facturaRoutes.js";

const router = Router();

// Endpoint de estado y salud de la API con mapa de endpoints y permisos
router.get("/health", (req, res) => {
  const dbStates = {
    0: "desconectado",
    1: "conectado",
    2: "conectando",
    3: "desconectando",
  };

  const estadoDb = dbStates[mongoose.connection.readyState] || "desconocido";

  res.status(200).json({
    success: true,
    message: "API Tienda de Componentes de Computación (ARS) operativa.",
    timestamp: new Date().toISOString(),
    moneda: "ARS",
    database: {
      status: estadoDb,
      name: mongoose.connection.name || "N/A",
    },
    roles: {
      admin: "Administra usuarios existentes y sus roles (admin, empleado, cliente)",
      empleado: "Administra catálogo de productos en ARS, stock, categorías, marcas y pedidos",
      cliente: "Explora catálogo, se registra, inicia sesión y realiza compras",
    },
    endpoints: {
      auth: {
        registro: "POST /api/auth/register",
        login: "POST /api/auth/login",
        perfil: "GET /api/auth/perfil [Bearer Token]",
      },
      compras: {
        comprar: "POST /api/ordenes [Cliente]",
        misCompras: "GET /api/ordenes/mis-compras [Cliente]",
        todasLasCompras: "GET /api/ordenes [Empleado / Admin]",
        cambiarEstado: "PATCH /api/ordenes/:id/estado [Empleado / Admin]",
      },
      facturas: {
        misFacturas: "GET /api/facturas/mis-facturas [Cliente]",
        detalle: "GET /api/facturas/:id [Cliente / Empleado / Admin]",
        porOrden: "GET /api/facturas/orden/:ordenId [Cliente / Empleado / Admin]",
        todasLasFacturas: "GET /api/facturas [Empleado / Admin]",
        emitirManual: "POST /api/facturas/orden/:ordenId [Empleado / Admin]",
      },
      productos: {
        catalogo: "GET /api/productos [Público]",
        detalle: "GET /api/productos/:id [Público]",
        crear: "POST /api/productos [Empleado / Admin]",
        actualizar: "PUT /api/productos/:id [Empleado / Admin]",
        stock: "PATCH /api/productos/:id/stock [Empleado / Admin]",
        eliminar: "DELETE /api/productos/:id [Empleado / Admin]",
      },
      categorias: "GET /api/categorias [Público], POST/PUT/DELETE [Empleado / Admin]",
      marcas: "GET /api/marcas [Público], POST/PUT/DELETE [Empleado / Admin]",
      usuarios: "CRUD en /api/usuarios [Exclusivo Admin]",
    },
  });
});

// Rutas de autenticación
router.use("/auth", authRoutes);

// Rutas de componentes y catálogo
router.use("/categorias", categoriaRoutes);
router.use("/marcas", marcaRoutes);
router.use("/productos", productoRoutes);

// Rutas de compras y pedidos (alias /compras y /ordenes)
router.use("/ordenes", ordenRoutes);
router.use("/compras", ordenRoutes);

// Rutas de facturación fiscal
router.use("/facturas", facturaRoutes);

// Rutas de gestión de usuarios y roles
router.use("/usuarios", usuarioRoutes);

export default router;

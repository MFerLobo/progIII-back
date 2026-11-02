import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import connectDB from "./db.js";
import router from "./routes/route.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Conectar a la base de datos MongoDB
connectDB();

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta base informativa
app.get("/", (req, res) => {
  res.status(200).json({
    nombre: "Backend Tienda de Componentes de Computación",
    version: "1.0.0",
    descripcion: "API RESTful construida con Express.js y MongoDB/Mongoose",
    documentacion: {
      health: "/api/health",
      categorias: "/api/categorias",
      marcas: "/api/marcas",
      productos: "/api/productos",
      usuarios: "/api/usuarios",
    },
  });
});

// Enrutador principal de la API
app.use("/api", router);

// Middleware para manejo de rutas 404
app.use(notFoundHandler);

// Middleware centralizado de manejo de errores (siempre al final)
app.use(errorHandler);

// Iniciar servidor HTTP y gestionar cierre limpio
if (process.env.NODE_ENV !== "test") {
  const server = app.listen(PORT, () => {
    console.log(`[Servidor] Ejecutándose en el puerto ${PORT}`);
    console.log(`[Servidor] URL base: http://localhost:${PORT}`);
    console.log(`[Servidor] Estado API: http://localhost:${PORT}/api/health`);
  });

  // Apagado controlado (Graceful Shutdown) para contenedores Docker
  const gracefulShutdown = async (signal) => {
    console.log(`[Servidor] Recibida señal ${signal}. Cerrando servidor HTTP...`);
    server.close(async () => {
      console.log("[Servidor] Servidor HTTP cerrado.");
      try {
        await mongoose.connection.close(false);
        console.log("[MongoDB] Conexión a la base de datos cerrada de forma limpia.");
        process.exit(0);
      } catch (err) {
        console.error("[MongoDB] Error al cerrar la conexión:", err);
        process.exit(1);
      }
    });

    // Forzar terminación si no se cierra en 10 segundos
    setTimeout(() => {
      console.error("[Servidor] Tiempo límite excedido. Forzando cierre del proceso.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

export default app;

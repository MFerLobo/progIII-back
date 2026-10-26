import "./env.js";
import { before, after } from "node:test";
import mongoose from "mongoose";
import { initTestDB, getTestTokens } from "./setup.js";

before(async () => {
  await initTestDB();
  await getTestTokens();
});

after(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  } catch (_) {}
  setTimeout(() => {
    process.exit(process.exitCode || 0);
  }, 100);
});

// Importación ordenada de cada módulo de test para verificar todos los métodos
import "./auth.test.js";
import "./categorias.test.js";
import "./marcas.test.js";
import "./productos.test.js";
import "./ordenes.test.js";
import "./facturas.test.js";
import "./usuarios.test.js";
import "./middlewares.test.js";

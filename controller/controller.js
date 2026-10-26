import * as authController from "./authController.js";
import * as categoriaController from "./categoriaController.js";
import * as marcaController from "./marcaController.js";
import * as productoController from "./productoController.js";
import * as usuarioController from "./usuarioController.js";
import * as ordenController from "./ordenController.js";
import * as facturaController from "./facturaController.js";

export {
  authController,
  categoriaController,
  marcaController,
  productoController,
  usuarioController,
  ordenController,
  facturaController,
};

export default {
  auth: authController,
  categoria: categoriaController,
  marca: marcaController,
  producto: productoController,
  usuario: usuarioController,
  orden: ordenController,
  factura: facturaController,
};

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../server.js";
import { initTestDB, getTestTokens } from "./setup.js";
import Producto from "../entity/producto.js";
import Usuario from "../entity/usuario.js";
import Factura from "../entity/factura.js";

describe("Modulo de Facturacion (/api/facturas) - Tests de Metodos y Principios SOLID", () => {
  let tokens;
  let productoEnVenta;
  let ordenCreadaId;
  let facturaCreadaId;

  before(async () => {
    await initTestDB();
    tokens = await getTestTokens();

    // Obtener un producto activo con stock para probar la compra con factura
    productoEnVenta = await Producto.findOne({ activo: true, stock: { $gt: 5 } });
    if (!productoEnVenta) {
      productoEnVenta = await Producto.create({
        nombre: "Componente Prueba Factura",
        sku: `COMP-FAC-${Date.now()}`,
        precio: 121000, // $121.000 ARS (fácil cálculo: $100.000 neto + $21.000 IVA)
        stock: 15,
        categoria: "507f1f77bcf86cd799439011",
        marca: "507f1f77bcf86cd799439011",
      });
    }
  });

  describe("Emision automatica al realizar Compra [POST /api/ordenes]", () => {
    it("Debe generar la orden y emitir la factura con desglose de IVA (21%) y numero correlativo", async () => {
      const res = await request(app)
        .post("/api/ordenes")
        .set("Authorization", `Bearer ${tokens.clienteToken}`)
        .send({
          items: [{ productoId: productoEnVenta._id, cantidad: 1 }],
          metodoPago: "transferencia",
          direccionEnvio: {
            calle: "Av. Corrientes 2500",
            ciudad: "CABA",
            provincia: "Buenos Aires",
            codigoPostal: "C1046",
          },
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.factura, "La respuesta debe contener el resumen de la factura emitida");
      assert.match(res.body.factura.numeroFactura, /^FC-B-0001-\d{8}$/);
      assert.equal(res.body.factura.tipoComprobante, "Factura B");
      assert.equal(res.body.factura.total, productoEnVenta.precio);
      assert.ok(res.body.factura.ivaTotal > 0, "El IVA total debe ser mayor a 0");
      assert.ok(res.body.factura.subtotalNetoGravado > 0, "El neto gravado debe ser mayor a 0");

      ordenCreadaId = res.body.data._id;
      facturaCreadaId = res.body.factura.id;
    });
  });

  describe("Metodo: getMisFacturas() [GET /api/facturas/mis-facturas]", () => {
    it("Debe retornar las facturas del cliente autenticado (200 OK)", async () => {
      const res = await request(app)
        .get("/api/facturas/mis-facturas")
        .set("Authorization", `Bearer ${tokens.clienteToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 1);
    });
  });

  describe("Metodo: getFacturaById() [GET /api/facturas/:id]", () => {
    it("Debe permitir al cliente ver su propia factura (200 OK)", async () => {
      const res = await request(app)
        .get(`/api/facturas/${facturaCreadaId}`)
        .set("Authorization", `Bearer ${tokens.clienteToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data._id, facturaCreadaId);
      assert.ok(res.body.data.emisor, "Debe contener los datos del emisor de la tienda");
      assert.ok(res.body.data.receptor, "Debe contener los datos fiscales del receptor");
    });

    it("Debe denegar con 403 a otro cliente ajeno que intente consultar la factura", async () => {
      const otroCliente = await Usuario.create({
        nombre: "Cliente Tercero",
        email: `cliente_tercero_${Date.now()}@test.com`,
        password: "Password123!",
        rol: "cliente",
      });
      const tokenOtro = otroCliente.generarJWT();

      const res = await request(app)
        .get(`/api/facturas/${facturaCreadaId}`)
        .set("Authorization", `Bearer ${tokenOtro}`);

      assert.equal(res.status, 403);
      assert.match(res.body.message, /no tiene permisos/i);
    });

    it("Debe permitir a un empleado o admin consultar cualquier factura de la tienda", async () => {
      const res = await request(app)
        .get(`/api/facturas/${facturaCreadaId}`)
        .set("Authorization", `Bearer ${tokens.empleadoToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data._id, facturaCreadaId);
    });
  });

  describe("Metodo: getFacturaPorOrden() [GET /api/facturas/orden/:ordenId]", () => {
    it("Debe retornar la factura vinculada directamente a la orden de compra", async () => {
      const res = await request(app)
        .get(`/api/facturas/orden/${ordenCreadaId}`)
        .set("Authorization", `Bearer ${tokens.clienteToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.orden._id, ordenCreadaId);
    });
  });

  describe("Metodo: getTodasLasFacturas() [GET /api/facturas]", () => {
    it("Debe permitir a un 'empleado' o 'admin' consultar el listado contable de facturas (200 OK)", async () => {
      const res = await request(app)
        .get("/api/facturas")
        .set("Authorization", `Bearer ${tokens.adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
    });

    it("Debe denegar el acceso a un 'cliente' (403 Forbidden)", async () => {
      const res = await request(app)
        .get("/api/facturas")
        .set("Authorization", `Bearer ${tokens.clienteToken}`);

      assert.equal(res.status, 403);
    });
  });
});

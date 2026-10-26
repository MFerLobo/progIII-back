import Factura from "../entity/factura.js";
import Orden from "../entity/orden.js";
import Usuario from "../entity/usuario.js";

/**
 * Servicio de Dominio para Facturación (Principio de Responsabilidad Única - SRP)
 * Encapsula la lógica de cálculo impositivo, numeración correlativa y emisión.
 */
export class FacturaService {
  /**
   * Calcula el desglose fiscal de los ítems de compra en ARS.
   * Por defecto aplica la alícuota general de Argentina del 21% de IVA.
   * @param {Array} items - Ítems de la orden
   * @param {number} alicuota - Porcentaje de IVA (default 21%)
   */
  static calcularDesgloseFiscal(items, alicuota = 21) {
    const factorIva = 1 + alicuota / 100;
    let subtotalNetoGravado = 0;
    let ivaTotal = 0;

    const itemsFacturados = items.map((item) => {
      // El precio en catálogo/orden de la tienda ya incluye IVA
      const precioUnitarioNeto = Number((item.precioUnitario / factorIva).toFixed(2));
      const subtotalNetoItem = Number((item.subtotal / factorIva).toFixed(2));
      const ivaMontoItem = Number((item.subtotal - subtotalNetoItem).toFixed(2));

      subtotalNetoGravado += subtotalNetoItem;
      ivaTotal += ivaMontoItem;

      return {
        producto: item.producto,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precioUnitarioNeto,
        alicuotaIva: alicuota,
        ivaMonto: ivaMontoItem,
        subtotalConIva: item.subtotal,
      };
    });

    // Ajuste de precisión centesimal
    subtotalNetoGravado = Number(subtotalNetoGravado.toFixed(2));
    ivaTotal = Number(ivaTotal.toFixed(2));
    const total = Number((subtotalNetoGravado + ivaTotal).toFixed(2));

    return {
      itemsFacturados,
      subtotalNetoGravado,
      ivaTotal,
      total,
    };
  }

  /**
   * Genera el siguiente número secuencial de factura para un punto de venta y letra.
   * Ejemplo: FC-B-0001-00000001
   * @param {string} tipo - "Factura B" o "Factura A"
   * @param {number} puntoVenta - Número de punto de venta (default 1)
   */
  static async generarSiguienteNumeroFactura(tipo = "Factura B", puntoVenta = 1) {
    const letra = tipo === "Factura A" ? "A" : "B";
    const prefijo = `FC-${letra}-${String(puntoVenta).padStart(4, "0")}-`;

    // Buscar la última factura emitida con ese prefijo
    const ultimaFactura = await Factura.findOne({
      numeroFactura: new RegExp(`^${prefijo}`),
    })
      .sort({ numeroFactura: -1 })
      .lean();

    let siguienteSecuencia = 1;

    if (ultimaFactura && ultimaFactura.numeroFactura) {
      const partes = ultimaFactura.numeroFactura.split("-");
      const ultimaSecuencia = parseInt(partes[3], 10);
      if (!isNaN(ultimaSecuencia)) {
        siguienteSecuencia = ultimaSecuencia + 1;
      }
    }

    return `${prefijo}${String(siguienteSecuencia).padStart(8, "0")}`;
  }

  /**
   * Emite una factura vinculada a una orden de compra existente.
   * Es idempotente: si la orden ya tiene factura, retorna la existente.
   * @param {string|mongoose.Types.ObjectId} ordenId - ID de la orden
   * @param {Object} datosFiscalesExtra - Datos fiscales adicionales (opcional)
   */
  static async emitirFactura(ordenId, datosFiscalesExtra = {}) {
    const orden = await Orden.findById(ordenId).populate("usuario");

    if (!orden) {
      throw new Error(`La orden con ID '${ordenId}' no existe.`);
    }

    // Si ya existe factura previa para esta orden, devolverla sin duplicar
    const facturaExistente = await Factura.findOne({ orden: orden._id });
    if (facturaExistente) {
      return facturaExistente;
    }

    const usuario = orden.usuario;
    const condicionIvaCliente =
      datosFiscalesExtra.condicionIva || usuario.condicionIva || "Consumidor Final";
    const tipoComprobante =
      condicionIvaCliente === "Responsable Inscripto" ? "Factura A" : "Factura B";

    // 1. Calcular desglose de IVA y neto gravado en ARS
    const { itemsFacturados, subtotalNetoGravado, ivaTotal, total } =
      this.calcularDesgloseFiscal(orden.items, 21);

    // 2. Obtener numeración correlativa
    const numeroFactura = await this.generarSiguienteNumeroFactura(tipoComprobante, 1);

    // 3. Resolver datos del receptor
    const datosReceptor = {
      nombre: datosFiscalesExtra.nombre || usuario.nombre,
      email: datosFiscalesExtra.email || usuario.email,
      documentoTipo:
        datosFiscalesExtra.documentoTipo || usuario.documentoTipo || (tipoComprobante === "Factura A" ? "CUIT" : "DNI"),
      documentoNumero:
        datosFiscalesExtra.documentoNumero || usuario.documentoNumero || "0",
      condicionIva: condicionIvaCliente,
      direccion: orden.direccionEnvio || usuario.direccion || {},
    };

    // 4. Crear documento inmutable de Factura
    const nuevaFactura = await Factura.create({
      numeroFactura,
      tipoComprobante,
      orden: orden._id,
      usuario: usuario._id,
      receptor: datosReceptor,
      items: itemsFacturados,
      subtotalNetoGravado,
      ivaTotal,
      total,
      moneda: orden.moneda || "ARS",
      metodoPago: orden.metodoPago,
      fechaEmision: new Date(),
    });

    // 5. Vincular la factura en la orden
    orden.factura = nuevaFactura._id;
    await orden.save();

    return nuevaFactura;
  }
}

export default FacturaService;

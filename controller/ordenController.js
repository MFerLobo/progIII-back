import mongoose from "mongoose";
import Orden from "../entity/orden.js";
import Producto from "../entity/producto.js";
import FacturaService from "../services/facturaService.js";

/**
 * Realizar una compra (Clientes)
 * Decrementa stock de productos, valida stock suficiente y calcula total en ARS
 */
export const crearCompra = async (req, res, next) => {
  try {
    const { items, metodoPago = "transferencia", direccionEnvio } = req.body;

    // 1. Validar que la orden tenga ítems
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Debe incluir una lista de productos ('items') para realizar la compra.",
      });
    }

    // 2. Resolver dirección de envío (del body o del perfil del usuario)
    const direccionFinal = direccionEnvio || req.usuario.direccion;
    if (
      !direccionFinal ||
      !direccionFinal.calle ||
      !direccionFinal.ciudad ||
      !direccionFinal.provincia ||
      !direccionFinal.codigoPostal
    ) {
      return res.status(400).json({
        success: false,
        message:
          "La dirección de envío completa (calle, ciudad, provincia y codigoPostal) es obligatoria para procesar la compra.",
      });
    }

    // 3. Validar disponibilidad y stock de cada ítem
    const itemsOrden = [];
    let totalCalculado = 0;
    const productosParaActualizar = [];

    for (const item of items) {
      const productoId = item.producto || item.productoId;
      const cantidad = parseInt(item.cantidad, 10);

      if (!productoId || !mongoose.Types.ObjectId.isValid(productoId)) {
        return res.status(400).json({
          success: false,
          message: `El ID de producto '${productoId}' no es válido.`,
        });
      }

      if (!cantidad || isNaN(cantidad) || cantidad <= 0) {
        return res.status(400).json({
          success: false,
          message: "La cantidad solicitada para cada producto debe ser un entero mayor o igual a 1.",
        });
      }

      const producto = await Producto.findById(productoId);

      if (!producto || !producto.activo) {
        return res.status(404).json({
          success: false,
          message: `El producto con ID '${productoId}' no está disponible o no existe.`,
        });
      }

      if (producto.stock < cantidad) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para el componente '${producto.nombre}'. Stock disponible: ${producto.stock}, unidades solicitadas: ${cantidad}.`,
        });
      }

      const subtotal = producto.precio * cantidad;
      totalCalculado += subtotal;

      itemsOrden.push({
        producto: producto._id,
        nombre: producto.nombre,
        precioUnitario: producto.precio,
        cantidad,
        subtotal,
      });

      productosParaActualizar.push({
        doc: producto,
        cantidadDescontar: cantidad,
      });
    }

    // 4. Descontar el stock de los productos comprados
    for (const itemUpdate of productosParaActualizar) {
      itemUpdate.doc.stock -= itemUpdate.cantidadDescontar;
      await itemUpdate.doc.save();
    }

    // 5. Crear el registro de la orden de compra
    const nuevaOrden = await Orden.create({
      usuario: req.usuario._id,
      items: itemsOrden,
      total: totalCalculado,
      moneda: "ARS",
      metodoPago,
      estado: "pendiente",
      direccionEnvio: direccionFinal,
    });

    // 6. Generar automáticamente la factura fiscal asociada (Principio SRP delegado en FacturaService)
    const facturaEmitida = await FacturaService.emitirFactura(
      nuevaOrden._id,
      req.body.datosFiscales || {}
    );

    const ordenPoblada = await Orden.findById(nuevaOrden._id)
      .populate("usuario", "nombre email telefono")
      .populate("factura", "numeroFactura tipoComprobante total ivaTotal fechaEmision");

    res.status(201).json({
      success: true,
      message: "¡Compra realizada con éxito! Su pedido y factura fueron emitidos.",
      data: ordenPoblada,
      factura: {
        id: facturaEmitida._id,
        numeroFactura: facturaEmitida.numeroFactura,
        tipoComprobante: facturaEmitida.tipoComprobante,
        subtotalNetoGravado: facturaEmitida.subtotalNetoGravado,
        ivaTotal: facturaEmitida.ivaTotal,
        total: facturaEmitida.total,
        moneda: facturaEmitida.moneda,
        cae: facturaEmitida.cae,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener las compras del cliente autenticado
 */
export const getMisCompras = async (req, res, next) => {
  try {
    const ordenes = await Orden.find({ usuario: req.usuario._id })
      .sort({ createdAt: -1 })
      .populate("items.producto", "nombre sku imagenes")
      .populate("factura", "numeroFactura tipoComprobante total ivaTotal fechaEmision");

    res.status(200).json({
      success: true,
      count: ordenes.length,
      data: ordenes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener detalle de una compra por ID
 * Los clientes solo pueden ver su propia compra. Empleados y administradores pueden ver cualquier compra.
 */
export const getCompraById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orden = await Orden.findById(id)
      .populate("usuario", "nombre email telefono")
      .populate("items.producto", "nombre sku imagenes categoria marca")
      .populate("factura");

    if (!orden) {
      return res.status(404).json({
        success: false,
        message: `Orden de compra con ID '${id}' no encontrada.`,
      });
    }

    // Si es cliente, debe ser el titular de la orden
    if (
      req.usuario.rol === "cliente" &&
      orden.usuario._id.toString() !== req.usuario._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "No tiene permisos para ver esta orden de compra.",
      });
    }

    res.status(200).json({
      success: true,
      data: orden,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar todas las compras de la tienda (Solo Empleados y Administradores)
 */
export const getTodasLasCompras = async (req, res, next) => {
  try {
    const { estado, page = 1, limit = 20 } = req.query;
    const filtro = {};

    if (estado) {
      filtro.estado = estado;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [totalDocs, ordenes] = await Promise.all([
      Orden.countDocuments(filtro),
      Orden.find(filtro)
        .populate("usuario", "nombre email telefono")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const totalPages = Math.ceil(totalDocs / limitNum) || 1;

    res.status(200).json({
      success: true,
      pagination: {
        totalDocs,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
      },
      data: ordenes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cambiar estado de una compra (Solo Empleados y Administradores)
 * Body: { estado: 'pagado' | 'preparando' | 'enviado' | 'entregado' | 'cancelado' }
 */
export const cambiarEstadoCompra = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = [
      "pendiente",
      "pagado",
      "preparando",
      "enviado",
      "entregado",
      "cancelado",
    ];

    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: `Estado '${estado}' inválido. Debe ser uno de: ${estadosValidos.join(", ")}`,
      });
    }

    const orden = await Orden.findById(id);

    if (!orden) {
      return res.status(404).json({
        success: false,
        message: `Orden con ID '${id}' no encontrada.`,
      });
    }

    // Si se cancela la orden y antes no estaba cancelada, reintegrar el stock a los productos
    if (estado === "cancelado" && orden.estado !== "cancelado") {
      for (const item of orden.items) {
        await Producto.findByIdAndUpdate(item.producto, {
          $inc: { stock: item.cantidad },
        });
      }
    }

    orden.estado = estado;
    await orden.save();

    res.status(200).json({
      success: true,
      message: `El estado de la compra fue actualizado a '${estado}'.`,
      data: orden,
    });
  } catch (error) {
    next(error);
  }
};

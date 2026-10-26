import Factura from "../entity/factura.js";
import Orden from "../entity/orden.js";
import FacturaService from "../services/facturaService.js";

/**
 * Obtener las facturas del cliente autenticado
 */
export const getMisFacturas = async (req, res, next) => {
  try {
    const facturas = await Factura.find({ usuario: req.usuario._id })
      .sort({ fechaEmision: -1 })
      .populate("orden", "estado metodoPago total");

    res.status(200).json({
      success: true,
      count: facturas.length,
      data: facturas,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener detalle de una factura por ID
 * El cliente solo puede ver la suya; empleados y admins pueden ver cualquiera.
 */
export const getFacturaById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const factura = await Factura.findById(id)
      .populate("usuario", "nombre email telefono")
      .populate("orden", "estado metodoPago total");

    if (!factura) {
      return res.status(404).json({
        success: false,
        message: `Factura con ID '${id}' no encontrada.`,
      });
    }

    if (
      req.usuario.rol === "cliente" &&
      factura.usuario._id.toString() !== req.usuario._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "No tiene permisos para consultar esta factura.",
      });
    }

    res.status(200).json({
      success: true,
      data: factura,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener la factura asociada a una orden de compra
 */
export const getFacturaPorOrden = async (req, res, next) => {
  try {
    const { ordenId } = req.params;
    const factura = await Factura.findOne({ orden: ordenId })
      .populate("usuario", "nombre email")
      .populate("orden", "estado total");

    if (!factura) {
      return res.status(404).json({
        success: false,
        message: `No se encontró factura emitida para la orden con ID '${ordenId}'.`,
      });
    }

    if (
      req.usuario.rol === "cliente" &&
      factura.usuario._id.toString() !== req.usuario._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "No tiene permisos para consultar la factura de esta orden.",
      });
    }

    res.status(200).json({
      success: true,
      data: factura,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar todas las facturas de la tienda (Solo Empleados y Administradores)
 */
export const getTodasLasFacturas = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, tipo } = req.query;
    const filtro = {};

    if (tipo) {
      filtro.tipoComprobante = tipo;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [totalDocs, facturas] = await Promise.all([
      Factura.countDocuments(filtro),
      Factura.find(filtro)
        .populate("usuario", "nombre email")
        .sort({ fechaEmision: -1 })
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
      data: facturas,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Emitir factura manualmente para una orden (Empleado / Admin)
 */
export const emitirFacturaOrden = async (req, res, next) => {
  try {
    const { ordenId } = req.params;
    const datosFiscales = req.body || {};

    const factura = await FacturaService.emitirFactura(ordenId, datosFiscales);

    res.status(201).json({
      success: true,
      message: "Factura emitida exitosamente.",
      data: factura,
    });
  } catch (error) {
    next(error);
  }
};

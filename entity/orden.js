import mongoose from "mongoose";

const itemOrdenSchema = new mongoose.Schema(
  {
    producto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Producto",
      required: [true, "El producto es obligatorio en el ítem de compra."],
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    precioUnitario: {
      type: Number,
      required: true,
      min: [0, "El precio unitario no puede ser negativo."],
    },
    cantidad: {
      type: Number,
      required: true,
      min: [1, "La cantidad mínima por producto es 1."],
      validate: {
        validator: Number.isInteger,
        message: "La cantidad debe ser un número entero.",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, "El subtotal no puede ser negativo."],
    },
  },
  { _id: false }
);

const direccionEnvioSchema = new mongoose.Schema(
  {
    calle: { type: String, required: [true, "La calle de envío es obligatoria."], trim: true },
    ciudad: { type: String, required: [true, "La ciudad de envío es obligatoria."], trim: true },
    provincia: { type: String, required: [true, "La provincia de envío es obligatoria."], trim: true },
    codigoPostal: { type: String, required: [true, "El código postal es obligatorio."], trim: true },
  },
  { _id: false }
);

const ordenSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: [true, "El cliente comprador es obligatorio."],
    },
    items: {
      type: [itemOrdenSchema],
      required: [true, "La orden debe contener al menos un producto."],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "Debe agregar al menos un producto a la compra.",
      },
    },
    total: {
      type: Number,
      required: [true, "El total de la compra es obligatorio."],
      min: [0, "El total no puede ser negativo."],
    },
    moneda: {
      type: String,
      default: "ARS",
    },
    metodoPago: {
      type: String,
      enum: {
        values: ["transferencia", "tarjeta_credito", "tarjeta_debito", "efectivo"],
        message: "Método de pago '{VALUE}' no válido.",
      },
      default: "transferencia",
    },
    estado: {
      type: String,
      enum: {
        values: ["pendiente", "pagado", "preparando", "enviado", "entregado", "cancelado"],
        message: "Estado de orden '{VALUE}' no válido.",
      },
      default: "pendiente",
    },
    direccionEnvio: {
      type: direccionEnvioSchema,
      required: [true, "La dirección de envío es obligatoria."],
    },
    factura: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Factura",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ordenSchema.index({ usuario: 1, createdAt: -1 });
ordenSchema.index({ estado: 1 });

const Orden = mongoose.model("Orden", ordenSchema);

export default Orden;

import mongoose from "mongoose";

const itemFacturaSchema = new mongoose.Schema(
  {
    producto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Producto",
      required: true,
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    cantidad: {
      type: Number,
      required: true,
      min: 1,
    },
    precioUnitarioNeto: {
      type: Number,
      required: true,
      min: 0,
    },
    alicuotaIva: {
      type: Number,
      default: 21, // 21% de IVA estándar en computación / electrónica en Argentina
    },
    ivaMonto: {
      type: Number,
      required: true,
      min: 0,
    },
    subtotalConIva: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const datosEmisorSchema = new mongoose.Schema(
  {
    razonSocial: { type: String, default: "TechStore Computación S.R.L." },
    cuit: { type: String, default: "30-71234567-9" },
    condicionIva: { type: String, default: "Responsable Inscripto" },
    domicilioFiscal: { type: String, default: "Av. Corrientes 1500, CABA, Argentina" },
    puntoDeVenta: { type: Number, default: 1 },
  },
  { _id: false }
);

const datosReceptorSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    documentoTipo: { type: String, enum: ["DNI", "CUIT", "CUIL"], default: "DNI" },
    documentoNumero: { type: String, default: "0" },
    condicionIva: {
      type: String,
      enum: ["Consumidor Final", "Responsable Inscripto", "Monotributo"],
      default: "Consumidor Final",
    },
    direccion: {
      calle: { type: String, default: "" },
      ciudad: { type: String, default: "" },
      provincia: { type: String, default: "" },
      codigoPostal: { type: String, default: "" },
    },
  },
  { _id: false }
);

const facturaSchema = new mongoose.Schema(
  {
    numeroFactura: {
      type: String,
      required: [true, "El número de factura es obligatorio."],
      unique: true,
      trim: true,
      uppercase: true,
    },
    tipoComprobante: {
      type: String,
      enum: ["Factura B", "Factura A"],
      default: "Factura B",
    },
    orden: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Orden",
      required: [true, "La factura debe estar vinculada a una orden de compra."],
      unique: true, // Una orden solo tiene una factura fiscal asociada
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: [true, "El cliente titular de la factura es obligatorio."],
    },
    emisor: {
      type: datosEmisorSchema,
      default: () => ({}),
    },
    receptor: {
      type: datosReceptorSchema,
      required: [true, "Los datos del receptor son obligatorios."],
    },
    items: {
      type: [itemFacturaSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "La factura debe incluir al menos un ítem facturado.",
      },
    },
    subtotalNetoGravado: {
      type: Number,
      required: true,
      min: [0, "El subtotal neto no puede ser negativo."],
    },
    ivaTotal: {
      type: Number,
      required: true,
      min: [0, "El IVA total no puede ser negativo."],
    },
    total: {
      type: Number,
      required: true,
      min: [0, "El total no puede ser negativo."],
    },
    moneda: {
      type: String,
      default: "ARS",
    },
    metodoPago: {
      type: String,
      default: "transferencia",
    },
    fechaEmision: {
      type: Date,
      default: Date.now,
    },
    cae: {
      type: String,
      default: () => Math.floor(10000000000000 + Math.random() * 90000000000000).toString(),
    },
    fechaVencimientoCae: {
      type: Date,
      default: () => new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // Vence en 10 días
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

facturaSchema.index({ usuario: 1, createdAt: -1 });

const Factura = mongoose.model("Factura", facturaSchema);

export default Factura;

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const direccionSchema = new mongoose.Schema(
  {
    calle: { type: String, trim: true, default: "" },
    ciudad: { type: String, trim: true, default: "" },
    provincia: { type: String, trim: true, default: "" },
    codigoPostal: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, "El nombre del usuario es obligatorio."],
      trim: true,
      minlength: [2, "El nombre debe contener al menos 2 caracteres."],
      maxlength: [100, "El nombre no puede superar los 100 caracteres."],
    },
    email: {
      type: String,
      required: [true, "El correo electrónico es obligatorio."],
      unique: true,
      trim: true,
      lowercase: true,
      match: [emailRegex, "Debe ingresar un formato de correo electrónico válido."],
    },
    password: {
      type: String,
      required: [true, "La contraseña es obligatoria."],
      minlength: [6, "La contraseña debe tener al menos 6 caracteres."],
      select: false, // Por seguridad no se devuelve en consultas a menos que se pida explícitamente
    },
    rol: {
      type: String,
      enum: {
        values: ["admin", "empleado", "cliente"],
        message: "El rol '{VALUE}' no es válido. Debe ser 'admin', 'empleado' o 'cliente'.",
      },
      default: "cliente",
    },
    telefono: {
      type: String,
      trim: true,
      default: "",
    },
    direccion: {
      type: direccionSchema,
      default: () => ({}),
    },
    documentoTipo: {
      type: String,
      enum: ["DNI", "CUIT", "CUIL"],
      default: "DNI",
    },
    documentoNumero: {
      type: String,
      trim: true,
      default: "",
    },
    condicionIva: {
      type: String,
      enum: ["Consumidor Final", "Responsable Inscripto", "Monotributo"],
      default: "Consumidor Final",
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Hash de la contraseña antes de guardar el usuario si fue modificada
usuarioSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Método para comparar contraseñas en el login
usuarioSchema.methods.compararPassword = async function (passwordIngresado) {
  return await bcrypt.compare(passwordIngresado, this.password);
};

// Método para generar el JWT
usuarioSchema.methods.generarJWT = function () {
  const secret = process.env.JWT_SECRET || "secreto_default_seguridad";
  const expiresIn = process.env.JWT_EXPIRES_IN || "24h";

  return jwt.sign(
    {
      id: this._id,
      nombre: this.nombre,
      email: this.email,
      rol: this.rol,
    },
    secret,
    { expiresIn }
  );
};

const Usuario = mongoose.model("Usuario", usuarioSchema);

export default Usuario;

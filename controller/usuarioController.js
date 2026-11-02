import Usuario from "../entity/usuario.js";

/**
 * Obtener todos los usuarios (Solo Admin)
 * Query params opcionales: ?rol=cliente|empleado|admin&activo=true|false
 */
export const getUsuarios = async (req, res, next) => {
  try {
    const { rol, activo, page = 1, limit = 20 } = req.query;
    const filtro = {};

    if (rol) {
      filtro.rol = rol;
    }

    if (activo !== undefined) {
      filtro.activo = activo === "true";
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [totalDocs, usuarios] = await Promise.all([
      Usuario.countDocuments(filtro),
      Usuario.find(filtro)
        .select("-password")
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
      data: usuarios,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener usuario por ID (Solo Admin)
 */
export const getUsuarioById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findById(id).select("-password");

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: `Usuario con ID '${id}' no encontrado.`,
      });
    }

    res.status(200).json({
      success: true,
      data: usuario,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Crear nuevo usuario asignando rol explícito (Solo Admin)
 */
export const createUsuario = async (req, res, next) => {
  try {
    const { nombre, email, password, rol = "cliente", telefono, direccion, activo } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Los campos 'nombre', 'email' y 'password' son obligatorios.",
      });
    }

    const usuarioExistente = await Usuario.findOne({ email: email.toLowerCase().trim() });
    if (usuarioExistente) {
      return res.status(409).json({
        success: false,
        message: "Ya existe un usuario con ese correo electrónico.",
      });
    }

    const nuevoUsuario = await Usuario.create({
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      password,
      rol,
      telefono: telefono ? telefono.trim() : "",
      direccion: direccion || {},
      activo: activo !== undefined ? Boolean(activo) : true,
    });

    res.status(201).json({
      success: true,
      message: `Usuario con rol '${rol}' creado exitosamente.`,
      data: {
        id: nuevoUsuario._id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol,
        telefono: nuevoUsuario.telefono,
        direccion: nuevoUsuario.direccion,
        activo: nuevoUsuario.activo,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar datos de un usuario o cambiar su rol (Solo Admin)
 */
export const updateUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, telefono, direccion, activo, password } = req.body;

    const usuario = await Usuario.findById(id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: `Usuario con ID '${id}' no encontrado.`,
      });
    }

    if (nombre !== undefined) {
      if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
        return res.status(400).json({
          success: false,
          message: "El nombre no puede estar vacío.",
        });
      }
      usuario.nombre = nombre.trim();
    }

    if (email !== undefined) {
      if (!email || typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: "El email no puede estar vacío.",
        });
      }
      usuario.email = email.trim().toLowerCase();
    }


    // El admin puede cambiar roles de otros usuarios,
    // pero no puede modificar su propio rol.
    if (rol !== undefined) {

      const esUsuarioActual =
        req.usuario?._id?.toString() === id;

      if (esUsuarioActual && rol !== usuario.rol) {
        return res.status(403).json({
          success: false,
          message: "No podés modificar tu propio rol de administrador."
        });
      }

      const rolesValidos = ["admin", "empleado", "cliente"];

      if (!rolesValidos.includes(rol)) {
        return res.status(400).json({
          success: false,
          message: `Rol '${rol}' inválido. Roles permitidos: ${rolesValidos.join(", ")}`
        });
      }

      usuario.rol = rol;
    }


    if (telefono !== undefined) usuario.telefono = telefono.trim();
    if (direccion !== undefined) usuario.direccion = direccion;
    if (activo !== undefined) usuario.activo = Boolean(activo);
    if (password) usuario.password = password; // Activará el hook pre('save') para rehashear

    await usuario.save();

    res.status(200).json({
      success: true,
      message: "Usuario actualizado exitosamente por el administrador.",
      data: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        telefono: usuario.telefono,
        direccion: usuario.direccion,
        activo: usuario.activo,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar o desactivar un usuario (Solo Admin)
 * Query param opcional: ?fisico=true
 */
export const deleteUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fisico } = req.query;

    // Evitar que el admin se borre a sí mismo
    if (req.usuario && req.usuario._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "No puede eliminar su propia cuenta de administrador mientras está en sesión.",
      });
    }

    if (fisico === "true") {
      const eliminado = await Usuario.findByIdAndDelete(id);
      if (!eliminado) {
        return res.status(404).json({
          success: false,
          message: `Usuario con ID '${id}' no encontrado.`,
        });
      }
      return res.status(200).json({
        success: true,
        message: "Usuario eliminado permanentemente del sistema.",
        data: eliminado,
      });
    }

    const desactivado = await Usuario.findByIdAndUpdate(
      id,
      { activo: false },
      { returnDocument: "after" }
    ).select("-password");

    if (!desactivado) {
      return res.status(404).json({
        success: false,
        message: `Usuario con ID '${id}' no encontrado.`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Usuario desactivado exitosamente (baja lógica).",
      data: desactivado,
    });
  } catch (error) {
    next(error);
  }
};

# 1. Imagen base oficial de Node.js versión 20 LTS sobre Alpine Linux (ligera, rápida y segura)
FROM node:20-alpine

# 2. Definir el directorio de trabajo dentro del contenedor
WORKDIR /app

# 3. Establecer la variable de entorno para producción
ENV NODE_ENV=production

# 4. Copiar únicamente los archivos de manifiesto de dependencias
# Esto permite aprovechar la caché de capas de Docker: si no cambian las dependencias, no se reinstalan
COPY package*.json ./

# 5. Instalar exclusivamente dependencias de producción de forma limpia y determinista
RUN npm ci --omit=dev && npm cache clean --force

# 6. Copiar el resto del código fuente del proyecto con permisos para el usuario 'node'
COPY --chown=node:node . .

# 7. Cambiar al usuario no privilegiado 'node' por seguridad (evita ejecutar el contenedor como root)
USER node

# 8. Declarar el puerto predeterminado (Render inyecta PORT dinámicamente en tiempo de ejecución)
EXPOSE 4000

# 9. Comando de arranque del servidor en producción
CMD ["npm", "start"]

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Definir variables de entorno si son necesarias
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# MUY IMPORTANTE: Asegurar que los datos masivos viajen al contenedor final
COPY --from=builder /app/migration_timeline ./migration_timeline

EXPOSE 3600

# Punto de entrada explícito (NestJS no aplanado detected)
CMD ["node", "dist/src/main.js"]

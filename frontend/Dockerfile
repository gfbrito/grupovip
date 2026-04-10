FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências
COPY package*.json ./
RUN npm install

# Copiar código fonte
COPY . .
RUN mkdir -p public

# Build
# Nota: certifique-se de que "output": "standalone" está no next.config.mjs
RUN npm run build

# Stage de produção
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copiar arquivos necessários do build standalone
RUN mkdir -p ./public
COPY --from=builder /app/public/. ./public/
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./

# Expor porta
EXPOSE 3000

# Iniciar servidor
CMD ["node", "server.js"]

FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências
COPY package*.json ./
COPY prisma ./prisma/

# O Alpine precisa do Git caso tenha algum pacote do Github no package.json
RUN apk add --no-cache git
RUN npm install

# Copiar código fonte
COPY . .

# Gerar cliente do Prisma
RUN npx prisma generate

# Build
RUN npm run build

# Stage de produção
FROM node:20-alpine

WORKDIR /app

# Prisma precisa do OpenSSL para rodar as migrations no Alpine
RUN apk add --no-cache openssl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate

# Expor porta
EXPOSE 3001

# Cria pasta de uploads para armazenamento local temporário
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

# Scripts para rodar migrations e iniciar
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]

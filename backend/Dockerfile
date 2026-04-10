FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências
COPY package*.json ./
COPY prisma ./prisma/

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

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Expor porta
EXPOSE 3001

# Scripts para rodar migrations e iniciar
CMD ["npm", "start"]

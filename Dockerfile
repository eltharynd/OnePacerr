FROM node:24-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build


FROM node:24-slim AS runner

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

RUN touch .env

EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/index.js"]
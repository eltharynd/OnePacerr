FROM node:24-slim AS builder

WORKDIR /app
COPY package.json ./
RUN npm i
COPY . .
RUN npm run build


FROM node:24-slim AS runner

WORKDIR /app
COPY package.json ./
COPY posters ./posters
RUN npm i --omit=dev
COPY --from=builder /app/dist ./dist

RUN touch .env

EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/index.js"]

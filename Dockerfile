FROM node:lts-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm i
COPY src /app/src
COPY tsconfig.json .
RUN npm run build
RUN npm prune --omit=dev


FROM node:lts-alpine AS runner

WORKDIR /app
COPY package.json ./
COPY posters ./posters
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN touch .env

EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/index.js"]

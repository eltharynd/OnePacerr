FROM node:lts-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm i

FROM node:lts-alpine AS prod-deps
WORKDIR /app
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm i --omit=dev

FROM deps AS builder
WORKDIR /app
COPY tsconfig.json .
COPY src ./src
RUN npm run build


FROM node:lts-alpine AS runner
WORKDIR /app
COPY package.json ./
COPY posters ./posters
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN touch .env

EXPOSE 3000
CMD ["npm", "start"]

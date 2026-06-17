FROM node:24-slim AS runner

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN touch .env
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
# Echo service. Uses Node's built-in node:sqlite, so no native build step.
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV DB_PATH=/app/data/echo.db
EXPOSE 3000
CMD ["node", "dist/server.js"]

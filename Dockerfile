# Build the React client using the repository's Node 22 runtime.
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm --prefix client ci
RUN npm --prefix client run build

# Run Express, which serves both /api and the built React client.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
USER node
EXPOSE 5000
CMD ["node", "server/index.js"]

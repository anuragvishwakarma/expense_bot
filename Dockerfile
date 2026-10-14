# Two stages: build with the full dev toolchain, run with production dependencies only.
# The base image is pinned by digest so a rebuild cannot silently pick up a different image.
# To refresh it (for Node security updates), look up the current digest of node:22-alpine and
# replace both lines below together.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Run as the unprivileged user the node image ships with; the bot writes nothing to disk
USER node
# Only used when PORT is set (health endpoint)
EXPOSE 3000
# node directly, not npm start, so SIGTERM reaches the bot on redeploys
CMD ["node", "dist/index.js"]

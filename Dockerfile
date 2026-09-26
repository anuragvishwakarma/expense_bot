# Dockerfile
FROM node:22-alpine

# Cache bust: change this value to force rebuild
ARG CACHE_BUST=2
RUN echo "Cache bust: $CACHE_BUST"

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (includes TypeScript)
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (not needed for bot but good practice)
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
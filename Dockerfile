# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript (if needed for production)
RUN npm run build

# Expose port (not needed for bot but good practice)
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
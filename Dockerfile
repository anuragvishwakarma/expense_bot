# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install TypeScript globally FIRST (before npm ci cache layer)
RUN npm i -g typescript

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (not needed for bot but good practice)
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
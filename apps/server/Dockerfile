# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/

# Install dependencies
RUN npm install

# Copy source code
COPY apps/server ./apps/server
COPY tsconfig.base.json ./

# Build the server
WORKDIR /app/apps/server
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production deps only
COPY apps/server/package*.json ./
RUN npm install --omit=dev

# Copy built files
COPY --from=builder /app/apps/server/dist ./dist

# Expose ports
EXPOSE 4000 1234

CMD ["node", "dist/index.js"]

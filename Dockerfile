# ==========================================
# Phase 1: Install Dev Dependencies & Build Frontend
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies for Vite)
RUN npm ci

# Copy full application codebase
COPY . .

# Compile Vite production frontend assets
RUN npm run build

# ==========================================
# Phase 2: Production Server Deployment
# ==========================================
FROM node:20-alpine
WORKDIR /app

# Setup production environment variables
ENV NODE_ENV=production
ENV PORT=5173

# Copy dependency manifests
COPY package*.json ./

# Install only production dependencies (Express, Socket.io)
RUN npm ci --omit=dev

# Copy statically built frontend assets and backend source code from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.js ./server.js

# Expose production port
EXPOSE 5173

# Run the backend production server
CMD ["node", "server.js"]

# PHASE 1: Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Accept build argument for API URL (set via Coolify Build Variables)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code (includes .env.production as fallback)
COPY . .

# Build for production
# Priority: ARG/ENV > .env.production > .env
RUN npm run build

# PHASE 2: Production stage with nginx
FROM nginx:1.25-alpine AS runtime

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/  || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

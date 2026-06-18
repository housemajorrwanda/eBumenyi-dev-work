# Use an official Node.js Alpine runtime
FROM node:20-alpine AS base

# Add necessary tools for Prisma and OpenSSL
RUN apk add --no-cache openssl bash

# Install pnpm globally
RUN npm install -g pnpm

# Set the working directory
WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Copy the rest of the app
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build app
RUN pnpm run build

# Add entrypoint script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 9000

# Run via entrypoint
CMD ["/app/start.sh"]
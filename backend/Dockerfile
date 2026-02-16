# Dockerfile for the backend service

# Use the official Node.js image as the base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json   
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# Expose the port the app will run on
EXPOSE 8000

# Run with tsx for TypeScript support (dev mode)
# Generate Prisma client before starting the server (needed because volume mount overwrites it)
CMD ["sh", "-c", "npx prisma generate && npx tsx watch src/server.ts"]
# Dockerfile for the frontend service

# Use Node.js Alpine image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json   
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app will run on
EXPOSE 5173

# Sync node_modules with package.json on every start (needed when compose uses a
# persistent /app/node_modules volume — otherwise new deps like gifenc stay missing).
CMD ["sh", "-c", "npm install && node scripts/ci-install-native-bindings.cjs && npm run dev"]
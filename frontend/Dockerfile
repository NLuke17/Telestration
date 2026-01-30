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

# Start the application in development mode with Vite
CMD ["npm", "run", "dev"]
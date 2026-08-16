FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY . .

# Expose port (Render sets PORT dynamically, but this is a fallback)
EXPOSE 3000

# Start the server
CMD ["npm", "start"]

FROM node:lts-alpine

WORKDIR /app

# Copy package files
COPY package.json .
COPY yarn.lock .

# Install dependencies
RUN yarn install --frozen-lockfile --production

# Copy application code
COPY index.js .

# Start the application
CMD ["node", "index.js"]

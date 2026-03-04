# Dev-oriented Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install deps first (leverages Docker layer caching)
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy source
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

FROM node:20-bookworm-slim

WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ gcc libc6-dev && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 10000
ENV PORT=10000
ENV NODE_ENV=production

CMD ["npm", "run", "server"]

FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install native compilation toolchain for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ gcc libc6-dev && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
RUN npx tsc server/index.ts server/db.ts --outDir dist-server --module ESNext --moduleResolution bundler --target ES2022 --skipLibCheck

# Production image
FROM node:20-bookworm-slim

WORKDIR /app

# SQLite runtime dependencies
RUN apt-get update && apt-get install -y sqlite3 libsqlite3-dev && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=10000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./server

# Rebuild native addons inside runtime environment to prevent SIGSEGV
RUN npm rebuild better-sqlite3

EXPOSE 10000

CMD ["node", "server/index.js"]

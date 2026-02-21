# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./

# System dependencies for thumbnail worker (ffmpeg, ghostscript, graphicsmagick)
RUN apk add --no-cache ffmpeg ghostscript graphicsmagick

RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle

EXPOSE 8000
CMD ["npm", "start"]

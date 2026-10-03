FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY packages/shared packages/shared
COPY apps/web apps/web

WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Railway injects PORT; fall back to 3000 for local runs
ENV PORT=${PORT:-3000}

# Pre-build static assets (Next.js 16 SSG)
RUN npm run build

EXPOSE ${PORT}

CMD ["npm", "start"]

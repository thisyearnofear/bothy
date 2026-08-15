FROM node:22-bookworm-slim

WORKDIR /app
ENV HUSKY=0

COPY package.json package-lock.json ./
COPY apps/agent/package.json apps/agent/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/agent apps/agent

WORKDIR /app/apps/agent
EXPOSE 8787

CMD ["npm", "run", "start"]

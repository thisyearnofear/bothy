FROM node:22-bookworm-slim
WORKDIR /app
COPY deploy/idp/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY deploy/idp/server.mjs ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 9099
CMD ["node", "server.mjs"]

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data COOKIE_SECURE=1 TRUST_PROXY=1
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]

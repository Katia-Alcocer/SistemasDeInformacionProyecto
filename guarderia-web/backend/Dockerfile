FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund && mkdir -p /app/private_uploads && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]

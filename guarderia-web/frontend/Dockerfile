FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 5173
CMD ["npm", "run", "dev"]

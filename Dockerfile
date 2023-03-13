FROM cgr.dev/chainguard/node:18

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production --omit=dev

COPY . .

CMD ["index.js"]

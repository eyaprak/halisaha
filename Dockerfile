# syntax=docker/dockerfile:1
FROM node:24-alpine AS tam
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM tam AS derleme
COPY . .
RUN --mount=type=cache,target=/root/.cache/next-swc npm run build && rm -rf .next/cache

# Çalışma zamanı bağımlılıkları: az önce dolan npm önbelleğinden, ağa çıkmadan kurulur.
FROM tam AS bagimliliklar
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --prefer-offline

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=bagimliliklar /app/node_modules ./node_modules
COPY --from=derleme /app/.next ./.next
COPY package.json next.config.mjs server.mjs ./
# Yetkisiz kullanıcı: uygulama konteynerde root olarak çalışmaz.
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]

# syntax=docker/dockerfile:1

# ---- builder: install deps and produce the static build ----
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Then build the app. VITE_API_URL is left empty so the browser calls the
# same origin; nginx proxies /api to the backend (see nginx.conf).
COPY . .
RUN npm run build


# ---- runtime: serve the static build with nginx ----
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# syntax=docker/dockerfile:1
#
# Build context is the repository root (see ../../docker-compose.*.yml).
#
# Scope: only the Expo **web** target is containerized. Native iOS/Android
# builds need Xcode/simulators or EAS Build, which can't run inside a Linux
# container — for those, keep using the host workflow in the root README's
# Frontend section (`npm start` + Expo Go / a simulator).
#
# Targets:
#   dev      - Expo dev server (`expo start --web`) against bind-mounted source
#   builder  - produces the static web export (internal, not run directly)
#   prod     - Nginx serving that static export

FROM node:20-alpine AS base
WORKDIR /app
COPY mobile/package.json mobile/package-lock.json ./


FROM base AS dev
RUN npm ci
# node:alpine already ships an unprivileged "node" user (uid/gid 1000) — reuse it.
RUN chown -R node:node /app
COPY --chown=node:node mobile/ .
USER node
# Non-interactive: avoids Expo CLI prompts hanging a container with no TTY.
ENV CI=1
EXPOSE 8081
CMD ["npx", "expo", "start", "--web"]


FROM base AS builder
RUN npm ci
COPY mobile/ .
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL} \
    CI=1
RUN npx expo export --platform web --output-dir dist


FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
COPY infra/docker/mobile/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080

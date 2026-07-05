# syntax=docker/dockerfile:1
#
# Build context is the repository root (see ../../docker-compose.*.yml), so every
# COPY below is rooted at the repo, not this folder.
#
# Targets:
#   vendor      - installs composer dependencies (internal, not run directly)
#   dev         - single container, runs `php artisan serve` against a bind-mounted
#                 copy of backend/ for live reload during local development
#   app         - production PHP-FPM process, immutable code baked into the image
#   webserver   - production Nginx, serves /public and proxies PHP requests to `app`

FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --no-interaction
COPY backend/ .
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative


FROM php:8.4-fpm-alpine AS php-base
# libpq: pgsql runtime lib kept in the final image; postgresql-dev + build tools
# are only installed transiently to compile the extension, then removed.
RUN apk add --no-cache libpq \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS postgresql-dev \
    && docker-php-ext-install pdo pdo_pgsql bcmath opcache \
    && apk del .build-deps
WORKDIR /var/www/html


# ---------------------------------------------------------------------------
# Development: source is bind-mounted by docker-compose.dev.yml, this image
# only provides the runtime + tooling. The app itself runs as a non-root user;
# the entrypoint briefly starts as root only to fix ownership of the named
# `vendor` volume (Docker creates it root-owned, since it doesn't exist in the
# image), then drops to `app` via su-exec before running anything from the app.
# ---------------------------------------------------------------------------
FROM php-base AS dev
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS linux-headers \
    && pecl install xdebug \
    && docker-php-ext-enable xdebug \
    && apk del .build-deps \
    && apk add --no-cache su-exec
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
RUN addgroup -g 1000 app && adduser -G app -u 1000 -D -h /var/www/html app \
    && chown app:app /var/www/html
COPY infra/docker/backend/entrypoint.dev.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["entrypoint.sh"]
# --no-reload: `artisan serve` normally spawns its request-handling child
# process with a stripped-down environment (only a small allowlist of vars
# survives) so it can restart on .env changes. That silently drops the
# DB_HOST/DB_PASSWORD/etc. values injected via docker-compose `environment:`,
# causing the child to fall back to whatever is in backend/.env instead
# (e.g. DB_HOST=127.0.0.1, which doesn't resolve to the `db` service).
# --no-reload passes the real container environment through untouched.
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000", "--no-reload"]


# ---------------------------------------------------------------------------
# Production PHP-FPM: immutable app code, no dev tooling, no source mounts.
# Runs entirely as the unprivileged `www-data` user (master + workers) — the
# pool already runs workers as www-data by default, so this just removes the
# root-owned master process too, per Docker's own Laravel deployment guide.
# ---------------------------------------------------------------------------
FROM php-base AS app
COPY infra/docker/backend/php.prod.ini /usr/local/etc/php/conf.d/99-security.ini
COPY --from=vendor --chown=www-data:www-data /app ./
RUN chown -R www-data:www-data storage bootstrap/cache
USER www-data
EXPOSE 9000
CMD ["php-fpm"]


# ---------------------------------------------------------------------------
# Production Nginx: only ever handles /public + proxies *.php to app:9000.
# Uses the "unprivileged" image so the master process itself is non-root.
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS webserver
COPY --from=vendor /app/public /var/www/html/public
COPY infra/docker/backend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080

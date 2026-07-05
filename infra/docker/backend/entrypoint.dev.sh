#!/bin/sh
# Dev-only convenience entrypoint. Runs as root very briefly to fix ownership
# of the named `vendor` volume (Docker creates it root-owned on first run,
# since it doesn't exist in the image), then drops to the unprivileged `app`
# user for everything else — composer install, migrations, and the app itself.
set -e

chown app:app vendor

if [ ! -f vendor/autoload.php ]; then
    echo "[entrypoint] Installing composer dependencies..."
    su-exec app composer install --no-interaction --prefer-dist
fi

echo "[entrypoint] Waiting for database at ${DB_HOST:-db}:${DB_PORT:-5432}..."
until su-exec app php -r "new PDO('pgsql:host=${DB_HOST:-db};port=${DB_PORT:-5432};dbname=${DB_DATABASE}', '${DB_USERNAME}', '${DB_PASSWORD}');" >/dev/null 2>&1; do
    sleep 1
done

echo "[entrypoint] Running migrations..."
su-exec app php artisan migrate --force

exec su-exec app "$@"

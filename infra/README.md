# Infra

Docker setup for both the Laravel API (`backend/`) and the Expo app
(`mobile/`).

```
infra/
├── docker/
│   ├── backend/
│   │   ├── Dockerfile           # multi-stage: dev, app (php-fpm), webserver (nginx)
│   │   ├── nginx.conf           # prod webserver config
│   │   ├── php.prod.ini         # prod PHP hardening (opcache, expose_php off, ...)
│   │   └── entrypoint.dev.sh    # dev-only: composer install + migrate on boot
│   └── mobile/
│       ├── Dockerfile           # multi-stage: dev (Expo server), builder, prod (nginx)
│       └── nginx.conf           # prod static-file server config
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── .env.dev.example
└── .env.prod.example
```

**Scope note on `mobile`:** only the Expo **web** target is containerized —
dev runs the Expo web dev server, prod serves a static `expo export --platform
web` build via Nginx. Docker can't run iOS Simulator or an Android
emulator/KVM, and can't produce App Store/Play Store binaries — a container is
just a Linux process, not macOS+Xcode or a virtualized Android device. For
iOS/Android (simulator, physical device via Expo Go, or a real build), keep
using the host workflow in the [root README](../README.md#frontend)
(`npm start`) or EAS Build. This is a deliberate scope decision, not an
oversight.

## Development

`app` runs `php artisan serve` against your live `backend/` source
(bind-mounted, so edits reload immediately), alongside Postgres. `mobile` runs
the Expo web dev server the same way against `mobile/` — for iOS/Android, see
the scope note above instead.

```bash
cp infra/.env.dev.example infra/.env
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up --build -d
```

- API: `http://localhost:8000/api`, matching the [root README](../README.md#backend)'s non-Docker instructions. Migrations run automatically on container start.
- Mobile web preview: `http://localhost:8081`.

To run tests or artisan commands inside the backend container:

```bash
docker compose -f infra/docker-compose.dev.yml exec app php artisan test
docker compose -f infra/docker-compose.dev.yml exec app php artisan migrate:fresh --seed
```

## Production

Immutable images (no bind mounts, no dev tooling): Nginx in front of PHP-FPM
for the API, Postgres, and a static Nginx build of the Expo web export. Only
the two Nginx ports are published — `app` and `db` are reachable exclusively
over the internal Docker network.

```bash
cp infra/.env.prod.example infra/.env
# fill in infra/.env: APP_KEY, APP_URL, DB_PASSWORD, MOBILE_API_URL, ...
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build

# first deploy only (or after new migrations):
docker compose -f infra/docker-compose.prod.yml exec app php artisan migrate --force
```

Put a real TLS terminator (managed load balancer, Caddy, etc.) in front of the
published ports — this setup deliberately stops at plain HTTP between
containers/host, since TLS certificates are environment-specific.

## Security choices made here

These are deliberate, not exhaustive — enough to be a sane default without
turning this into a hardening exercise:

- **Non-root processes.** Dev and Nginx run as an unprivileged user by
  construction (`nginxinc/nginx-unprivileged`); PHP-FPM workers run as
  `www-data` (the master stays root only to manage the socket, which is the
  official image's own default).
- **Multi-stage builds.** The production image never contains Composer,
  dev dependencies, or the Nginx image's config tools — only what's needed to
  run.
- **No secrets baked into images.** `.env` files are git-ignored and never
  `COPY`'d in (see `.dockerignore`); all configuration is injected at
  container start via `environment:`, and required secrets (`APP_KEY`,
  `DB_PASSWORD`, ...) fail fast with `${VAR:?message}` if missing.
- **Least exposure.** In prod, only `webserver` and `mobile`'s ports are
  published to the host; `app` and `db` are only reachable from other
  containers on the compose network.
- **Read-only containers in prod.** `app`, `webserver`, and `mobile` all run
  with `read_only: true` plus narrowly-scoped `tmpfs`/volumes for the few
  paths that must be writable (`storage/`, `bootstrap/cache/`, Nginx's
  runtime dirs) — a compromised process can't modify the application code
  it's running.
- **`no-new-privileges`** on every service, blocking privilege escalation via
  setuid binaries.
- **Pinned base image versions** (`postgres:16-alpine`, `php:8.4-fpm-alpine`,
  `nginx:1.27-alpine`) instead of `latest`, so builds are reproducible and
  upgrades are a deliberate choice.
- **PHP hardened for prod** (`php.prod.ini`): `expose_php off`,
  `display_errors off` (errors still go to logs, never to the client).

Not included, and worth doing before a real production launch: a container
image vulnerability scanner in CI, secrets manager integration (rather than
a `.env` file on the host), and a WAF/rate-limiting layer in front of Nginx.

## Note: PHP version

`backend/composer.json` declares `"php": "^8.3"`, but `backend/composer.lock`
has actually been resolved against Symfony packages (pulled in by
`laravel/framework` v13.17) that require PHP **>=8.4.1** — installing from the
lock file on PHP 8.3 fails outright. These images use `php:8.4-fpm-alpine` to
match what's actually locked. Worth reconciling upstream (either bump
`composer.json` to `^8.4` and re-lock, or re-lock against 8.3-compatible
package versions) so the declared and actual requirements agree.

# Infra

Docker setup for the Laravel API (`backend/`) and the Expo app (`mobile/`).


## Layout

```
infra/
├── docker/
│   ├── backend/   # Dockerfile (dev/app/webserver), nginx.conf, php.prod.ini, entrypoint.dev.sh
│   └── mobile/    # Dockerfile (dev/builder/prod), nginx.conf
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── .env.dev.example
└── .env.prod.example
```

## Development

```bash
cp infra/.env.dev.example infra/.env
docker compose -f infra/docker-compose.dev.yml --env-file infra/.env up --build -d
```

Bind-mounted source with live reload, plus Postgres. Migrations run automatically.

| Service    | URL                             |
| ---------- | -------------------------------- |
| API        | `http://localhost:8000/api/v1`  |
| Mobile web | `http://localhost:8081`         |

Run tests or artisan commands inside the container:

```bash
docker compose -f infra/docker-compose.dev.yml exec app php artisan test
docker compose -f infra/docker-compose.dev.yml exec app php artisan migrate:fresh --seed
```

<details>
<summary>Note on <code>mobile/.env</code> and physical-device LAN IPs</summary>

`mobile/.env` is visible inside the bind-mounted `mobile` container, but it's harmless:
Expo's dotenv loader never overrides a variable already set in the environment (here,
`EXPO_PUBLIC_API_URL` via `MOBILE_API_URL`). It's also git-ignored, so never committed.

</details>

## Production

Immutable images, no bind mounts: Nginx + PHP-FPM for the API, Postgres, and a static
Nginx build of the Expo web export. Only the two Nginx ports are published.

```bash
cp infra/.env.prod.example infra/.env
# fill in APP_KEY, APP_URL, DB_PASSWORD, MOBILE_API_URL, ...
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build

# first deploy only (or after new migrations):
docker compose -f infra/docker-compose.prod.yml exec app php artisan migrate --force
```

Put a real TLS terminator (load balancer, Caddy, etc.) in front — this stops at plain
HTTP between containers/host, since certs are environment-specific.
# Load Testing

Finds how many concurrent users the API can handle, using [k6](https://k6.io/).
`attendance.js` ramps virtual users hitting `GET /api/v1/classes/{id}/attendees`
in stages (50 → 150 → 300 → 500 over 4 minutes) and reports latency/error rate
per stage — the stage where latency spikes is the concurrency ceiling.

## Setup

```powershell
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build
docker compose -f infra/docker-compose.prod.yml exec app php artisan migrate:fresh --force
docker compose -f infra/docker-compose.prod.yml exec app php artisan db:seed --class=DemoAttendanceSeeder --force
```

k6 looks like a single IP, which the default rate limit (60 req/min) would
throttle almost immediately. Raise it in `infra/.env` before testing:

```
RATE_LIMIT_MAX_ATTEMPTS=1000000
RATE_LIMIT_DECAY_SECONDS=60
```

```powershell
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --force-recreate app
```

**Revert those two lines once you're done** — never ship a raised rate limit.

## Run it

```powershell
k6 run --env CLASS_ID=1 loadtest\attendance.js
```

While it runs, watch resource usage in another terminal:

```powershell
docker stats
docker compose -f infra/docker-compose.prod.yml exec app sh -c "ps -o pid,rss,args | grep 'pool www'"
```

Run the `ps` command a few times during the 300-500 VU stage to see
per-worker RAM under real load.

## Reading the results

| Symptom | Likely cause |
|---|---|
| Near-100% `http_req_failed` early on | Rate limiter still on default (see Setup) |
| Latency (p95) climbs sharply at a given VU count | That VU count ≈ your concurrency ceiling |
| `502`/`504` errors | PHP-FPM ran out of workers (`pm.max_children`) or timed out |
| High RSS per worker | Size `pm.max_children` as `usable_RAM / RAM_per_worker` |

## What we found on this machine (12 host CPU cores)

1. **Rate limiter at default (60/min):** 99.2% `http_req_failed`, matching
   `60 req/min × elapsed minutes` almost exactly — not a capacity issue.
   Fixed by raising `RATE_LIMIT_MAX_ATTEMPTS` and wiring it through
   `infra/docker-compose.prod.yml` (it wasn't reaching the container before).

2. **Rate limiter raised, `pm.max_children = 5` (image default):** 0% errors,
   but throughput capped and latency climbed under load — requests queueing
   behind a too-small worker pool.

3. **`pm.max_children = 20`** (`infra/docker/backend/zz-www-tuning.conf`):
   more throughput, lower latency.

| Metric | `pm.max_children = 5` | `pm.max_children = 20` |
|---|---|---|
| Throughput | ~117 req/s | ~144 req/s (+23%) |
| p95 latency | ~2.95s | ~2.28s |
| RAM per worker | ~30-31 MB | ~30-31 MB (unchanged) |
| Total app container RAM | ~38 MB | ~71 MB |
| Host CPU (app + db) | ~5.3 of 12 cores | ~8.8 of 12 cores |

**Takeaway:** RAM per worker is constant (~31 MB) regardless of concurrency —
it's a per-process cost. What limits worker count is container memory
(`RAM ÷ 31MB`) and, as shown here, CPU: quadrupling workers only grew
throughput 23% because CPU usage nearly doubled, with Postgres CPU scaling
right along with worker count. **The next bottleneck after FPM workers is
database query cost, not RAM** — going much past 20 `pm.max_children` on a
12-core host would likely hit CPU saturation first.

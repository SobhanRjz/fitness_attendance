# Fitness Attendance

A Laravel REST API + React Native screen for gyms to manage class attendance: list
attendees, toggle one attendee, or toggle the whole class — safely, even with multiple
staff editing the same class at once.

> **Status:** Backend and React Native attendance roster are implemented, tested, and
> connected. Additional work (Docker, CI, API versioning, `attendance_events` audit
> table, and more) lives on the `develop` branch.

## Contents

- [Overview](#overview)
- [Usage](#usage)
- [Assumptions](#assumptions)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Rate Limiting](#rate-limiting)
- [Design Decisions](#design-decisions)
- [Frontend Notes](#frontend-notes)



## Overview


|                    |                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Backend**        | Laravel API — list a class's attendees, toggle one, or toggle all                                                           |
| **Frontend**       | React Native (Expo) screen consuming that API                                                                               |
| **Core challenge** | 1000+ classes/day, 20+ attendees each, concurrent toggles by multiple staff on the same class                               |
| **Core solution**  | Optimistic locking (`version` column) — concurrent writes fail fast with a `409` instead of silently overwriting each other |




## Usage



### Prerequisites

- PHP 8.4+, Composer
- Node.js 18+, npm
- Node.js 20+ if you want to run the mobile app on a device/simulator (Expo)



### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate

# update DB_* in .env, then create the database, then:
php artisan migrate
php artisan serve
```

The API is now available at `http://127.0.0.1:8000/api/v1`.

Optional — seed a realistic dataset (3 gyms → 30 members each → 10 classes each → 20
attendees per class):

```bash
php artisan db:seed
```

Run the backend tests:

```bash
php artisan test
```



### Frontend

```bash
cd mobile
npm install
cp .env.example .env   # only needed for a physical device, see below
npm start
```

By default the app talks to `http://localhost:8000/api/v1` (iOS simulator/web) or
`http://10.0.2.2:8000/api/v1` (Android emulator) — both reach the backend running on your
machine via `php artisan serve`. For a **physical device**, set `EXPO_PUBLIC_API_URL` in
`mobile/.env` to your machine's LAN IP and start the backend with:

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

`mobile/.env` is git-ignored, so a LAN IP set there is local to your machine only — it's
never committed and won't affect anyone else cloning the repo. It's also ignored when
running via Docker: `docker-compose.dev.yml` injects `EXPO_PUBLIC_API_URL` as a container
environment variable, which Expo's dotenv loader never overrides with a `.env` file value
(see [infra/README.md](infra/README.md)).

Run the frontend tests:

```bash
npm test
```



## Assumptions

Where the brief was silent:

1. **Database** — PostgreSQL in dev and production; concurrency relies on row-level locking during atomic `UPDATE ... WHERE version = ?`.
2. **React Native (Expo)** — mobile app is built with Expo.
3. **REST API** — no WebSockets; attendance sync uses HTTP requests only.
4. **Concurrency** — conflicting toggles return `409`, not silent overwrites ("Mark all" is the exception; see [Design Decisions](#design-decisions)).
5. **No auth** — per the frontend spec; Form Requests leave a hook for future access control.
6. **Multi-tenancy** — `Gym` exists in the schema but isn't enforced without authenticated staff.
7. **`marked_at`** — latest change only, not a full audit trail.



## Project Structure

```
backend/
├── app/
│   ├── Enums/            # AttendanceStatus
│   ├── Exceptions/       # AttendanceConflictException, AttendanceRemovedException
│   ├── Http/
│   │   ├── Controllers/Api/   # Thin controllers (HTTP only)
│   │   ├── Requests/          # Validation
│   │   └── Resources/         # Response shaping
│   ├── Models/           # Gym, Member, FitnessClass, Attendance
│   └── Services/         # AttendanceService (business logic)
└── tests/
    ├── Feature/Attendance/   # Endpoint + data-integrity tests
    └── Unit/Services/        # Business logic tests

mobile/src/
├── config/env.ts                       # Resolves the backend base URL
├── theme/colors.ts                     # Design tokens
└── features/attendance/
    ├── api/attendanceApi.ts            # fetch calls + typed errors
    ├── hooks/useAttendance.ts          # Load state, optimistic toggle + rollback, conflict reconciliation, mark-all
    ├── utils/avatar.ts, membership.ts  # Deterministic display-only placeholders (see Assumptions)
    ├── utils/formatSyncNotice.ts       # Copy for "another staff member changed this row" notices
    ├── components/                     # RosterTopBar, ClassSummaryCard, AttendeeRow, AnimatedSyncNotice, RosterSkeleton, RosterErrorState, ...
    └── screens/AttendanceScreen.tsx    # Composes everything based on the hook's status
```

Backend request flow: **Controller → Form Request → Service → Model → Resource** — each
layer has one job. Frontend follows the same principle: components stay presentational,
`useAttendance` owns state, `attendanceApi` owns the network calls.

## API Documentation

All endpoints are versioned via URI prefix — `/api/v1/...` — so a future breaking change
can ship as `/api/v2/...` without affecting clients still on v1.

### `GET /v1/classes/{class}/attendees`

List all attendees for a class.

```json
{
  "data": [
    {
      "id": 1,
      "member": { "id": 10, "name": "Jane Doe" },
      "status": "not_attended",
      "version": 1,
      "marked_at": null,
      "updated_at": "2026-07-05T10:15:00+00:00"
    }
  ]
}
```

`updated_at` is the row's last write time regardless of status. It's used by the client to
timestamp a conflict notice (below) when `marked_at` is `null` — e.g. another staff member
just marked someone absent, which clears `marked_at` but still bumps `updated_at`.

### `PATCH /v1/classes/{class}/attendees/{member}`

Mark one attendee. Body:

```json
{ "status": "attended", "version": 1 }
```

- `status`: `attended` or `not_attended`, required.
- `version`: last-read version, required — used to detect conflicts.


| Status | Meaning                                                                                  |
| ------ | ---------------------------------------------------------------------------------------- |
| `200`  | Updated. Returns the attendee with `version` incremented.                                |
| `409`  | Someone else updated this row first. Response includes fresh `data` — refresh and retry. |
| `404`  | Member not enrolled in this class, or their enrollment was removed.                      |
| `422`  | `status` missing or invalid.                                                             |




### `PATCH /v1/classes/{class}/attendees`

Mark every attendee in the class. Body:

```json
{ "status": "attended" }
```

No `version` needed — this is an intentional full overwrite, done in one query.
Attendees already in the target status are left untouched (their `marked_at`/`version`
don't change), so an existing check-in time is never overwritten.

```json
{ "updated": 23, "status": "attended" }
```



## Rate Limiting

Every `/api/v1/...` route is protected by a fixed-window rate limiter (per client IP):
`60` requests per rolling `60`-second window by default, configurable via
`RATE_LIMIT_MAX_ATTEMPTS`/`RATE_LIMIT_DECAY_SECONDS` in `.env` (see
`backend/config/rate_limiting.php`).

- Time is sliced into fixed, non-overlapping windows (e.g. `:00`–`:59`). Each request in a
  window increments a counter in cache; once the counter exceeds the limit, further
  requests get `429 Too Many Requests` until the window rolls over and the counter resets
  to zero.
- Every response carries `X-RateLimit-Limit`/`X-RateLimit-Remaining`; a `429` also carries
  `Retry-After` (seconds until the next window).
- Implementation: `App\Services\RateLimiting\FixedWindowRateLimiter` (the algorithm, via
  `Cache::add` + `Cache::increment` for an atomic per-window counter) and
  `App\Http\Middleware\FixedWindowRateLimit` (the HTTP wiring, aliased as `throttle.fixed`).
- Trade-off (inherent to fixed-window limiting, chosen for its O(1) storage and simplicity
  over a sliding window/log): a client can burst up to twice the limit if the burst
  straddles a window boundary.

## Design Decisions

Built for **high volume** (1000+ classes/day, 20+ attendees) and **concurrent staff
edits**.

| Decision | Why |
| --- | --- |
| **`version` column (optimistic locking)** | Atomic `UPDATE ... WHERE version = ?`; stale writes return `409` with fresh data. |
| **Integer `version`, not `updated_at`** | Timestamps can collide within the same second. |
| **"Mark all" skips version checks** | Deliberate bulk overwrite; still bumps versions so later stale single-row updates fail. |
| **Bulk update in one SQL statement** | One `UPDATE` per class, not 20+ row-by-row saves. |
| **Bulk skips no-op rows** | Rows already in the target status keep their `marked_at` and `version`. |
| **Eager-load `member` on list** | Avoids N+1 queries. |
| **Unique index** `(fitness_class_id, member_id)` | One row per member per class; fast roster lookups. |
| **Single toggle = update only** | Unenrolled members get `404`, not a silent insert. |
| **`AttendanceStatus` enum** | Room for future states (`excused`, `no_show`) without a breaking migration. |
| **Central conflict exceptions** | `409`/`404` responses include the current row so the client can resync. |
| **Surface conflicts to staff** | Per-row notice on `409` instead of silently swapping the value. |

## Frontend Notes

Roster, toggles, counts, and "mark all" use the live API (`GET`/`PATCH
/v1/classes/{class}/attendees`). Class header, badges, and avatar colors are static or
client-derived — see [Assumptions](#assumptions).

`useAttendance` handles loading/errors, optimistic toggles with rollback, `409`
reconciliation, and mark-all (all tested).

On `409`, the row resyncs and a per-row notice shows who won the race, then
auto-dismisses. After successful writes, a background check flags other changed rows
via a banner; staff pull-to-refresh to load them.
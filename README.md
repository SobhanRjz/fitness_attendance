# Fitness Attendance

A Laravel REST API + React Native screen for gyms to manage class attendance: list
attendees, toggle one attendee, or toggle the whole class — safely, even with multiple
staff editing the same class at once.

> **Status:** Backend and React Native attendance roster are implemented, tested, and
> connected. Additional work (Docker, API versioning, rate limiting, CI, 
> load testing and more) lives on the `develop` branch.

**Built for scale:** 1000+ classes/day, 20+ attendees each, concurrent writes from
multiple staff — see [Design Decisions](#design-decisions).

## Contents

- [Overview](#overview)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Design Decisions](#design-decisions)
- [Project Structure](#project-structure)
- [Frontend Notes](#frontend-notes)
- [Assumptions](#assumptions)

## Overview

| | |
| --- | --- |
| **Backend** | Laravel API — list a class's attendees, toggle one, or toggle all |
| **Frontend** | React Native (Expo) screen consuming that API |
| **Core challenge** | Concurrent toggles by multiple staff on the same class, at high volume |
| **Core solution** | Optimistic locking (`version` column) — concurrent writes fail fast with `409` instead of silently overwriting each other |

## Usage

**Prerequisites:** PHP 8.4+, Composer, Node.js 18+ (20+ for running the mobile app on a
device/simulator).

**1. Backend**

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate

# set DB_* in .env to a database you've created, then:
php artisan migrate
php artisan serve
```

The API is now running at `http://127.0.0.1:8000/api`.

<details>
<summary>Optional: seed sample data & run tests</summary>

```bash
# 3 gyms → 30 members each → 10 classes each → 20 attendees per class
php artisan db:seed

php artisan test
```

</details>

**2. Frontend**

```bash
cd mobile
npm install
npm start
```

By default the app talks to the backend at `http://localhost:8000/api` (iOS
simulator/web) or `http://10.0.2.2:8000/api` (Android emulator) — no extra config
needed.

<details>
<summary>Testing on a physical device</summary>

Set `EXPO_PUBLIC_API_URL` in a `mobile/.env` (copy from `.env.example`) to your machine's
LAN IP, then start the backend so it's reachable from the network:

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

`mobile/.env` is git-ignored — this stays local to your machine.

</details>

<details>
<summary>Running tests</summary>

```bash
npm test
```

</details>

## API Documentation

### `GET /api/classes/{class}/attendees`

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

### `PATCH /api/classes/{class}/attendees/{member}`

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

### `PATCH /api/classes/{class}/attendees`

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

## Frontend Notes

Roster, toggles, counts, and "mark all" use the live API (`GET`/`PATCH
/classes/{class}/attendees`). Class header, badges, and avatar colors are static or
client-derived — see [Assumptions](#assumptions).

`useAttendance` handles loading/errors, optimistic toggles with rollback, `409`
reconciliation, and mark-all (all tested).

On `409`, the row resyncs and a per-row notice shows who won the race, then
auto-dismisses. After successful writes, a background check flags other changed rows
via a banner; staff pull-to-refresh to load them.

## Assumptions

Where the brief was silent:

1. **Database** — PostgreSQL in dev and production; concurrency relies on row-level locking during atomic `UPDATE ... WHERE version = ?`.
2. **React Native (Expo)** — mobile app is built with Expo.
3. **REST API** — no WebSockets; attendance sync uses HTTP requests only.
4. **Concurrency** — conflicting toggles return `409`, not silent overwrites ("Mark all" is the exception; see [Design Decisions](#design-decisions)).
5. **No auth** — per the frontend spec; Form Requests leave a hook for future access control.
6. **Multi-tenancy** — `Gym` exists in the schema but isn't enforced without authenticated staff.
7. **`marked_at`** — latest change only, not a full audit trail.

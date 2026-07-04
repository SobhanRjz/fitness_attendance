# Fitness Attendance

A Laravel REST API + React Native screen for gyms to manage class attendance: list
attendees, toggle one attendee, or toggle the whole class — safely, even with multiple
staff editing the same class at once.

> **Status:** Backend is fully implemented and tested. The React Native attendance
> roster screen is implemented and connected to it.

## Contents

- [Overview](#overview)
- [Usage](#usage)
- [Assumptions](#assumptions)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
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

- PHP 8.3+, Composer
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

The API is now available at `http://127.0.0.1:8000/api`.

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

By default the app talks to `http://localhost:8000/api` (iOS simulator/web) or
`http://10.0.2.2:8000/api` (Android emulator) — both reach the backend running on your
machine via `php artisan serve`. For a **physical device**, set `EXPO_PUBLIC_API_URL` in
`mobile/.env` to your machine's LAN IP and start the backend with:

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

Run the frontend tests:

```bash
npm test
```



## Assumptions

Reasonable assumptions made where the brief didn't specify:

1. **Lost updates are unacceptable; a** `409` **is better than silent data loss.** The
  assignment explicitly calls out concurrent toggles, so this was treated as a hard
   requirement, not an edge case. "Mark all" is the one intentional exception (see
   [Design Decisions](#design-decisions)).

2. **No auth layer** — the frontend spec says it's not required. `authorize()` in both
  Form Requests returns `true` with a note on where access control would go.
  
3. **Multi-tenancy exists in the schema** (`Gym` owns `Member`/`FitnessClass`) but isn't
  enforced at the API layer, since there's no authenticated staff user yet.
4. `marked_at` reflects only the latest change (set when marked attended, cleared
  when marked not-attended) — not a full history log. A real audit trail (who changed
   what, when) would be a separate `attendance_events` table.
5. **Members must already be enrolled** (have an attendance row) to be marked — the
  update endpoint never creates one. Enrollment/booking is a separate concern.
6. **PostgreSQL/MySQL are the intended production database.** SQLite is used for local
  dev/tests for convenience only; the app's concurrency guarantees rely on real
   row-level locking during the atomic `UPDATE ... WHERE version = ?`, which SQLite's
   single-writer model doesn't meaningfully provide under concurrent load.
7. **Mobile targets a single hardcoded class** (`DEMO_CLASS_ID` in
  `mobile/src/features/attendance/constants.ts`) — there's no "list classes" screen in
   the provided design, only one roster, so a class picker was treated as out of scope.
8. **Class header content (name, time, duration, trainer) is static placeholder text**,
  configured alongside `DEMO_CLASS_ID`. No endpoint returns this today — the closest is
   `FitnessClass.name`/`start_time`, which aren't exposed via any API response — and
   `trainer`/`duration` don't exist in the schema at all. Extending the backend for this
   was scoped out in favor of keeping it untouched; the roster/counts/toggles below the
   header are all live.
9. **Membership badges** ("Unlimited" / "10 Pack" / "Drop-in") and **avatar colors**
  are derived deterministically from `member.id`/`member.name` on the client
   (`utils/membership.ts`, `utils/avatar.ts`) purely to match the design — there's no
   membership-plan field in the schema, so these are cosmetic, not real data.



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



### `GET /classes/{class}/attendees`

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

### `PATCH /classes/{class}/attendees/{member}`

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




### `PATCH /classes/{class}/attendees`

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

The assignment calls out two constraints: **1000+ classes/day, 20+ attendees each**,
and **simultaneous toggles by multiple staff**. Every decision below exists to serve
one of those.


| Decision                                                           | Why                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Optimistic locking via a** `version` **column** on `attendances` | Two staff can open the same class and tap the same row seconds apart. Row locks (`SELECT ... FOR UPDATE`) hold connections open across a request. Instead, each write is one atomic `UPDATE ... WHERE id = ? AND version = ?`. If a concurrent write already happened, 0 rows match → API returns `409` with fresh data instead of silently overwriting it. |


| **Integer** `version`**, not** `updated_at` | Timestamps are only second-precision — two concurrent writes in the same second would collide and defeat the check. A counter can't collide. |

| **"Mark all" skips version checks** | Requiring 20+ version numbers per bulk request (and failing the whole batch if one is stale) doesn't match staff intent. It's a deliberate overwrite — but it still bumps the version of every row it changes, so a stale single-row update sent afterward is still rejected. |

| **Bulk update = one SQL statement** | `UPDATE ... WHERE fitness_class_id = ?` instead of 20+ per-row saves. Matters at 1000+ classes/day. |

| **Bulk update skips no-op rows** | `WHERE status != <target>` — attendees already in the target status keep their original `marked_at` and `version`, so a bulk "mark all attended" can't silently erase someone's real check-in time. |

| **Eager-load** `member` **when listing attendees** | Avoids N+1: one query for attendance rows, one for members, not 21. |

| **Composite unique index** `(fitness_class_id, member_id)` | Enforces one attendance row per member per class at the DB level, and (since `fitness_class_id` leads) speeds up the main query: "all attendees for a class." |

| **Update-only, never insert, on single-attendee toggle** | If a member isn't enrolled in the class, it 404s instead of silently creating a row — protects reporting/engagement metrics from bad data. |

| `AttendanceStatus` **as a backed enum, not a boolean** | Leaves room for future states (`excused`, `no_show`, etc.) without a breaking migration. |

| **Conflict handled as a custom exception, rendered centrally** | Keeps the controller's happy path clean; `409` responses carry the current row so the client can resync instantly. A separate `AttendanceRemovedException` (`404`) covers the rarer case where the row was deleted entirely between the read and the write. |

| **Conflicts are surfaced to staff, not just resolved silently** | A `409` means someone else's write already happened — reconciling the row without telling the staff member risks them believing their own tap was the one that stuck. The client shows a brief, auto-dismissing inline notice on that row ("Previously updated at 10:15 AM by another staff to present") instead of silently swapping the value underneath their thumb. |

## Frontend Notes

The roster list, each member's present/absent status, the present/total counts, and
"mark all present" are all driven by the real API
(`GET`/`PATCH /classes/{class}/attendees`). Three pieces of the design have no backing
endpoint or column yet and are static/derived client-side instead — see
[Assumptions](#assumptions) above for why, and for the tradeoff considered.

`useAttendance` covers loading/error states, optimistic single-attendee toggles with
rollback on failure, `409` conflict reconciliation, and mark-all — with tests for each.

On a `409`, the row is reconciled to the server's version and a per-row sync notice
(`utils/formatSyncNotice.ts`, `components/AnimatedSyncNotice.tsx`) fades in for
`SYNC_NOTICE_VISIBLE_MS` (10s) stating who won the race and when, then auto-dismisses —
or dismisses immediately if the staff member toggles that row again. A separate,
best-effort background check after every successful write (`checkForRosterUpdates`)
flags via a banner when *other* rows changed elsewhere, without silently overwriting
what's on screen; the staff member pulls to refresh to bring those in explicitly.
# Product Analytics

This document is the source of truth for the analytics events Multica ships
to PostHog. Events feed the acquisition → activation → expansion funnel that
drives our weekly Active Workspaces (WAW) north-star metric.

See [MUL-1122](https://github.com/multica-ai/multica) for the design context.

## Configuration

All analytics shipping is toggled by environment variables (see `.env.example`):

| Variable | Meaning | Default |
|---|---|---|
| `POSTHOG_API_KEY` | PostHog project API key. Empty = no events are shipped. | `""` |
| `POSTHOG_HOST` | PostHog host (US or EU cloud, or self-hosted URL). | `https://us.i.posthog.com` |
| `ANALYTICS_DISABLED` | Set to `true`/`1` to force the no-op client even when `POSTHOG_API_KEY` is set. | `""` |

Local dev and self-hosted instances run with `POSTHOG_API_KEY=""`, so **no
events leave the process unless the operator explicitly opts in**.

## Architecture

```
handler → analytics.Client.Capture(Event)   ← non-blocking, returns immediately
                    │
                    ▼
           bounded queue (1024 events)
                    │
                    ▼
     background worker: batch + POST /batch/
                    │
                    ▼
                PostHog
```

- `analytics.Capture` is **never allowed to block a request handler**. A
  broken backend must not degrade the product — when the queue is full,
  events are dropped and counted (visible via `slog` + the `dropped` counter
  on shutdown).
- Batches flush either when `BatchSize` is reached or every `FlushEvery`
  (default 10 s), whichever comes first.
- `Close()` drains remaining events during graceful shutdown. Called from
  `server/cmd/server/main.go` via `defer`.

## Identity model

- **`distinct_id`** — always the user's UUID for logged-in events. The
  frontend's `posthog.identify(user.id)` merges any prior anonymous events
  under the same identity, so acquisition attribution (UTM / referrer) stays
  intact across signup.
- **`workspace_id`** — added to every event as a property when present. v1
  uses event property filtering (free tier) rather than PostHog Groups
  Analytics (paid) to compute workspace-level metrics.
- **PII** — events carry `email_domain` (e.g. `gmail.com`), not the full
  email. Full email is stored once in person properties via `$set_once` so
  it's available for individual debugging but not broadcast with every
  event.

## Event contract

### `signup`

Fires when a new user is created. Covers both verification-code and Google
OAuth entry points (`findOrCreateUser` is the single emission site).

| Property | Type | Description |
|---|---|---|
| `email_domain` | string | Lower-cased domain portion of the user's email. |
| `signup_source` | string | Opaque attribution bundle from the frontend cookie `multica_signup_source` (UTM + referrer). Empty when the cookie is absent. |
| `auth_method` | string | Optional. `"google"` for Google OAuth signups. Absent for verification-code signups. |

Person properties set with `$set_once`:

| Property | Type | Description |
|---|---|---|
| `email` | string | Full email. Never broadcast per-event. |
| `signup_source` | string | Same as above; kept on the person for later segmentation. |

### `workspace_created`

Fires after a `CreateWorkspace` transaction commits successfully.

| Property | Type | Description |
|---|---|---|
| `workspace_id` | string (UUID) | Added globally; present here for clarity. |

**Note on "first workspace" segmentation** — we deliberately do *not* stamp
an `is_first_workspace` boolean at emit time. Computing it correctly would
require an extra column or transaction-scoped logic that still races under
concurrent creates. Instead, PostHog answers the same question exactly by
looking at whether the user has a prior `workspace_created` event (use a
funnel with "first time user does X" or a cohort on
`person_properties.$initial_event`). No information is lost.

## Forthcoming events (PR 2 / PR 3)

These are listed here so the schema stays in one place. They ship in later
PRs:

- `runtime_registered` — first-time runtime upsert per workspace; detected
  via Postgres `xmax = 0` on the insert-on-conflict query.
- `issue_executed` — fires **once per issue**, when the issue's first task
  reaches terminal `done` state. Backed by an `issues.first_executed_at`
  column populated atomically so retries / re-assignments don't inflate
  funnel counts.
- `team_invite_sent` — `CreateInvitation` emits; `is_first_invite_for_workspace`
  marks the expansion funnel's first step.
- `team_invite_accepted` — expansion funnel terminal event.

## Governance

Before adding, renaming, or removing any event:

1. Update this document first.
2. Update `server/internal/analytics/events.go` constants and helpers to
   match.
3. PR description must state which existing funnel / insight is affected.

# LA 2028 Olympics Group Scheduler — Database Schema

## Overview

This document defines the database schema for the LA 2028 Olympics Group Scheduler. Tables are organized into four categories: seed data (pre-loaded reference data), user/group data (user-generated), algorithm output data (system-generated), and purchase tracking data (Phase 2).

**Database:** PostgreSQL

---

## Enums

```sql
CREATE TYPE zone_enum AS ENUM (
  'Valley Zone', 'Carson Zone', 'DTLA Zone', 'Long Beach Zone',
  'Exposition Park Zone', 'Venice Zone', 'Inglewood Zone',
  'Pomona Zone', 'City of Industry Zone', 'Pasadena Zone', 'Arcadia Zone',
  'Riviera Zone', 'Port of Los Angeles Zone', 'Whittier Narrows Zone',
  'Universal City Zone', 'Trestles Beach Zone', 'Anaheim Zone'
);
-- Note: Non-LA zones (OKC, New York, Columbus, Nashville, St. Louis, San José, San Diego)
-- are excluded. Sessions in those zones are filtered out during data cleaning.

CREATE TYPE session_type_enum AS ENUM (
  'Final', 'Semifinal', 'Quarterfinal', 'Preliminary', 'Bronze'
);
-- Verified against la2028_sessions.csv (updated March 2026)

CREATE TYPE interest_enum AS ENUM ('low', 'medium', 'high');

CREATE TYPE buddy_type_enum AS ENUM ('hard', 'soft');

CREATE TYPE member_role_enum AS ENUM ('owner', 'member');

CREATE TYPE member_status_enum AS ENUM (
  'pending_approval',                -- Requested to join, awaiting owner approval
  'denied',                          -- Join request denied by owner
  'joined',                          -- In group, hasn't submitted preferences
  'preferences_set'                  -- Submitted preferences; also used during schedule_review phase
);

CREATE TYPE group_phase_enum AS ENUM (
  'preferences',          -- Group created, members joining and inputting preferences
  'schedule_review'       -- Schedule generated; members review; window rankings already computed
);

CREATE TYPE combo_rank_enum AS ENUM ('primary', 'backup1', 'backup2');

CREATE TYPE date_mode_enum AS ENUM ('consecutive', 'specific');

CREATE TYPE preference_step_enum AS ENUM ('buddies', 'sport_rankings', 'sessions');

CREATE TYPE purchase_timeslot_status_enum AS ENUM (
  'upcoming', 'in_progress', 'completed'
);
```

---

## Seed Data Tables

### `session`

The 765 LA-area Olympic sessions from la2028_sessions.csv. Pre-loaded, read-only.

| Column                | Type                | Constraints | Description                                                         |
| --------------------- | ------------------- | ----------- | ------------------------------------------------------------------- |
| `session_code`        | `text`              | **PK**      | Unique session identifier (e.g., "AGY01", "SWM15")                  |
| `sport`               | `text`              | NOT NULL    | Sport name                                                          |
| `venue`               | `text`              | NOT NULL    | Venue name                                                          |
| `zone`                | `zone_enum`         | NOT NULL    | Venue zone                                                          |
| `session_date`        | `date`              | NOT NULL    | Date of session                                                     |
| `session_type`        | `session_type_enum` | NOT NULL    | Type of event (Final, Semifinal, Quarterfinal, Preliminary, Bronze) |
| `session_description` | `text`              |             | Description of the session                                          |
| `start_time`          | `time`              | NOT NULL    | Start time                                                          |
| `end_time`            | `time`              | NOT NULL    | End time                                                            |

### `travel_time`

Pre-loaded zone-to-zone driving and transit times. Raw minutes stored; gap computation happens in application code using the proximity-based gap rules from the algorithm spec.

| Column             | Type        | Constraints | Description                                                  |
| ------------------ | ----------- | ----------- | ------------------------------------------------------------ |
| `origin_zone`      | `zone_enum` | **PK**      | Origin zone                                                  |
| `destination_zone` | `zone_enum` | **PK**      | Destination zone                                             |
| `driving_minutes`  | `real`      | NOT NULL    | Driving time in minutes                                      |
| `transit_minutes`  | `real`      |             | Transit time in minutes (NULL if no transit route available) |

**Primary Key:** Composite (`origin_zone`, `destination_zone`)

**Design Decision:** We store raw travel times rather than pre-computed gaps so that gap rules (the proximity-to-gap mapping) can be adjusted in application code without re-seeding the database. This is useful during development if the gap rules prove too restrictive or too lenient.

---

## User & Group Tables

### `user`

| Column         | Type                | Constraints                       | Description                                               |
| -------------- | ------------------- | --------------------------------- | --------------------------------------------------------- |
| `id`           | `uuid`              | **PK**, DEFAULT gen_random_uuid() | Unique user ID                                            |
| `auth_id`      | `text`              | UNIQUE, NOT NULL                  | Reference to external auth provider (e.g., Supabase Auth) |
| `email`        | `text`              | UNIQUE, NOT NULL                  | User's email                                              |
| `username`     | `text`              | UNIQUE, NOT NULL                  | Display username (chosen at signup)                       |
| `first_name`   | `text`              | NOT NULL                          | First name                                                |
| `last_name`    | `text`              | NOT NULL                          | Last name                                                 |
| `avatar_color` | `avatar_color_enum` | NOT NULL, DEFAULT 'blue'          | Avatar color for display                                  |
| `created_at`   | `timestamp`         | DEFAULT now()                     | Account creation time                                     |

### `group`

| Column                         | Type               | Constraints                       | Description                                                                                                              |
| ------------------------------ | ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                           | `uuid`             | **PK**, DEFAULT gen_random_uuid() | Unique group ID                                                                                                          |
| `name`                         | `text`             | NOT NULL                          | Group display name                                                                                                       |
| `phase`                        | `group_phase_enum` | NOT NULL, DEFAULT 'preferences'   | Current phase of the group workflow                                                                                      |
| `invite_code`                  | `text`             | UNIQUE, NOT NULL                  | Human-readable invite code (e.g., "OLYMP-X7K2")                                                                          |
| `date_mode`                    | `date_mode_enum`   |                                   | 'consecutive' or 'specific' (NULL if deferred during group creation)                                                     |
| `consecutive_days`             | `integer`          |                                   | Number of consecutive days (if date_mode = 'consecutive')                                                                |
| `start_date`                   | `date`             |                                   | Start date (if date_mode = 'specific')                                                                                   |
| `end_date`                     | `date`             |                                   | End date (if date_mode = 'specific')                                                                                     |
| `schedule_generated_at`        | `timestamp`        |                                   | When the algorithm last ran (NULL if never generated)                                                                    |
| `departed_members`             | `jsonb`            | DEFAULT '[]'                      | Array of `{ userId, name, departedAt, rejoinedAt?, wasPartOfSchedule? }` tracking members who left after generation      |
| `affected_buddy_members`       | `jsonb`            | DEFAULT '{}'                      | Map of `memberId → string[]` tracking members affected by buddy departures                                               |
| `members_with_no_combos`       | `jsonb`            | DEFAULT '[]'                      | Array of member IDs that received no combos in the last generation                                                       |
| `non_convergence_members`      | `jsonb`            | DEFAULT '[]'                      | Array of member IDs affected by non-convergence (empty if converged). Used for amber warning display.                    |
| `sold_out_codes_at_generation` | `jsonb`            | DEFAULT '[]'                      | Snapshot of sold-out session codes at the time of last generation. Used to detect new sold-out sessions post-generation. |
| `purchase_data_changed_at`     | `timestamp`        |                                   | When purchase data last changed (for regeneration notification). Reset on generation.                                    |
| `created_at`                   | `timestamp`        | DEFAULT now()                     | Group creation time                                                                                                      |

**Notes:**

- `date_mode`, `consecutive_days`, `start_date`, `end_date` can be set during group creation or deferred and set later. Date config must be set before the owner triggers schedule generation. The owner is encouraged to ensure group agreement on dates before generating.
- Date config is editable at any point by the owner. Changing date config does NOT require re-running the algorithm — it only affects window ranking computation.
- Window rankings are computed during schedule generation (when the group transitions to `'schedule_review'`). The top-scoring window is auto-selected when rankings are generated.

### `member`

The join table between `user` and `group`. Each row represents one user's membership in one group.

| Column                      | Type                   | Constraints                          | Description                                                                              |
| --------------------------- | ---------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `id`                        | `uuid`                 | **PK**, DEFAULT gen_random_uuid()    | Unique member ID                                                                         |
| `user_id`                   | `uuid`                 | FK → `user.id`, NOT NULL             | The user                                                                                 |
| `group_id`                  | `uuid`                 | FK → `group.id`, NOT NULL            | The group                                                                                |
| `role`                      | `member_role_enum`     | NOT NULL, DEFAULT 'member'           | Owner or member. Group creator is owner.                                                 |
| `min_buddies`               | `integer`              | NOT NULL, DEFAULT 0                  | Minimum other members required at each session                                           |
| `sport_rankings`            | `jsonb`                |                                      | Ordered list of sports, e.g., `["Gymnastics", "Swimming", "Track"]`                      |
| `status`                    | `member_status_enum`   | NOT NULL, DEFAULT 'pending_approval' | Member's current status in the workflow                                                  |
| `preference_step`           | `preference_step_enum` |                                      | Which wizard step the user last completed. NULL if not started.                          |
| `joined_at`                 | `timestamp`            |                                      | When the member was approved to join                                                     |
| `status_changed_at`         | `timestamp`            |                                      | When the member's status or preferences last changed                                     |
| `schedule_warning_acked_at` | `timestamp`            |                                      | When the member acknowledged the "preferences changed" warning                           |
| `excluded_session_codes`    | `jsonb`                | DEFAULT '[]'                         | Snapshot of `{ code, soldOut, outOfBudget }[]` at generation time (for excluded section) |
| `created_at`                | `timestamp`            | DEFAULT now()                        | When user joined the group                                                               |

**Unique Constraint:** (`user_id`, `group_id`) — a user can only be a member of a group once.

### `buddy_constraint`

Stores hard and soft buddy relationships between members within a group.

| Column            | Type              | Constraints              | Description                                                         |
| ----------------- | ----------------- | ------------------------ | ------------------------------------------------------------------- |
| `member_id`       | `uuid`            | **PK**, FK → `member.id` | The member who has the constraint                                   |
| `buddy_member_id` | `uuid`            | **PK**, FK → `member.id` | The buddy they want to attend with                                  |
| `type`            | `buddy_type_enum` | NOT NULL                 | 'hard' (must attend together) or 'soft' (prefer to attend together) |

**Primary Key:** Composite (`member_id`, `buddy_member_id`) — a member can only list another member as a buddy once (either hard or soft, not both).

### `session_preference`

Stores a member's interest for a specific session. Only rows where the user explicitly opted in (interest ≠ None) are stored.

| Column       | Type            | Constraints                         | Description                        |
| ------------ | --------------- | ----------------------------------- | ---------------------------------- |
| `session_id` | `text`          | **PK**, FK → `session.session_code` | The session                        |
| `member_id`  | `uuid`          | **PK**, FK → `member.id`            | The member                         |
| `interest`   | `interest_enum` | NOT NULL                            | Interest level (low, medium, high) |

**Primary Key:** Composite (`session_id`, `member_id`)

**Design Decision:** Sessions default to "not interested" — we only store opt-in rows. This reduces noise (no rows for 765 × N sessions where most are unselected) and makes the query "all members interested in session X" straightforward.

**Design Decision:** Session exclusion (sold-out, out-of-budget) is handled at algorithm generation time by filtering candidate sessions, not by a column on this table. The per-member `excluded_session_codes` JSONB on the `member` table stores a snapshot of which sessions were excluded at generation time for display in the Purchase Tracker's excluded sessions section.

---

## Algorithm Output Tables

All algorithm output tables are regenerated when the algorithm re-runs. The pattern is: delete all rows for the group, then insert fresh results.

### `combo`

A day combo is a set of sessions a member could attend on a specific day. Each member gets a primary combo and up to 2 backup combos per day.

| Column      | Type              | Constraints                       | Description                                                    |
| ----------- | ----------------- | --------------------------------- | -------------------------------------------------------------- |
| `id`        | `uuid`            | **PK**, DEFAULT gen_random_uuid() | Unique combo ID                                                |
| `group_id`  | `uuid`            | FK → `group.id`, NOT NULL         | The group (denormalized for efficient deletion during re-runs) |
| `member_id` | `uuid`            | FK → `member.id`, NOT NULL        | The member this combo belongs to                               |
| `day`       | `date`            | NOT NULL                          | The date this combo is for                                     |
| `rank`      | `combo_rank_enum` | NOT NULL                          | Primary, backup1, or backup2                                   |
| `score`     | `real`            | NOT NULL                          | Combo score (sum of session scores)                            |

**Unique Constraint:** (`member_id`, `day`, `rank`) — a member can only have one primary combo per day, one backup1 per day, etc.

### `combo_session`

Join table linking combos to their sessions.

| Column       | Type   | Constraints                         | Description            |
| ------------ | ------ | ----------------------------------- | ---------------------- |
| `combo_id`   | `uuid` | **PK**, FK → `combo.id`             | The combo              |
| `session_id` | `text` | **PK**, FK → `session.session_code` | A session in the combo |

**Primary Key:** Composite (`combo_id`, `session_id`)

### `window_ranking`

Scored N-day windows for the group. Regenerated when N-days changes or the algorithm re-runs.

| Column       | Type        | Constraints                       | Description                                                |
| ------------ | ----------- | --------------------------------- | ---------------------------------------------------------- |
| `id`         | `uuid`      | **PK**, DEFAULT gen_random_uuid() | Unique window ID                                           |
| `group_id`   | `uuid`      | FK → `group.id`, NOT NULL         | The group                                                  |
| `start_date` | `date`      | NOT NULL                          | Window start date                                          |
| `end_date`   | `date`      | NOT NULL                          | Window end date                                            |
| `score`      | `real`      | NOT NULL                          | Group window score (total satisfaction - fairness penalty) |
| `created_at` | `timestamp` | DEFAULT now()                     | When ranking was computed                                  |

**Notes:**

- Window selection is tracked client-side / by the frontend — there is no `selected` column on this table.
- Windows are returned sorted by score descending; the top-scoring window is the default selection.
- Users can switch the selected window without re-running the algorithm.

---

## Phase 2: Purchase Tracking Tables

### `purchase_timeslot`

A member's declared purchase window — when they plan to buy tickets.

| Column           | Type                            | Constraints                       | Description                         |
| ---------------- | ------------------------------- | --------------------------------- | ----------------------------------- |
| `id`             | `uuid`                          | **PK**, DEFAULT gen_random_uuid() | Unique timeslot ID                  |
| `group_id`       | `uuid`                          | FK → `group.id`, NOT NULL         | The group                           |
| `member_id`      | `uuid`                          | FK → `member.id`, NOT NULL        | The member                          |
| `timeslot_start` | `timestamp`                     | NOT NULL                          | Start of purchase window            |
| `timeslot_end`   | `timestamp`                     | NOT NULL                          | End of purchase window              |
| `status`         | `purchase_timeslot_status_enum` | NOT NULL, DEFAULT 'upcoming'      | upcoming, in_progress, or completed |
| `created_at`     | `timestamp`                     | DEFAULT now()                     | When the timeslot was created       |
| `updated_at`     | `timestamp`                     | DEFAULT now()                     | Last update time                    |

**Unique Constraint:** (`member_id`, `group_id`) — one timeslot per member per group.

### `purchase_plan_entry`

A planned purchase for a specific session + assignee member, with an optional price ceiling.

| Column               | Type        | Constraints                           | Description                                    |
| -------------------- | ----------- | ------------------------------------- | ---------------------------------------------- |
| `id`                 | `uuid`      | **PK**, DEFAULT gen_random_uuid()     | Unique entry ID                                |
| `group_id`           | `uuid`      | FK → `group.id`, NOT NULL             | The group                                      |
| `member_id`          | `uuid`      | FK → `member.id`, NOT NULL            | The member who created the plan entry          |
| `session_id`         | `text`      | FK → `session.session_code`, NOT NULL | The session                                    |
| `assignee_member_id` | `uuid`      | FK → `member.id`, NOT NULL            | The member the ticket is planned for           |
| `price_ceiling`      | `real`      |                                       | Maximum price willing to pay (NULL = no limit) |
| `created_at`         | `timestamp` | DEFAULT now()                         | When the entry was created                     |
| `updated_at`         | `timestamp` | DEFAULT now()                         | Last update time                               |

**Unique Constraint:** (`member_id`, `session_id`, `assignee_member_id`) — one plan entry per member-session-assignee triple.

### `ticket_purchase`

A recorded ticket purchase.

| Column                   | Type        | Constraints                           | Description                      |
| ------------------------ | ----------- | ------------------------------------- | -------------------------------- |
| `id`                     | `uuid`      | **PK**, DEFAULT gen_random_uuid()     | Unique purchase ID               |
| `group_id`               | `uuid`      | FK → `group.id`, NOT NULL             | The group                        |
| `session_id`             | `text`      | FK → `session.session_code`, NOT NULL | The session                      |
| `purchased_by_member_id` | `uuid`      | FK → `member.id`, NOT NULL            | The member who bought the ticket |
| `price_per_ticket`       | `real`      |                                       | Price paid per ticket (nullable) |
| `created_at`             | `timestamp` | DEFAULT now()                         | When the purchase was recorded   |
| `updated_at`             | `timestamp` | DEFAULT now()                         | Last update time                 |

### `ticket_purchase_assignee`

Who the purchased tickets are for. One row per member assigned a ticket.

| Column               | Type   | Constraints                       | Description                  |
| -------------------- | ------ | --------------------------------- | ---------------------------- |
| `ticket_purchase_id` | `uuid` | **PK**, FK → `ticket_purchase.id` | The purchase                 |
| `member_id`          | `uuid` | **PK**, FK → `member.id`          | The member the ticket is for |
| `price_paid`         | `real` |                                   | Per-member price (nullable)  |

**Primary Key:** Composite (`ticket_purchase_id`, `member_id`)

### `sold_out_session`

Group-scoped tracking of sold-out sessions.

| Column                  | Type        | Constraints                           | Description                                                                   |
| ----------------------- | ----------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| `id`                    | `uuid`      | **PK**, DEFAULT gen_random_uuid()     | Unique ID                                                                     |
| `group_id`              | `uuid`      | FK → `group.id`, NOT NULL             | The group                                                                     |
| `session_id`            | `text`      | FK → `session.session_code`, NOT NULL | The session                                                                   |
| `reported_by_member_id` | `uuid`      | FK → `member.id`, ON DELETE SET NULL  | Who reported it as sold out (nullable — set to NULL if reporter leaves group) |
| `created_at`            | `timestamp` | DEFAULT now()                         | When it was reported                                                          |

**Unique Constraint:** (`group_id`, `session_id`)

### `out_of_budget_session`

Per-member tracking of sessions that are out of their budget.

| Column       | Type        | Constraints                           | Description        |
| ------------ | ----------- | ------------------------------------- | ------------------ |
| `id`         | `uuid`      | **PK**, DEFAULT gen_random_uuid()     | Unique ID          |
| `group_id`   | `uuid`      | FK → `group.id`, NOT NULL             | The group          |
| `member_id`  | `uuid`      | FK → `member.id`, NOT NULL            | The member         |
| `session_id` | `text`      | FK → `session.session_code`, NOT NULL | The session        |
| `created_at` | `timestamp` | DEFAULT now()                         | When it was marked |

**Unique Constraint:** (`member_id`, `session_id`)

### `reported_price`

Price reports for sessions. Members can report multiple prices over time (no unique constraint per member+session).

| Column                  | Type        | Constraints                           | Description                               |
| ----------------------- | ----------- | ------------------------------------- | ----------------------------------------- |
| `id`                    | `uuid`      | **PK**, DEFAULT gen_random_uuid()     | Unique ID                                 |
| `group_id`              | `uuid`      | FK → `group.id`, NOT NULL             | The group                                 |
| `session_id`            | `text`      | FK → `session.session_code`, NOT NULL | The session                               |
| `reported_by_member_id` | `uuid`      | FK → `member.id`, NOT NULL            | Who reported the price                    |
| `min_price`             | `real`      |                                       | Minimum price seen (nullable)             |
| `max_price`             | `real`      |                                       | Maximum price seen (nullable)             |
| `comments`              | `text`      |                                       | Optional comments (200 char limit in app) |
| `created_at`            | `timestamp` | DEFAULT now()                         | When the price was reported               |

---

## Relationship Diagram

```
user ─────────┐
              │ (one-to-many)
              ▼
group ──────► member ◄──── buddy_constraint
              │   │              (self-referencing)
              │   │
              │   ├──► session_preference ──► session
              │   │
              │   ├──► combo ──► combo_session ──► session
              │   │
              │   ├──► purchase_timeslot
              │   ├──► purchase_plan_entry ──► session
              │   ├──► ticket_purchase ──► ticket_purchase_assignee
              │   │         └──► session
              │   ├──► sold_out_session ──► session
              │   ├──► out_of_budget_session ──► session
              │   └──► reported_price ──► session
              │
              └──► window_ranking

travel_time (standalone reference table)
```

---

## Application Logic Notes

These notes document conditional updates and cascading effects that the application must handle when certain actions are taken. Important to keep in mind during API and algorithm implementation.

### When a Member Joins (After Owner Approval)

Regardless of group phase, the new member is added with status = `'joined'`. Algorithm outputs are **not** deleted — the system displays a notification that the new member needs to enter preferences and schedules should be regenerated.

| Action                | Tables Affected                                                                 |
| --------------------- | ------------------------------------------------------------------------------- |
| Set new member status | `member` — status = `'joined'`, `joined_at` = now()                             |
| Track rejoin          | `group.departed_members` — if member was previously departed, mark `rejoinedAt` |

### When a Member Leaves

Behavior is determined by `wasPartOfSchedule` (`joinedAt <= scheduleGeneratedAt`), not the current phase.

**Always (regardless of phase):**

| Action                                     | Tables Affected                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Delete member data                         | `buddy_constraint`, `session_preference` — delete all rows for this member                             |
| Auto-remove from others' buddy constraints | `buddy_constraint` — delete any rows where `buddy_member_id` = leaving member                          |
| Track affected buddies                     | `group.affected_buddy_members` — add departing member's name to entries for each affected buddy member |
| Delete member row                          | `member` — delete the departing member                                                                 |

**If `wasPartOfSchedule` is true (algorithm ran and member was included):**

| Action                             | Tables Affected                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| Reset all remaining active members | `member` — all remaining active members → `'preferences_set'` (regardless of buddy connection) |
| Record departure                   | `group.departed_members` — append `{ name, departedAt }`                                       |
| Reset group for re-run             | `group` — phase → `'preferences'`, `members_with_no_combos` → `[]`                             |
| Delete algorithm outputs           | `combo`, `combo_session`, `window_ranking` — delete all rows for this group                    |

**If `wasPartOfSchedule` is false (member joined after last generation):**

| Action                 | Tables Affected                             |
| ---------------------- | ------------------------------------------- |
| No group/phase changes | Algorithm outputs and group phase preserved |

**Note:** Affected buddy members are NOT reset to `joined` status. Instead, they are tracked via the `affected_buddy_members` JSONB field on the group table. Generation is blocked until all affected members have reviewed their preferences (by saving buddies, completing sessions, or acknowledging the review).

### When Owner Transfers Ownership

| Action       | Tables Affected                                                            |
| ------------ | -------------------------------------------------------------------------- |
| Update roles | `member` — current owner's role → `'member'`, new owner's role → `'owner'` |

No impact on algorithm outputs or group phase.

### When the Algorithm Re-Runs (Steps 4-6)

Triggered when the owner generates schedules.

| Action                                     | Tables Affected                                                                                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delete all algorithm outputs for the group | `combo`, `combo_session`, `window_ranking`                                                                                                                                                            |
| Member statuses                            | `member` — all members remain at `'preferences_set'` (no status change)                                                                                                                               |
| Store excluded session snapshots           | `member.excluded_session_codes` — updated per member with sold-out/OOB sessions excluded from this generation                                                                                         |
| Update group                               | `group` — `phase` → `'schedule_review'`, `schedule_generated_at` → now(), `purchase_data_changed_at` → null, `departed_members` → [], `affected_buddy_members` → {}, `members_with_no_combos` updated |
| Compute window rankings                    | `window_ranking` — generate and insert ranked windows (if date config is set)                                                                                                                         |

### When N-Days or Date Range Changes

Can happen at any point. Date config can be set during group creation or later. **Owner only.**

| Action                                       | Tables Affected                                                                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Update group settings                        | `group` — update `date_mode`, `consecutive_days`, `start_date`, `end_date`                                                              |
| Regenerate window rankings (if combos exist) | Delete and regenerate `window_ranking` rows for the group. Only possible after algorithm has run (combos must exist to compute scores). |

### Computed-at-Display-Time Fields (No Storage Needed)

These values are derived from stored data and computed when rendering the UI, not stored in the database:

- **Selected window** — the frontend tracks which window the user has selected; the top-scoring window is the default
- **Window rank** — derived from `window_ranking.score` ordering
- **Buddy status display** — computed from `buddy_constraint` + `combo_session` overlap between members
- **Rest days** — absence of a `combo` row for a member on a given day implies rest day
- **Combo tie-breaking** — computed from `combo_session` count + session scores, not stored

---

## Key Design Decisions Summary

| Decision                 | Choice                                                                    | Rationale                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| No separate setup phase  | Group starts in `preferences` on creation                                 | Members can immediately join and enter preferences; owner gates generation, which is the real checkpoint                                             |
| Group owner role         | `member_role_enum` on member table                                        | Owner gates destructive/group-wide actions (join approval, generation, date config changes, deletion)                                                |
| Date config              | Set at creation or deferred; required before generation; owner-only edits | Encourages early agreement on dates without blocking preference input; generation validates date config exists                                       |
| Join flow                | Request/approve with `'pending_approval'` status                          | Prevents unexpected members joining mid-process; owner confirms group composition                                                                    |
| Budget                   | Removed (may revisit in a future phase)                                   | Budget tracking was dropped from Phase 2 scope. May be reintroduced later.                                                                           |
| Buddy storage            | Join table, not JSON                                                      | Referential integrity + efficient reverse lookups                                                                                                    |
| Session preferences      | Opt-in rows only, interest only (no willingness)                          | Reduces noise, explicit user intent. Price ceilings move to Phase 2 purchase plan.                                                                   |
| Sport rankings           | JSON array on member                                                      | Simple ordered list of strings, no relational queries needed                                                                                         |
| Travel data              | Raw minutes, not computed gaps                                            | Allows gap rule adjustments without re-seeding DB                                                                                                    |
| Combo sessions           | Join table, not JSON                                                      | Need to query "which combos contain session X?"                                                                                                      |
| Simplified state machine | `preferences` → `schedule_review`                                         | No confirmation step or `completed` phase. Members implicitly accept schedules; window rankings computed at generation, not after all confirmations. |
| Window selection         | Client-side; windows sorted by score                                      | Simple, users can switch without re-running algorithm                                                                                                |
| Algorithm re-run         | Delete + regenerate all outputs                                           | Clean slate approach, no versioning complexity                                                                                                       |
| Session exclusion        | Handled at generation time via sold-out/out-of-budget filtering           | No `excluded` column on session_preference. Exclusion snapshot stored in `member.excluded_session_codes` JSONB for display purposes.                 |

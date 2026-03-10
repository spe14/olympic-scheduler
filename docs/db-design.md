# LA 2028 Olympics Group Scheduler — Database Schema

## Overview

This document defines the database schema for the LA 2028 Olympics Group Scheduler (Phase 1). Tables are organized into three categories: seed data (pre-loaded reference data), user/group data (user-generated), and algorithm output data (system-generated).

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
  'joined',                          -- In group, hasn't submitted preferences
  'preferences_set',                 -- Submitted preferences, waiting for algorithm
  'schedule_review_pending',         -- Reviewing generated schedule, hasn't confirmed satisfaction
  'schedule_review_confirmed',       -- Confirmed satisfaction with generated schedule
  'conflict_resolution_pending',     -- Resolving conflicts, hasn't confirmed final schedule
  'conflict_resolution_confirmed'    -- Confirmed final schedule after conflicts resolved
);

CREATE TYPE group_phase_enum AS ENUM (
  'preferences',          -- Group created, members joining and inputting preferences
  'schedule_review',      -- Satisfaction check — members review generated schedules
  'conflict_resolution',  -- Members resolving buddy constraint conflicts
  'completed'             -- All members confirmed; window rankings computed and window selected here
);

CREATE TYPE combo_rank_enum AS ENUM ('primary', 'backup1', 'backup2');

CREATE TYPE conflict_type_enum AS ENUM ('min_buddies_failure', 'hard_buddy_failure');

CREATE TYPE date_mode_enum AS ENUM ('consecutive', 'specific');

CREATE TYPE preference_step_enum AS ENUM ('buddies_budget', 'sport_rankings', 'sessions');
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
| `driving_minutes`  | `integer`   | NOT NULL    | Driving time in minutes                                      |
| `transit_minutes`  | `integer`   |             | Transit time in minutes (NULL if no transit route available) |

**Primary Key:** Composite (`origin_zone`, `destination_zone`)

**Design Decision:** We store raw travel times rather than pre-computed gaps so that gap rules (the proximity-to-gap mapping) can be adjusted in application code without re-seeding the database. This is useful during development if the gap rules prove too restrictive or too lenient.

---

## User & Group Tables

### `user`

| Column       | Type        | Constraints                       | Description                                               |
| ------------ | ----------- | --------------------------------- | --------------------------------------------------------- |
| `id`         | `uuid`      | **PK**, DEFAULT gen_random_uuid() | Unique user ID                                            |
| `auth_id`    | `text`      | UNIQUE, NOT NULL                  | Reference to external auth provider (e.g., Supabase Auth) |
| `email`      | `text`      | UNIQUE, NOT NULL                  | User's email                                              |
| `username`   | `text`      | UNIQUE, NOT NULL                  | Display username (chosen at signup)                       |
| `first_name` | `text`      | NOT NULL                          | First name                                                |
| `last_name`  | `text`      | NOT NULL                          | Last name                                                 |
| `created_at` | `timestamp` | DEFAULT now()                     | Account creation time                                     |

### `group`

| Column             | Type               | Constraints                       | Description                                                          |
| ------------------ | ------------------ | --------------------------------- | -------------------------------------------------------------------- |
| `id`               | `uuid`             | **PK**, DEFAULT gen_random_uuid() | Unique group ID                                                      |
| `name`             | `text`             | NOT NULL                          | Group display name                                                   |
| `phase`            | `group_phase_enum` | NOT NULL, DEFAULT 'preferences'   | Current phase of the group workflow                                  |
| `invite_code`      | `text`             | UNIQUE, NOT NULL                  | Human-readable invite code (e.g., "OLYMP-X7K2")                      |
| `date_mode`        | `date_mode_enum`   |                                   | 'consecutive' or 'specific' (NULL if deferred during group creation) |
| `consecutive_days` | `integer`          |                                   | Number of consecutive days (if date_mode = 'consecutive')            |
| `start_date`       | `date`             |                                   | Start date (if date_mode = 'specific')                               |
| `end_date`         | `date`             |                                   | End date (if date_mode = 'specific')                                 |
| `created_at`       | `timestamp`        | DEFAULT now()                     | Group creation time                                                  |

**Notes:**

- `date_mode`, `consecutive_days`, `start_date`, `end_date` can be set during group creation or deferred and set later. Date config must be set before the owner triggers schedule generation. The owner is encouraged to ensure group agreement on dates before generating.
- Date config is editable at any point by the owner. Changing date config does NOT require re-running the algorithm — it only affects window ranking computation.
- Window rankings are computed after all members confirm (during `'completed'` phase). The top-scoring window is auto-selected when rankings are generated.
- Budget impact can be shown once window rankings are computed and a window is selected (during `'completed'` phase).

### `member`

The join table between `user` and `group`. Each row represents one user's membership in one group. Holds per-group preferences like budget and sport rankings.

| Column            | Type                   | Constraints                       | Description                                                                       |
| ----------------- | ---------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| `id`              | `uuid`                 | **PK**, DEFAULT gen_random_uuid() | Unique member ID                                                                  |
| `user_id`         | `uuid`                 | FK → `user.id`, NOT NULL          | The user                                                                          |
| `group_id`        | `uuid`                 | FK → `group.id`, NOT NULL         | The group                                                                         |
| `role`            | `member_role_enum`     | NOT NULL, DEFAULT 'member'        | Owner or member. Group creator is owner.                                          |
| `budget`          | `decimal`              | NOT NULL                          | Total budget for this group (in dollars). Set during the buddies preference step. |
| `min_buddies`     | `integer`              | NOT NULL, DEFAULT 0               | Minimum other members required at each session                                    |
| `sport_rankings`  | `jsonb`                |                                   | Ordered list of sports, e.g., `["Gymnastics", "Swimming", "Track"]`               |
| `status`          | `member_status_enum`   | NOT NULL, DEFAULT 'joined'        | Member's current status in the workflow                                           |
| `preference_step` | `preference_step_enum` |                                   | Which wizard step the user last completed. NULL if not started.                   |
| `created_at`      | `timestamp`            | DEFAULT now()                     | When user joined the group                                                        |

**Unique Constraint:** (`user_id`, `group_id`) — a user can only be a member of a group once.

### `buddy_constraint`

Stores hard and soft buddy relationships between members within a group.

| Column            | Type              | Constraints              | Description                                                         |
| ----------------- | ----------------- | ------------------------ | ------------------------------------------------------------------- |
| `member_id`       | `uuid`            | **PK**, FK → `member.id` | The member who has the constraint                                   |
| `buddy_member_id` | `uuid`            | **PK**, FK → `member.id` | The buddy they want to attend with                                  |
| `type`            | `buddy_type_enum` | NOT NULL                 | 'hard' (must attend together) or 'soft' (prefer to attend together) |

**Primary Key:** Composite (`member_id`, `buddy_member_id`) — a member can only list another member as a buddy once (either hard or soft, not both).

**Design Decision:** We use a join table instead of JSON arrays on the member table for referential integrity (database enforces that buddy_member_id is a valid member) and efficient reverse lookups ("who depends on Bob?" is a simple query).

### `session_preference`

Stores a member's interest and willingness for a specific session. Only rows where the user explicitly opted in (interest ≠ None) are stored.

| Column                 | Type            | Constraints                         | Description                                                                                  |
| ---------------------- | --------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `session_id`           | `text`          | **PK**, FK → `session.session_code` | The session                                                                                  |
| `member_id`            | `uuid`          | **PK**, FK → `member.id`            | The member                                                                                   |
| `interest`             | `interest_enum` | NOT NULL                            | Interest level (low, medium, high)                                                           |
| `willingness_max`      | `integer`       |                                     | Max price willing to pay. NULL = no limit ($1000+)                                           |
| `override_hard_buddy`  | `boolean`       | NOT NULL, DEFAULT false             | If true, ignore hard_buddy constraint for this session                                       |
| `override_min_buddies` | `boolean`       | NOT NULL, DEFAULT false             | If true, ignore min_buddies constraint for this session                                      |
| `excluded`             | `boolean`       | NOT NULL, DEFAULT false             | If true, session is excluded from combo generation (soft removal during conflict resolution) |

**Primary Key:** Composite (`session_id`, `member_id`)

**Design Decision:** Sessions default to "not interested" — we only store opt-in rows. This reduces noise (no rows for 765 × N sessions where most are unselected) and makes the query "all members interested in session X" straightforward.

**Design Decision:** Buddy override flags are stored on this table rather than a separate table because overrides can only exist for sessions the member has interest in (and therefore already has a row). Overrides and `excluded` flags are reset to `false` when the algorithm re-runs, so previously excluded sessions are reconsidered with fresh combo generation.

**Design Decision:** Session removal during conflict resolution sets `excluded = true` rather than deleting the row. This preserves the user's interest and willingness data so the session can be reconsidered during re-generation (e.g., if group dynamics change and more people are now interested). Permanent session removal happens only through the preference wizard (Step 3), which deletes the row entirely.

**Important:** Excluded sessions must be treated as "not interested" for all algorithm purposes: they are filtered out during combo generation (Step 4), do not count toward other users' soft buddy bonuses, and do not count toward min_buddies checks.

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
| `score`     | `decimal`         | NOT NULL                          | Combo score (sum of session scores)                            |

**Unique Constraint:** (`member_id`, `day`, `rank`) — a member can only have one primary combo per day, one backup1 per day, etc.

### `combo_session`

Join table linking combos to their sessions.

| Column       | Type   | Constraints                         | Description            |
| ------------ | ------ | ----------------------------------- | ---------------------- |
| `combo_id`   | `uuid` | **PK**, FK → `combo.id`             | The combo              |
| `session_id` | `text` | **PK**, FK → `session.session_code` | A session in the combo |

**Primary Key:** Composite (`combo_id`, `session_id`)

**Design Decision:** We use a join table instead of a JSON array of session IDs so we can efficiently query "which combos contain this session?" — needed during conflict resolution when a user removes a session and we need to update/de-duplicate affected combos.

### `viable_config`

A viable configuration represents who can attend a session together at a given price tier, with all buddy constraints satisfied.

| Column       | Type      | Constraints                           | Description                                                    |
| ------------ | --------- | ------------------------------------- | -------------------------------------------------------------- |
| `id`         | `uuid`    | **PK**, DEFAULT gen_random_uuid()     | Unique config ID                                               |
| `group_id`   | `uuid`    | FK → `group.id`, NOT NULL             | The group (denormalized for efficient deletion during re-runs) |
| `session_id` | `text`    | FK → `session.session_code`, NOT NULL | The session                                                    |
| `price_min`  | `integer` | NOT NULL                              | Lower bound of price tier (inclusive)                          |
| `price_max`  | `integer` |                                       | Upper bound of price tier (inclusive). NULL = no upper limit   |

### `viable_config_member`

Join table linking viable configurations to their members.

| Column             | Type   | Constraints                     | Description             |
| ------------------ | ------ | ------------------------------- | ----------------------- |
| `viable_config_id` | `uuid` | **PK**, FK → `viable_config.id` | The viable config       |
| `member_id`        | `uuid` | **PK**, FK → `member.id`        | A member in this config |

**Primary Key:** Composite (`viable_config_id`, `member_id`)

**Notes:** Viable configs are recomputed (deleted + regenerated) when:

- The full algorithm re-runs
- A user adjusts willingness during conflict resolution
- A user overrides a buddy constraint for a session
- A user excludes a session from their schedule during conflict resolution

### `conflict`

Conflicts are flagged when a member's buddy constraint fails at a price tier. Conflicts are fully deleted and recomputed after each user change during conflict resolution. Conflicts are displayed to both the affected member and the causing member (if applicable), since both parties may need to coordinate on a resolution.

| Column               | Type                 | Constraints                           | Description                                                    |
| -------------------- | -------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `id`                 | `uuid`               | **PK**, DEFAULT gen_random_uuid()     | Unique conflict ID                                             |
| `group_id`           | `uuid`               | FK → `group.id`, NOT NULL             | The group (denormalized for efficient deletion during re-runs) |
| `session_id`         | `text`               | FK → `session.session_code`, NOT NULL | The session with the conflict                                  |
| `affected_member_id` | `uuid`               | FK → `member.id`, NOT NULL            | The member whose constraint fails                              |
| `causing_member_id`  | `uuid`               | FK → `member.id`                      | The member causing the failure (NULL for min_buddies_failure)  |
| `price_min`          | `integer`            | NOT NULL                              | Lower bound of affected price tier                             |
| `price_max`          | `integer`            |                                       | Upper bound of affected price tier (NULL = no upper limit)     |
| `type`               | `conflict_type_enum` | NOT NULL                              | Type of conflict                                               |
| `created_at`         | `timestamp`          | DEFAULT now()                         | When conflict was detected                                     |

**Notes:**

- `causing_member_id` is NULL for `min_buddies_failure` (caused by a group shortfall, not a specific person).
- `causing_member_id` is set for `hard_buddy_failure` (the hard buddy who isn't willing at this tier).
- Conflicts have no "status" column — they either exist (unresolved) or don't. When a user makes a change, affected conflicts are deleted and recomputed.
- Resolution options are computed on the fly by the application based on conflict type and involved members.
- Conflicts are shown to both the affected member and the causing member (when applicable). Both see all possible resolution options so they can coordinate. For `min_buddies_failure`, the conflict is shown to the affected member and all members whose willingness affects the constraint.

### `window_ranking`

Scored N-day windows for the group. Regenerated when N-days changes or the algorithm re-runs.

| Column       | Type        | Constraints                       | Description                                                |
| ------------ | ----------- | --------------------------------- | ---------------------------------------------------------- |
| `id`         | `uuid`      | **PK**, DEFAULT gen_random_uuid() | Unique window ID                                           |
| `group_id`   | `uuid`      | FK → `group.id`, NOT NULL         | The group                                                  |
| `start_date` | `date`      | NOT NULL                          | Window start date                                          |
| `end_date`   | `date`      | NOT NULL                          | Window end date                                            |
| `score`      | `decimal`   | NOT NULL                          | Group window score (total satisfaction - fairness penalty) |
| `selected`   | `boolean`   | NOT NULL, DEFAULT false           | Whether this window is currently selected                  |
| `created_at` | `timestamp` | DEFAULT now()                     | When ranking was computed                                  |

**Notes:**

- When window rankings are generated, the top-scoring window is automatically marked as `selected = true`.
- Users can change the selected window without re-running the algorithm.
- Only one window per group should have `selected = true` at a time.

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
              │   ├──► viable_config_member ──► viable_config ──► session
              │   │
              │   └──► conflict ──► session
              │
              └──► window_ranking

travel_time (standalone reference table)
```

---

## Application Logic Notes

These notes document conditional updates and cascading effects that the application must handle when certain actions are taken. Important to keep in mind during API and algorithm implementation.

### When a Member Joins (After Owner Approval)

If the group is still in `'preferences'` phase and no algorithm has run:

- No cascading effects — member is simply added with status = `'joined'`

If the group is past `'preferences'` phase (algorithm has run):

| Action                            | Tables Affected                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Set new member status             | `member` — status = `'joined'`                                                                                                   |
| Reset group for re-run            | `group` — phase → `'preferences'`                                                                                                |
| Reset existing members            | `member` — all existing members' statuses → `'preferences_set'` (preserves their preferences)                                    |
| Delete algorithm outputs          | `combo`, `combo_session`, `viable_config`, `viable_config_member`, `conflict`, `window_ranking` — delete all rows for this group |
| Reset override and excluded flags | `session_preference` — set `override_hard_buddy`, `override_min_buddies`, and `excluded` to `false` for all members              |

### When a Member Leaves

If the group is past `'preferences'` phase (algorithm has run):

| Action                                     | Tables Affected                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Delete member data                         | `member`, `buddy_constraint`, `session_preference` — delete all rows for this member                                             |
| Auto-remove from others' buddy constraints | `buddy_constraint` — delete any rows where `buddy_member_id` = leaving member                                                    |
| Flag affected members                      | `member` — members who had the leaving member as a buddy: status → `'joined'`, `preference_step` → `'buddies_budget'`            |
| Set unaffected members                     | `member` — members with no buddy connection to leaving member: status → `'preferences_set'`                                      |
| Reset group for re-run                     | `group` — phase → `'preferences'`                                                                                                |
| Delete algorithm outputs                   | `combo`, `combo_session`, `viable_config`, `viable_config_member`, `conflict`, `window_ranking` — delete all rows for this group |
| Reset override and excluded flags          | `session_preference` — set `override_hard_buddy`, `override_min_buddies`, and `excluded` to `false` for all remaining members    |

**Note:** Affected members (those who had the leaving member as a hard or soft buddy) go to `joined` with `preference_step = 'buddies_budget'` so the wizard opens on the buddy step for review. Their sport rankings and session preferences are preserved. Unaffected members go to `preferences_set` — they don't need to review anything. The owner sees a warning before approving the departure: "This will reset all generated schedules."

If the group is still in `'preferences'` phase (no algorithm has run):

| Action                                     | Tables Affected                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Delete member data                         | `member`, `buddy_constraint`, `session_preference` — delete all rows for this member                                  |
| Auto-remove from others' buddy constraints | `buddy_constraint` — delete any rows where `buddy_member_id` = leaving member                                         |
| Flag affected members                      | `member` — members who had the leaving member as a buddy: status → `'joined'`, `preference_step` → `'buddies_budget'` |

### When Owner Transfers Ownership

| Action       | Tables Affected                                                            |
| ------------ | -------------------------------------------------------------------------- |
| Update roles | `member` — current owner's role → `'member'`, new owner's role → `'owner'` |

No impact on algorithm outputs or group phase.

### When the Algorithm Re-Runs (Steps 4-7)

Triggered when a user changes preferences and requests schedule regeneration.

| Action                                     | Tables Affected                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Delete all algorithm outputs for the group | `combo`, `combo_session`, `viable_config`, `viable_config_member`, `conflict`, `window_ranking`                                  |
| Reset buddy override and excluded flags    | `session_preference` — set `override_hard_buddy`, `override_min_buddies`, and `excluded` to `false` for all members in the group |
| Reset all member statuses                  | `member` — set `status` to `'schedule_review_pending'` for all members in the group                                              |
| Reset group phase                          | `group` — set `phase` to `'schedule_review'`                                                                                     |

### When a User Adjusts Willingness During Conflict Resolution

| Action                                        | Tables Affected                                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Update willingness                            | `session_preference` — update `willingness_max` for the specific member + session                                                                                  |
| Recompute viable configs for affected session | Delete and regenerate `viable_config` + `viable_config_member` rows for that session                                                                               |
| Recheck all conflicts for that session        | Delete and regenerate `conflict` rows for that session across ALL members                                                                                          |
| Revoke confirmation if new conflict created   | `member` — if a new conflict is created for a member whose `status` is `'conflict_resolution_confirmed'`, set their status back to `'conflict_resolution_pending'` |

### When a User Overrides a Buddy Constraint for a Session

| Action                                        | Tables Affected                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Set override flag                             | `session_preference` — set `override_hard_buddy` or `override_min_buddies` to `true` |
| Recompute viable configs for affected session | Delete and regenerate `viable_config` + `viable_config_member` rows for that session |
| Recheck all conflicts for that session        | Delete and regenerate `conflict` rows for that session across ALL members            |
| Revoke confirmation if new conflict created   | `member` — same revocation logic as willingness adjustment                           |

### When a User Removes a Session From Their Schedule

| Action                                      | Tables Affected                                                                                                                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Soft-exclude session preference             | `session_preference` — set `excluded = true` for this member + session (preference data preserved for re-generation)                                                                                                       |
| Remove session from combos                  | `combo_session` — delete rows where `session_id` matches for the member's combos                                                                                                                                           |
| Recalculate combo scores (self)             | `combo` — update `score` for the removing member's affected combos (score is sum of remaining session scores)                                                                                                              |
| Recalculate combo scores (others)           | `combo` — for other members who had the removing member as a soft buddy AND have this session in their combos, recalculate the session's score (soft buddy bonus decreases by 1) and update their combo scores accordingly |
| De-duplicate combos                         | `combo` + `combo_session` — if a backup combo becomes identical to primary or another backup after removal, delete the duplicate combo                                                                                     |
| Remove user from viable configs             | Delete and regenerate `viable_config` + `viable_config_member` rows for that session (member is effectively removed from all price tiers)                                                                                  |
| Recheck all conflicts for that session      | Delete and regenerate `conflict` rows for that session across ALL members (may create new conflicts for other members whose buddy constraints now fail)                                                                    |
| Revoke confirmation if new conflict created | `member` — same revocation logic                                                                                                                                                                                           |

**Note:** Session removal during conflict resolution is a soft exclusion — the `session_preference` row is preserved with `excluded = true`. This allows the session to be reconsidered during schedule re-generation (the `excluded` flag is reset to `false` alongside override flags). Permanent removal of a session preference only happens through the preference wizard (Step 3).

### When a User Confirms Their Schedule (Conflict Resolution)

| Action                         | Tables Affected                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Update member status           | `member` — set `status` to `'conflict_resolution_confirmed'`                                                       |
| Check if all members confirmed | If all members in the group have `status = 'conflict_resolution_confirmed'`, update `group.phase` to `'completed'` |

### When N-Days or Date Range Changes

Can happen at any point. Date config can be set during group creation or later. **Owner only.**

| Action                                       | Tables Affected                                                                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Update group settings                        | `group` — update `date_mode`, `consecutive_days`, `start_date`, `end_date`                                                              |
| Regenerate window rankings (if combos exist) | Delete and regenerate `window_ranking` rows for the group. Only possible after algorithm has run (combos must exist to compute scores). |
| Auto-select top window                       | `window_ranking` — set `selected = true` on the highest-scoring window                                                                  |

### When a User Switches the Selected Window

| Action           | Tables Affected                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Update selection | `window_ranking` — set `selected = false` on the previously selected window, `selected = true` on the new one |

### Computed-at-Display-Time Fields (No Storage Needed)

These values are derived from stored data and computed when rendering the UI, not stored in the database:

- **Window rank** — derived from `window_ranking.score` ordering
- **Ticket count per viable config** — COUNT of `viable_config_member` rows
- **Budget impact summary** — sum of `willingness_max` from `session_preference` for sessions in primary combos within the selected window, compared against `member.budget`. Only available once a window is selected (`completed` phase).
- **Buddy status display** — computed from `buddy_constraint` + `combo_session` overlap between members
- **Rest days** — absence of a `combo` row for a member on a given day implies rest day
- **Combo tie-breaking** — computed from `combo_session` count + session scores, not stored
- **Conflict resolution options** — computed from conflict type + involved members' preferences

---

## Key Design Decisions Summary

| Decision                                   | Choice                                                                    | Rationale                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| No separate setup phase                    | Group starts in `preferences` on creation                                 | Members can immediately join and enter preferences; owner gates generation, which is the real checkpoint                           |
| Group owner role                           | `member_role_enum` on member table                                        | Owner gates destructive/group-wide actions (join approval, generation, date config changes, deletion)                              |
| Date config                                | Set at creation or deferred; required before generation; owner-only edits | Encourages early agreement on dates without blocking preference input; generation validates date config exists                     |
| Join flow                                  | Request/approve with `'pending_approval'` status                          | Prevents unexpected members joining mid-process; owner confirms group composition                                                  |
| Member changes after generation            | Full re-run required                                                      | Joining or leaving changes algorithm inputs (buddy constraints, soft buddy bonuses, viable configs) for all members                |
| Budget input                               | Collected during buddies wizard step on `member` table                    | Per-group, set before session selection, lightweight enough to pair with buddy preferences                                         |
| Buddy storage                              | Join table, not JSON                                                      | Referential integrity + efficient reverse lookups                                                                                  |
| Session preferences                        | Opt-in rows only                                                          | Reduces noise, explicit user intent                                                                                                |
| Sport rankings                             | JSON array on member                                                      | Simple ordered list of strings, no relational queries needed                                                                       |
| Travel data                                | Raw minutes, not computed gaps                                            | Allows gap rule adjustments without re-seeding DB                                                                                  |
| Combo sessions                             | Join table, not JSON                                                      | Need to query "which combos contain session X?"                                                                                    |
| Viable config scope                        | Only sessions in combos (P/B1/B2)                                         | Avoids computing configs for sessions not on any calendar; cleaner conflict resolution                                             |
| Conflict visibility                        | Shown to both affected and causing members                                | Both parties need to see the situation and all resolution options to coordinate effectively                                        |
| Conflict status                            | No status column — exist or don't                                         | Conflicts are deleted + recomputed after each change                                                                               |
| Resolution options                         | Computed on the fly                                                       | Always correct by definition, no stale data                                                                                        |
| Score recalculation on removal             | Recalculate affected users' soft buddy bonuses                            | Keeps scores accurate for window ranking; trivial computational cost                                                               |
| Window selection                           | `selected` boolean on window_ranking                                      | Simple, users can switch without re-running algorithm                                                                              |
| Algorithm re-run                           | Delete + regenerate all outputs                                           | Clean slate approach, no versioning complexity                                                                                     |
| Willingness $1000+                         | NULL willingness_max                                                      | NULL = no upper limit, simplifies comparison logic                                                                                 |
| Session removal during conflict resolution | Soft-exclude (`excluded = true`), not row deletion                        | Preserves interest/willingness data so sessions can be reconsidered on re-generation; permanent removal only via preference wizard |
| Buddy overrides                            | Boolean columns on session_preference                                     | Overrides only apply to sessions with interest; no separate table needed                                                           |
| Ticket count                               | Not stored on viable_config                                               | Derivable via COUNT on viable_config_member; avoids redundancy                                                                     |

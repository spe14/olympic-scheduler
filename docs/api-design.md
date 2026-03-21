# LA 2028 Olympics Group Scheduler — API Design

## Overview

This document defines the API routes for the LA 2028 Olympics Group Scheduler (Phase 1). Routes are organized by feature area corresponding to the app's screens and workflows.

**Framework:** Next.js API Routes
**Auth:** Supabase Auth (handles signup/login directly; API routes assume authenticated user via session token)

---

## Route Conventions

- All routes are prefixed with `/api` (Next.js convention)
- `:groupId`, `:memberId`, `:sessionId` are URL parameters
- Authenticated user is inferred from the session token (no need to pass userId)
- Routes validate group phase and member status before allowing actions
- Cascading side effects (revoking confirmations, resetting statuses) are handled server-side and documented per route
- **Route nesting principle:** Routes are scoped to the resource being acted on, not the full hierarchy. Since `memberId` implies the group, member-level routes use `/api/members/:memberId/...` rather than `/api/groups/:groupId/members/:memberId/...`. Group-level routes (schedule, windows, generate) remain under `/api/groups/:groupId/...`.
- **Race condition handling:** Endpoints that check collective member states (e.g., "all members confirmed") or perform bulk transitions must use database-level transactions with appropriate locking to prevent race conditions from concurrent requests.

---

## Seed Data

These endpoints serve pre-loaded reference data. Cacheable on the frontend.

### `GET /api/sessions`

Returns all 795 Olympic sessions. Used by the preference wizard (Step 3) for session selection and by calendar views for display.

**Response:**

```json
{
  "sessions": [
    {
      "session_code": "GYM-WFINAL-0803",
      "sport": "Gymnastics",
      "venue": "Crypto.com Arena",
      "zone": "DTLA Zone",
      "session_date": "2028-08-03",
      "session_type": "Final",
      "session_description": "Women's All-Around Final",
      "start_time": "19:00",
      "end_time": "21:30"
    }
  ]
}
```

**Notes:**

- Can be cached aggressively on the frontend — this data never changes.
- Frontend filters by sport locally using the user's sport_rankings from Step 2.

### `GET /api/travel-times`

Returns the full zone-to-zone travel time matrix (18×18 = 324 rows). Used by the frontend to display estimated travel times between sessions in the session detail modal.

**Response:**

```json
{
  "travel_times": [
    {
      "origin_zone": "DTLA Zone",
      "destination_zone": "Long Beach Zone",
      "driving_minutes": 37,
      "transit_minutes": 75
    }
  ]
}
```

**Notes:**

- Can be cached aggressively — this data never changes.
- `transit_minutes` may be null if no transit route is available for that zone pair.
- The algorithm uses this data server-side for gap computation during combo generation — the frontend uses it only for display purposes (e.g., "35 min drive from previous session").

---

## Groups

### `GET /api/groups`

Returns all groups the current user belongs to, with summary info.

**Response:**

```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "Olympics Squad",
      "phase": "preferences",
      "member_count": 4,
      "my_status": "preferences_set",
      "created_at": "2026-01-15T10:00:00Z"
    }
  ]
}
```

### `POST /api/groups`

Create a new group. The current user is automatically added as the first member. The group starts in the `preferences` phase — members can join and begin entering preferences immediately.

**Request:**

```json
{
  "name": "Olympics Squad",
  "date_mode": "consecutive",
  "consecutive_days": 5
}
```

Or with specific dates:

```json
{
  "name": "Olympics Squad",
  "date_mode": "specific",
  "start_date": "2028-07-18",
  "end_date": "2028-07-22"
}
```

Or with deferred date config:

```json
{
  "name": "Olympics Squad",
  "date_mode": null
}
```

**Response:**

```json
{
  "id": "uuid",
  "name": "Olympics Squad",
  "invite_code": "OLYMP-X7K2",
  "phase": "preferences",
  "date_mode": "consecutive",
  "consecutive_days": 5
}
```

**Side effects:**

- Creates `group` row with phase = `'preferences'`
- Creates `member` row for the current user with status = `'joined'` and role = `'owner'`
- Generates a unique human-readable invite code
- Date config is set if provided, or left NULL if deferred

**Notes:**

- The owner can set date config at creation or defer it. If deferred (`date_mode: null`), the owner must set it before triggering schedule generation.
- Frontend presents the choice: "Set your group's attendance dates now, or defer to discuss with your group first?"

### `POST /api/groups/join`

Request to join an existing group using an invite code. Creates a pending membership that the group owner must approve.

**Request:**

```json
{
  "invite_code": "OLYMP-X7K2"
}
```

**Response:**

```json
{
  "group_id": "uuid",
  "member_id": "uuid",
  "group_name": "Olympics Squad",
  "status": "pending"
}
```

**Validation:**

- Invite code must match an existing group
- User cannot already be a member of the group (including pending)

**Side effects:**

- Creates `member` row with status = `'pending_approval'` and role = `'member'`

### `PUT /api/members/:memberId/approve`

Approve or deny a pending join request. **Owner only.**

**Request:**

```json
{
  "approved": true
}
```

**Behavior:**

- `approved: true` — sets member status from `'pending_approval'` to `'joined'`
- `approved: false` — deletes the pending member row

**Validation:**

- Current user must be the group owner
- Target member must have status = `'pending_approval'`

**Side effects:**

- If approved and group is past `'preferences'` phase (algorithm has run): triggers full re-run flow (group phase → `'preferences'`, all existing members' statuses → `'preferences_set'`, delete algorithm outputs). Frontend shows warning: "Approving this request will reset all generated schedules. The algorithm will need to be re-run after the new member sets their preferences."

---

## Group Details

### `GET /api/groups/:groupId`

Returns full group info including all members and their statuses. Used by the group dashboard and as context for other screens.

**Response:**

```json
{
  "id": "uuid",
  "name": "Olympics Squad",
  "phase": "schedule_review",
  "invite_code": "OLYMP-X7K2",
  "date_mode": "consecutive",
  "consecutive_days": 5,
  "start_date": null,
  "end_date": null,
  "members": [
    {
      "id": "member-uuid",
      "user_id": "user-uuid",
      "first_name": "Alice",
      "last_name": "Smith",
      "username": "alice_s",
      "status": "schedule_review_confirmed"
    }
  ]
}
```

### `PUT /api/groups/:groupId`

Update group settings. **Owner only for date config changes.** Any member can update the group name.

**Request:**

```json
{
  "name": "Olympics Dream Team",
  "date_mode": "consecutive",
  "consecutive_days": 5
}
```

Or for specific dates:

```json
{
  "date_mode": "specific",
  "start_date": "2028-07-18",
  "end_date": "2028-07-22"
}
```

**Notes:**

- All fields are optional — only include fields being changed.
- Date config changes (`date_mode`, `consecutive_days`, `start_date`, `end_date`) are **owner only**.
- `name` can be updated by any member.
- Changing date config does NOT automatically recompute window rankings. Rankings are computed explicitly via `POST /api/groups/:groupId/windows`.

**Validation:**

- Date config changes: current user must be the group owner
- `consecutive_days` must be between 1 and 19 (if provided)
- Specific dates must fall within the Olympic period (if provided)

### `DELETE /api/groups/:groupId`

Delete the group entirely. **Owner only.** Frontend shows confirmation modal.

**Validation:**

- Current user must be the group owner

**Side effects:**

- Deletes all related data: members, buddy constraints, session preferences, all algorithm outputs (combos, window rankings)

### `DELETE /api/members/:memberId`

Leave the group (remove yourself). The `:memberId` must belong to the current user.

**Validation:**

- Member can only remove themselves, not other members
- If member is the owner, they must designate a new owner first (see `PUT /api/members/:memberId/transfer-ownership`)

**Side effects:**

- Deletes `member` row and all associated data (buddy constraints, session preferences)
- Auto-removes leaving member from other members' buddy constraints
- If group is past `'preferences'` phase (algorithm has run):
  - Members who had leaving member as a buddy: status → `'joined'`, `preference_step` → `'buddies'` (other preferences preserved)
  - Members with no buddy connection: status → `'preferences_set'`
  - Group phase → `'preferences'`
  - All algorithm outputs deleted
- Frontend shows warning: "Leaving will reset generated schedules. Members with buddy connections to you will need to review their preferences."

### `PUT /api/members/:memberId/transfer-ownership`

Transfer group ownership to another member. **Owner only.** Must be done before the owner can leave the group.

**Request:**

```json
{
  "new_owner_member_id": "uuid"
}
```

**Validation:**

- Current user must be the group owner
- Target member must be an active member of the group (not pending)

**Side effects:**

- Sets current member's role to `'member'`
- Sets target member's role to `'owner'`

---

## Preferences

### `GET /api/members/:memberId/preferences`

Returns saved preferences for a member. Used to populate the preference wizard when resuming, and for read-only reference during later phases.

**Response:**

```json
{
  "preference_step": "sport_rankings",
  "buddy_constraints": [
    { "buddy_member_id": "uuid", "type": "hard" },
    { "buddy_member_id": "uuid", "type": "soft" }
  ],
  "sport_rankings": ["Gymnastics", "Swimming", "Track"],
  "session_preferences": [
    {
      "session_id": "GYM-WFINAL-0803",
      "interest": "high"
    }
  ]
}
```

**Notes:**

- `preference_step` indicates which wizard step the user last completed (`'buddies'`, `'sport_rankings'`, or `'sessions'`). Used by the frontend to show "continue where you left off."
- If user hasn't started, returns empty/default values with `preference_step: null`.
- This endpoint is available at **any group phase** for read-only viewing. Editing is restricted to the preference wizard (PUT route below), which requires the `preferences` phase.

### `PUT /api/members/:memberId/preferences`

Save preferences for a specific wizard step. Each call saves the data for one step and updates `preference_step`. The user can save any step independently — they don't have to proceed linearly. When the final step (`sessions`) is saved, the member's status automatically transitions to `preferences_set`.

**Request:**

```json
{
  "preference_step": "buddies",
  "buddy_constraints": [
    { "buddy_member_id": "uuid", "type": "hard" },
    { "buddy_member_id": "uuid", "type": "soft" }
  ],
  "sport_rankings": ["Gymnastics", "Swimming", "Track"],
  "session_preferences": [
    {
      "session_id": "GYM-WFINAL-0803",
      "interest": "high"
    }
  ]
}
```

**Notes:**

- Only include fields relevant to the current step. For example, saving the `buddies` step only requires `preference_step` and `buddy_constraints`.
- `preference_step` is required on every call — it indicates which step is being saved.
- Users can navigate to any step and save it without re-saving earlier steps. This supports the re-enter preferences flow where a user only wants to change one thing.

**Behavior:**

- Saves the data for the specified step and updates `member.preference_step`
- If `preference_step = 'sessions'`: member status transitions from `'joined'` to `'preferences_set'`
- If `preference_step` is `'buddies'` or `'sport_rankings'`: member status stays `'joined'`

**Side effects:**

- `buddies` step: upserts `buddy_constraint` rows (deletes old ones, inserts new ones), updates `member.min_buddies`
- `sport_rankings` step: updates `member.sport_rankings`
- `sessions` step: upserts `session_preference` rows (deletes removed ones, inserts/updates new ones)
- On status transition to `'preferences_set'`: if this member was re-entering preferences after an algorithm run, the group phase and other members' statuses were already reset when the member first re-entered (see state transitions doc)

**Validation:**

- `preference_step` is required
- Group phase must be `preferences` (or member must be in `joined` status during re-entry)
- When saving `buddies` step: at least `min_buddies` must be provided
- When saving `sessions` step: buddy constraints, sport rankings, and at least one session preference must exist (either from this request or previously saved)
- `buddy_member_id` must be a valid member in the same group
- Sport rankings limited to 10 sports max

---

## Algorithm Generation

### `POST /api/groups/:groupId/generate`

Trigger schedule generation (algorithm Steps 4-7). **Owner only.** Frontend shows a two-step confirmation:

1. If date config is not set: block with "Please set your group's date configuration before generating schedules."
2. If date config is set: show confirmation — "You're about to generate schedules for [N] members. Has the group agreed on [5 consecutive days / July 18-22]? To prevent coordination efforts later, please ensure agreement. The dates can still be updated later if needed."

**Validation:**

- Current user must be the group owner
- All members (excluding pending) must have status = `'preferences_set'`
- No pending join requests (owner should approve/deny all requests first)
- Group phase must be `'preferences'`
- Date config must be set (`date_mode` is not null)

**Side effects:**

- Deletes any existing algorithm outputs for the group (combos, window rankings)
- Resets all buddy override flags and excluded flags on session_preference to `false` (previously excluded sessions are reconsidered)
- Runs the algorithm: filter sessions, apply constraints, generate combos, compute window rankings
- Sets all member statuses to `'schedule_review_pending'`
- Sets group phase to `'schedule_review'`

**Response:**

```json
{
  "success": true,
  "phase": "schedule_review",
  "members_with_no_combos": []
}
```

**Error cases:**

- A member has no valid combos across all days → returned in `members_with_no_combos` with a message suggesting they adjust preferences

---

## Individual Calendar & Schedule

### `GET /api/members/:memberId/schedule`

Returns the member's combos and sessions for the calendar view. This is the lightweight call for rendering the calendar.

**Response:**

```json
{
  "member_status": "schedule_review_pending",
  "schedule": [
    {
      "date": "2028-07-18",
      "combos": [
        {
          "id": "combo-uuid",
          "rank": "primary",
          "score": 5.2,
          "sessions": [
            {
              "session_code": "GYM-WFINAL-0803",
              "sport": "Gymnastics",
              "session_description": "Women's All-Around Final",
              "zone": "DTLA Zone",
              "start_time": "10:00",
              "end_time": "12:00"
            }
          ]
        },
        {
          "id": "combo-uuid",
          "rank": "backup1",
          "score": 4.1,
          "sessions": [...]
        }
      ]
    }
  ]
}
```

**Notes:**

- Returns combos for ALL 19 Olympic days (not just the selected window), since window selection happens later.
- Days with no combos are omitted (frontend infers rest day).

### `GET /api/groups/:groupId/sessions/:sessionId`

Returns detailed info for a specific session within the context of a group. Loaded on demand when a user clicks into a session on the calendar.

**Response:**

```json
{
  "session_code": "GYM-WFINAL-0803",
  "sport": "Gymnastics",
  "session_description": "Women's All-Around Final",
  "zone": "DTLA Zone",
  "session_date": "2028-07-18",
  "start_time": "10:00",
  "end_time": "12:00",
  "venue": "Crypto.com Arena",
  "members_attending": [
    {
      "member_id": "uuid",
      "first_name": "Alice",
      "last_name": "Smith",
      "username": "alice_s",
      "interest": "high",
      "in_combos": ["primary", "backup1"]
    }
  ]
}
```

**Notes:**

- This endpoint serves both individual and group calendar views.
- `members_attending` shows all members interested in this session with their preferences and which combos include this session for them.

---

## Member Status Updates

### `PUT /api/members/:memberId/status`

Update a member's status. This single endpoint handles all member status transitions: satisfaction check, schedule confirmation, and re-entering preferences.

**Request:**

```json
{
  "status": "schedule_review_confirmed"
}
```

**Valid Transitions:**

| From                        | To                          | When                 | Side Effects                                                                              |
| --------------------------- | --------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `schedule_review_pending`   | `schedule_review_confirmed` | Confirm schedule     | If ALL members reach `schedule_review_confirmed` → group → `completed`                    |
| `schedule_review_confirmed` | `schedule_review_pending`   | Revoke confirmation  | Only while group is `schedule_review`                                                     |
| Any (post-generation)       | `joined`                    | Re-enter preferences | Group → `preferences`, all OTHER members → `preferences_set`, algorithm outputs preserved |

**Validation:**

- Transition must be in the valid transitions table above
- For `→ joined` (re-enter preferences): frontend shows warning "This will reset everyone's schedules and require regeneration"

**Race condition handling:** The "all members confirmed" check (triggering group → `completed`) must be performed within a database transaction with row-level locking on the group's member rows to prevent concurrent confirmations from both triggering the transition.

**Response:**

```json
{
  "member_status": "schedule_review_confirmed",
  "group_phase": "completed"
}
```

---

## Group Calendar & Window Selection

### `GET /api/groups/:groupId/schedule`

Returns all members' combos and sessions for the group calendar view.

**Response:**

```json
{
  "group_phase": "completed",
  "selected_window": {
    "start_date": "2028-07-18",
    "end_date": "2028-07-22"
  },
  "days": [
    {
      "date": "2028-07-18",
      "sessions": [
        {
          "session_code": "GYM-WFINAL-0803",
          "sport": "Gymnastics",
          "session_description": "Women's All-Around Final",
          "zone": "DTLA Zone",
          "start_time": "10:00",
          "end_time": "12:00",
          "members_primary": [
            {
              "member_id": "uuid",
              "first_name": "Alice",
              "last_name": "Smith",
              "username": "alice_s"
            },
            {
              "member_id": "uuid",
              "first_name": "Bob",
              "last_name": "Jones",
              "username": "bob_j"
            }
          ],
          "members_backup": [
            {
              "member_id": "uuid",
              "first_name": "Alice",
              "last_name": "Smith",
              "username": "alice_s"
            },
            {
              "member_id": "uuid",
              "first_name": "Carol",
              "last_name": "Davis",
              "username": "carol_d"
            }
          ]
        }
      ]
    }
  ]
}
```

**Notes:**

- Sessions are aggregated across all members — each session appears once with lists of who's attending.
- A member can appear in both `members_primary` and `members_backup` if the session is in their primary combo and also in a backup combo. The frontend can check for overlap to display this (e.g., with an asterisk).
- `selected_window` is null if window selection hasn't happened yet.
- Session detail is available via the individual session endpoint for more info.

### `POST /api/groups/:groupId/windows`

Compute window rankings based on the group's date configuration and finalized combo scores. This is an explicit trigger, similar to `POST /generate` for the algorithm. **Owner only.**

**Validation:**

- Current user must be the group owner
- Group phase must be `'completed'` (all members confirmed, combo scores finalized)
- Date config (`date_mode` + `consecutive_days` or `start_date`/`end_date`) must be set on the group

**Side effects:**

- Deletes existing window rankings for the group
- Computes and inserts new window rankings using finalized combo scores
- Auto-selects the top-scoring window (`selected = true`)

**Response:**
Returns the computed window rankings (same shape as GET below).

### `GET /api/groups/:groupId/windows`

Returns existing window rankings. Used when returning to the page after rankings have already been computed.

**Response:**

```json
{
  "date_mode": "consecutive",
  "consecutive_days": 5,
  "windows": [
    {
      "id": "window-uuid",
      "start_date": "2028-07-18",
      "end_date": "2028-07-22",
      "score": 48.5,
      "selected": true
    },
    {
      "id": "window-uuid",
      "start_date": "2028-07-19",
      "end_date": "2028-07-23",
      "score": 45.2,
      "selected": false
    }
  ]
}
```

**Notes:**

- Windows are returned sorted by score descending (rank 1 = highest score).
- Rank is not stored — it's the display order.
- `windows` array is empty if rankings haven't been computed yet.

### `PUT /api/groups/:groupId/windows/:windowId/select`

Switch the selected window. **Owner only.**

**Side effects:**

- Sets `selected = false` on the previously selected window
- Sets `selected = true` on the new window

**Validation:**

- Current user must be the group owner
- Window must belong to the group
- Group phase must be `'completed'`

---

## Route Summary

| Method                       | Path                                            | Description                                                       | Group Phase      | Owner Only |
| ---------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- | ---------------- | ---------- |
| **Seed Data**                |                                                 |                                                                   |                  |            |
| GET                          | `/api/sessions`                                 | All Olympic sessions                                              | Any              | No         |
| GET                          | `/api/travel-times`                             | Zone-to-zone travel matrix                                        | Any              | No         |
| **Groups**                   |                                                 |                                                                   |                  |            |
| GET                          | `/api/groups`                                   | List user's groups                                                | Any              | No         |
| POST                         | `/api/groups`                                   | Create a group (with optional date config)                        | —                | —          |
| POST                         | `/api/groups/join`                              | Request to join via invite code                                   | Any              | No         |
| GET                          | `/api/groups/:groupId`                          | Group details + members                                           | Any              | No         |
| PUT                          | `/api/groups/:groupId`                          | Update group settings (name: any member; date config: owner only) | Any              | Partial    |
| DELETE                       | `/api/groups/:groupId`                          | Delete group                                                      | Any              | **Yes**    |
| **Members**                  |                                                 |                                                                   |                  |            |
| PUT                          | `/api/members/:memberId/approve`                | Approve/deny join request                                         | Any              | **Yes**    |
| PUT                          | `/api/members/:memberId/transfer-ownership`     | Transfer ownership                                                | Any              | **Yes**    |
| DELETE                       | `/api/members/:memberId`                        | Leave group                                                       | Any              | No         |
| **Preferences**              |                                                 |                                                                   |                  |            |
| GET                          | `/api/members/:memberId/preferences`            | Get saved preferences (read-only)                                 | Any              | No         |
| PUT                          | `/api/members/:memberId/preferences`            | Save/submit preferences                                           | preferences      | No         |
| **Algorithm**                |                                                 |                                                                   |                  |            |
| POST                         | `/api/groups/:groupId/generate`                 | Run schedule generation                                           | preferences      | **Yes**    |
| **Individual Calendar**      |                                                 |                                                                   |                  |            |
| GET                          | `/api/members/:memberId/schedule`               | Member's combos + sessions                                        | schedule_review+ | No         |
| GET                          | `/api/groups/:groupId/sessions/:sessionId`      | Session detail (members attending)                                | schedule_review+ | No         |
| **Member Status**            |                                                 |                                                                   |                  |            |
| PUT                          | `/api/members/:memberId/status`                 | Update member status (confirm, re-enter prefs)                    | schedule_review+ | No         |
| **Group Calendar & Windows** |                                                 |                                                                   |                  |            |
| GET                          | `/api/groups/:groupId/schedule`                 | Group calendar (all members)                                      | schedule_review+ | No         |
| POST                         | `/api/groups/:groupId/windows`                  | Compute window rankings                                           | completed        | **Yes**    |
| GET                          | `/api/groups/:groupId/windows`                  | Get existing rankings                                             | schedule_review+ | No         |
| PUT                          | `/api/groups/:groupId/windows/:windowId/select` | Switch selected window                                            | completed        | **Yes**    |

---

## Design Decisions

| Decision                            | Choice                                                                               | Rationale                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No separate setup phase             | Group starts in `preferences`; members join and enter preferences immediately        | Owner gates generation (the real checkpoint); eliminates unnecessary ceremony step                                                                                           |
| Group owner role                    | Owner gates destructive/group-wide actions                                           | Prevents accidental disruption; owner approves joins, triggers generation, manages date config, deletes group                                                                |
| Date config at creation or deferred | Owner sets dates at creation or defers; required before generation; owner-only edits | Flexible — owner can discuss with group first; generation validation ensures dates are set; warning encourages agreement                                                     |
| Join flow                           | Request/approve pattern                                                              | Prevents unexpected members joining mid-process; owner confirms group is complete before generation                                                                          |
| Budget input                        | Global, on user table. Set in user settings, not per-group.                          | Mirrors the 12-ticket limit: a global setting. Doesn't affect algorithm. Editable anytime.                                                                                   |
| Preference viewing                  | GET available at any phase; PUT restricted to `preferences`                          | Users can reference their preferences during later phases without risk of accidental edits                                                                                   |
| Preference submission               | Step-by-step save with independent step navigation                                   | Each wizard step saves independently; users can navigate to any step without re-saving earlier steps; saving the sessions step triggers status transition to preferences_set |
| Algorithm trigger                   | Explicit POST, not auto-trigger                                                      | Allows members to discuss preferences before generating; prevents premature runs                                                                                             |
| Calendar data loading               | Two-tier (calendar GET + session detail GET)                                         | Fast calendar rendering; load details on demand                                                                                                                              |
| Individual vs group schedule        | Separate endpoints                                                                   | Different response shapes optimized for each view                                                                                                                            |
| Window computation                  | Explicit POST trigger (owner only), separate from date config                        | Date config changes don't auto-recompute; rankings computed explicitly at `completed` phase                                                                                  |
| Window selection                    | Owner only                                                                           | Consistent with owner gating group-wide decisions; group discusses, owner executes                                                                                           |
| Travel times                        | Separate cacheable endpoint                                                          | Frontend caches the full 18×18 matrix; used for display in session detail modal                                                                                              |
| Auth                                | Supabase Auth (no custom routes)                                                     | Handles signup/login/sessions; app creates user record via post-signup hook                                                                                                  |
| Race conditions                     | Database transactions with row-level locking for bulk transitions                    | Prevents concurrent confirmations from both triggering the same bulk move; ensures cascade effects are atomic                                                                |

---

## Notes on Phase Gating

API routes validate the group phase before allowing actions. This prevents stale operations (e.g., modifying preferences after the algorithm has run without going through the re-run flow).

**Group phases:**

```
preferences → schedule_review → completed
```

- **`preferences`** — Group created, members joining and inputting preferences (Steps 1-3). This is the initial phase. Members can join at any time; the owner triggers generation when all members are ready.
- **`schedule_review`** — Members review generated schedules and confirm satisfaction. All members confirming moves the group to `completed`.
- **`completed`** — All members confirmed. Window rankings computed and window selected here.

The group phase is the primary gate. Member status provides additional per-member validation within a phase.

When a member re-enters preferences (goes back to the preference wizard after schedules are generated):

- That member's status → `'joined'`
- All other members' statuses → `'preferences_set'` (preferences preserved, but blocked from schedule actions)
- Group phase → `'preferences'`
- Old algorithm outputs remain until `/generate` is called again

This ensures no one is acting on stale data while one member is editing preferences.

For the full state transition specification, see `state-transitions.md`.

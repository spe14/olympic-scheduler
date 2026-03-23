# End-to-End Flow — Decision Tree

Traces every user action from first visit through schedule generation and purchasing. Each section shows what the user can do, what the system does, and what can go wrong.

---

## 1. Account Creation

### Sign Up

**User provides:** first name, last name, username, email, password

**Validation:**

- Username must be unique
- Password: min 8 chars

**System:**

- Creates Supabase auth user
- Inserts `users` row (authId, email, username, firstName, lastName, avatarColor = "blue")
- Redirects to home `/`

**Errors:**

- Username taken → rejected
- Email already registered → rejected
- Weak password → rejected client-side

### Login

**User provides:** email, password → Supabase `signInWithPassword()` → redirect to `/`

**Errors:**

- Wrong credentials → error message
- No account → error message

### Auth Guard

All pages under `/(main)/` call `getCurrentUser()`. If no session → redirect to `/login`.

---

## 2. Home Page (Post-Login)

User sees three sections:

- **Groups You Own** — groups where `role = "owner"` and status is active
- **Joined Groups** — groups where `role = "member"` and status is active
- **Pending Requests** — groups where `status = "pending_approval"` or `"denied"`

**Empty state:** buttons to "Create a Group" or "Join with Invite Code"

---

## 3. Group Creation

**User provides:**

- Group name (1–50 chars)
- Date mode (one of):
  - Consecutive Days → how many (1–19)
  - Specific Dates → start and end dates
  - Decide Later → null

**System:**

- Generates 8-char invite code (`crypto.randomBytes(4).toString("hex")`)
- Inserts `groups` row: `phase = "preferences"`, date config, invite code
- Inserts `member` row: `role = "owner"`, `status = "joined"`, `joinedAt = now()`
- Owner lands on group overview

---

## 4. Joining a Group

### Request to Join

**User provides:** 8-char invite code

**System checks:**

```
Is invite code valid?
├─ NO → "Group not found"
└─ YES → Does user already have a membership?
     ├─ status = "pending_approval" → "You already have a pending request"
     ├─ status = "joined" or "preferences_set" → "You are already a member"
     ├─ status = "denied" → Reset to "pending_approval" (re-request)
     └─ No existing membership → Check group capacity
          ├─ ≥ 12 active members → "Group is full"
          └─ < 12 → Insert member: role = "member", status = "pending_approval"
```

User now sees group in "Pending Requests" on home page.

### Owner Approves / Denies

Owner sees pending members in group overview.

**Approve:**

- Sets `status = "joined"`, `joinedAt = now()`
- If member was previously departed → matches by `userId` in `group.departedMembers`
  and marks `rejoinedAt`
- Checks group capacity before approving

**Deny:**

- Sets `status = "denied"`
- Denied user can re-request via the same invite code

---

## 5. Group Overview

Shows group state, members, and available actions based on role and phase.

### Owner Actions

- Approve/deny pending members
- Update group name
- Update date configuration (can trigger window ranking recomputation)
- Remove members
- Transfer ownership
- Generate schedules (when conditions are met)

### Member Actions

- Leave group
- View member list and group state

### Member Removal / Departure

When a member leaves or is removed:

```
1. Delete all buddy_constraint rows involving this member
2. Delete all session_preference rows for this member
3. Track affected buddies:
     group.affectedBuddyMembers[affectedMemberId] = [...existing, "departed name"]
4. If schedule was previously generated AND departing member was part of it
   (joinedAt ≤ scheduleGeneratedAt):
     ├─ Delete combos, comboSessions, windowRankings
     ├─ Reset all remaining active members to status = "preferences_set"
     ├─ Record in group.departedMembers [{userId, name, departedAt}]
     └─ group.phase → "preferences"
   If schedule was previously generated but departing member joined AFTER
   the last generation:
     └─ No algorithm output changes (schedule remains valid without them)
5. Delete the member row (FK cascades clean up remaining references)
```

**Consequence:** Affected buddy members must confirm review before regeneration is allowed.

**Note on purchase data:** When a member row is deleted, FK cascades delete their
ticket purchases (and associated assignee rows), sold-out reports, out-of-budget marks,
purchase plan entries, and timeslots. If the departing member was a ticket buyer,
assignees of those purchases lose their locked session status on the next regeneration.
Members with purchase data see a warning before leaving, advising them to transfer
ticket purchases to other members first.

### Navigation Tab Warnings

All schedule-dependent tabs (My Schedule, Group Schedule, Purchase Planner & Tracker) show
a warning icon with tooltip "Schedules have not been generated yet." when not in
`schedule_review` phase. This is the highest-priority warning — it takes precedence over
all other tab-specific warnings (e.g., missing timeslot, missing date config).

---

## 6. Preference Wizard

Available once member `status = "joined"`. Four sequential steps.

### Step 0 — Buddies

**User actions:**

- Set `minBuddies` (0 to number of other active members)
- Tag each member as Required (hard), Preferred (soft), or None

**Validation:**

- Cannot select yourself as buddy
- Cannot set minBuddies > number of other active members
- minBuddies must be ≥ count of hard buddies

**System:**

- Replaces all `buddy_constraint` rows for this member
- Updates `member.minBuddies` and `member.preferenceStep`
- Clears member from `group.affectedBuddyMembers` if present
- Updates `member.statusChangedAt`

**Edge case — schedule already generated:**

- Warning modal appears: "Changes require regeneration"
- User cancels → reverts to saved state
- User proceeds → `ackScheduleWarning()`, then saves normally

**Constraint semantics:**

- **Required (hard):** "I will only attend a session if this member is also attending."
  One-directional — Alice requiring Bob does not force Bob to require Alice.
  The algorithm ensures Alice's primary combo only contains sessions where Bob has
  the session in at least one of his combos (P/B1/B2). Bob may have additional
  sessions that Alice doesn't.
- **Preferred (soft):** "I would like to attend sessions with this member, but it's
  not a dealbreaker." Not enforced — only boosts scoring via a multiplier.
- **minBuddies:** "Minimum number of group members I want at each session."
  Sessions with fewer interested members are filtered out.

### Step 1 — Sport Rankings

**User actions:**

- Drag-to-sort 1–10 sports into priority order

**System:**

- Saves `member.sportRankings`
- **Cascade:** deletes all `session_preference` rows for sports no longer ranked
- Updates `preferenceStep` and `statusChangedAt`

**Edge case:**

- Removing a ranked sport silently deletes its session preferences

### Step 2 — Session Interests

**User actions:**

- Select sessions from ranked sports only
- Rate each: High / Medium / Low interest
- Must select ≥ 1 session

**System:**

- Replaces all `session_preference` rows for this member
- Sets `member.status = "preferences_set"` (generation gate)
- Updates `statusChangedAt`

### Step 3 — Review

**User actions:**

- Read-only summary of buddies, sports, sessions
- If in `group.affectedBuddyMembers` → confirm review button appears

**System:**

- `confirmAffectedBuddyReview()` removes member from `affectedBuddyMembers`
- No data changes

### Dirty State Guard

Each step tracks unsaved changes. If the user has unsaved edits:

- In-app navigation (clicking sidebar, back/forward) → confirmation modal before leaving
- Browser refresh / tab close → browser `beforeunload` prompt
- Leaving the group → blocked until changes are saved or discarded

---

## 7. Schedule Generation

### Pre-Generation Guards

Generation is blocked if ANY of these fail:

| Guard                                                 | Error                                   |
| ----------------------------------------------------- | --------------------------------------- |
| Caller is not group owner                             | Auth error                              |
| `group.phase` not in `[preferences, schedule_review]` | Phase error                             |
| `group.affectedBuddyMembers` is non-empty             | "All affected members must review"      |
| Any active member has `status ≠ preferences_set`      | "All members must have preferences set" |

### Data Assembly

All queries scoped to the group. Each is per-member unless noted.

```
1. buddyConstraints        → hard/soft buddy lists per member
2. sessionPreferences      → joined with session table for metadata
3. travelTimes             → all zone-to-zone pairs (global, not per-group)
4. soldOutSessions         → group-wide set of session codes
5. outOfBudgetSessions     → per-member sets of session codes
6. purchaseAssignees       → per-member locked session codes (from ticketPurchaseAssignee)
7. sessionMetadataMap      → session metadata from all preferences + DB query for locked
                              codes not in any member's preferences (orphan locked codes)
```

### Candidate Session Assembly (per member)

```
Start with: member's session preferences (from step 2)
  │
  ├─ Filter: is session sold out?
  │    ├─ YES and member has purchased ticket (locked) → KEEP
  │    └─ YES and member has NOT purchased → EXCLUDE (reason: soldOut)
  │
  ├─ Filter: is session out-of-budget for this member?
  │    ├─ YES and member has purchased ticket (locked) → KEEP
  │    └─ YES and member has NOT purchased → EXCLUDE (reason: outOfBudget)
  │
  └─ Result: candidateSessions[]

Then: inject locked sessions missing from THIS member's preferences
  │
  └─ For each of this member's locked codes not already in candidateSessions:
       look up session metadata from sessionMetadataMap, add with interest = "high"

Side effect: store excluded sessions per member with reason
  → { code, soldOut: bool, outOfBudget: bool }
  → saved to member.excludedSessionCodes after generation
```

**Scoping rules:**

- `soldOut` is group-wide — if ANY member marks sold out, excluded for ALL (unless that member has tickets)
- `outOfBudget` is per-member — only affects the member who marked it
- `locked` is per-member — determined by `ticketPurchaseAssignee.memberId`, not the buyer
- Another member's purchased session does NOT appear on your schedule unless you independently expressed interest in it

---

### Algorithm Execution

#### Input

- `MemberData[]` — one per active member:
  - `sportRankings`, `minBuddies`, `hardBuddies`, `softBuddies`
  - `candidateSessions` (filtered, with locked injected)
  - `lockedSessionCodes` (purchased sessions for this member)
- `TravelEntry[]` — zone-to-zone driving times
- `days[]` — 19 Olympic days (2028-07-12 through 2028-07-30)

#### Convergence Loop (max 5 iterations)

```
for iteration = 1 to 5:
  │
  ├─ 1. Build sessionInterestCounts
  │     Count how many members have each session in their candidates
  │
  ├─ 2. FILTER PASS (per member)
  │     │
  │     ├─ Separate locked sessions (bypass all filters)
  │     ├─ Apply hardBuddyFilter to unlocked:
  │     │    Keep only sessions that ALL hard buddies also have as candidates
  │     ├─ Apply minBuddiesFilter to unlocked:
  │     │    Keep only sessions where (interested member count - 1) ≥ member's minBuddies
  │     └─ Result: locked ∪ filtered_unlocked
  │
  ├─ 3. COMBO GENERATION (per member, per day)
  │     │
  │     ├─ Group filtered sessions by day
  │     ├─ For each day with sessions:
  │     │    │
  │     │    ├─ Separate locked vs unlocked for this day
  │     │    ├─ If locked fills all 3 slots → only one possible combo
  │     │    │    (no cap on locked count — 4+ locked sessions all go in one combo)
  │     │    ├─ Otherwise → generate all subsets of unlocked (size 1 to remaining slots)
  │     │    │    Prepend locked sessions to each subset
  │     │    │    Also include locked-only combo as fallback
  │     │    │
  │     │    ├─ TRAVEL FEASIBILITY CHECK
  │     │    │    Sort sessions by start time, check gap between each consecutive pair:
  │     │    │    │
  │     │    │    ├─ Same zone → need 90 min gap
  │     │    │    ├─ To/from Trestles Beach → need 240 min gap
  │     │    │    ├─ Driving < 15 min → 90 min
  │     │    │    ├─ Driving < 30 min → 120 min
  │     │    │    ├─ Driving < 45 min → 150 min
  │     │    │    ├─ Driving < 60 min → 180 min
  │     │    │    ├─ Driving ≥ 60 min → 210 min
  │     │    │    └─ Unknown zone pair → 210 min (safe default)
  │     │    │
  │     │    │    If no combos feasible AND locked sessions exist:
  │     │    │      → fall back to locked-only combo (travel feasibility ignored)
  │     │    │
  │     │    ├─ SCORING (per combo)
  │     │    │    combo.score = Σ sessionScore
  │     │    │
  │     │    │    sessionScore = sportMultiplier × interestAdjustment × softBuddyBonus
  │     │    │
  │     │    │    sportMultiplier: 2.0 for rank 1 → 1.0 for last rank
  │     │    │      Formula: 2.0 - ((rank-1) / (totalSports-1))
  │     │    │
  │     │    │    interestAdjustment: high = 1.0, medium = 0.7, low = 0.4
  │     │    │
  │     │    │    softBuddyBonus:
  │     │    │      0 soft buddies interested → 1.0
  │     │    │      ≥ 1 buddy interested → 1.25 + 0.1 × (count - 1)
  │     │    │
  │     │    └─ RANK ASSIGNMENT (sorted by score desc)
  │     │         ├─ Primary (P): highest score
  │     │         ├─ Backup1 (B1): next highest with ≥ 1 session not in P
  │     │         └─ Backup2 (B2): next highest with new sessions vs both P and B1
  │     │
  │     │         Tie-breaking: session count desc → sportMultiplierSum desc → alphabetical
  │     │
  │     └─ If member has 0 combos across all days → added to membersWithNoCombos
  │
  ├─ 4. POST-GENERATION VALIDATION
  │     Check PRIMARY combos only. For each session:
  │     │
  │     ├─ Skip if locked (purchased) → no constraint checks
  │     │
  │     ├─ minBuddies check:
  │     │    Count others with this session in ANY combo (P/B1/B2) on same day
  │     │    If count < member's minBuddies → VIOLATION
  │     │
  │     └─ hardBuddies check:
  │          Does each hard buddy have this session in ANY combo on same day?
  │          If not → VIOLATION
  │
  └─ 5. CONVERGENCE CHECK
       │
       ├─ 0 violations → RETURN SUCCESS
       │
       ├─ Violations AND iteration < 5:
       │    Prune violating sessions (NEVER prune locked)
       │    → loop back to step 1
       │
       └─ Violations AND iteration = 5:
            → RETURN PARTIAL (converged = false, violations included)
```

#### Why Validation Only Checks Primary Combos

Post-generation validation only checks primary combos because:

- The primary is the recommended schedule — violations there matter most.
- Backups are fallbacks for when things change; strict enforcement on them is unnecessary.
- The pruning mechanism is blunt: a violated session is removed from the entire
  candidate pool, not from a specific rank. Validating backups would cause collateral
  damage to primary combos by removing sessions that are perfectly valid there.
- The filter pass already provides a strong baseline for all ranks — every session in
  B1/B2 passed the hardBuddy and minBuddies filters at the candidate level.

**Guarantees (when converged):**

- Every non-locked session in a member's **primary** combo has the hard buddy in at
  least one of the buddy's combos (P/B1/B2), and meets minBuddies across all ranks.
- **Backup combos** have no such guarantee beyond the input-level filter.
- **Locked sessions** skip all constraint checks — they appear regardless.
- If convergence fails (`converged = false`), even primary guarantees don't hold.

#### Attendance Counting

The attendance map used for validation counts members across ALL combo ranks (P/B1/B2).
This means a session passes the hardBuddies check if the buddy has it in any rank —
even B2. This is intentionally lenient: stricter counting (primary-only) would cause
excessive pruning. The schedule view shows which rank each buddy has a session in,
so users can judge for themselves and adjust preferences if needed.

### Post-Generation Storage (single DB transaction)

```
1. Delete existing combos + comboSessions + windowRankings for group

2. Insert new combos (memberId, day, rank, score) + comboSession rows

3. Determine phase:
   ├─ membersWithNoCombos is non-empty → phase = "preferences"
   └─ all members have combos         → phase = "schedule_review"

4. Update group:
   - phase, scheduleGeneratedAt = now
   - purchaseDataChangedAt = null (reset)
   - departedMembers = [], affectedBuddyMembers = {}
   - membersWithNoCombos = [...ids]
   - nonConvergenceMembers = [...affected member IDs] (empty if converged)

5. Store excluded sessions per member:
   member.excludedSessionCodes = [{code, soldOut, outOfBudget}, ...]

6. If phase = "schedule_review" AND dateMode configured:
   Compute window rankings → auto-select top-ranked window
```

---

## 8. Window Ranking

Computed after successful generation if `dateMode` is set.

### Specific Date Mode

Fixed start/end → single window, single score.

### Consecutive Days Mode

Slide N-day window across 19 Olympic days.

```
windowScore = baseScore - fairnessPenalty

baseScore      = Σ (each member's total primary score across window days)
fairnessPenalty = stdev(memberScores) × memberCount × 0.5
resilience     = avg backup coverage across all member-days
                 coverage = min((b1 + b2) / (2 × primary), 1)
```

**Sort:** score desc → stdev asc → resilience desc → earlier start date

---

## 9. Schedule View

Each member sees their generated schedule grouped by day:

- **Primary** combo — best option
- **Backup1** — alternative with different sessions
- **Backup2** — second alternative

Each session shows:

- Other members scheduled for it (and in which ranks)
- Other members interested in it
- Purchase status (plan entries, actual purchases, sold-out, OOB)
- Reported prices

**Non-convergence warning:** If the algorithm couldn't fully satisfy a member's
buddy/minBuddies constraints (5 iterations exhausted), an amber warning banner
appears above their schedule advising them to adjust preferences if unsatisfied.
A matching notification also appears in the Notifications section on the overview page.

**No schedule placeholder:** If schedules have not been generated yet, a placeholder
message is shown instead of the schedule.

---

## 10. Purchase Tracking

Shows a placeholder message when schedules have not been generated yet.
Full functionality available once `phase = "schedule_review"`.

### User Actions per Session

| Action                           | Scope                         | Algorithm Effect                                                    |
| -------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Mark Sold Out                    | Group-wide                    | Excluded for ALL members next generation (unless they have tickets) |
| Unmark Sold Out                  | Group-wide                    | Re-included for all members                                         |
| Mark Out of Budget               | This member only              | Excluded for THIS member next generation (unless they have tickets) |
| Unmark Out of Budget             | This member only              | Re-included for this member                                         |
| Record Purchase (with assignees) | Per-assignee                  | Session LOCKED for each assignee — bypasses all constraints         |
| Delete Purchase                  | Per-assignee                  | Assignees lose locked status (unless other purchases exist)         |
| Report Price                     | Group-wide (informational)    | None                                                                |
| Save Purchase Plan Entry         | Per-purchaser (informational) | None                                                                |

### How Purchases Create Locked Sessions

```
ticketPurchase (buyer, session, price)
  └─ ticketPurchaseAssignee (memberId, ticketPurchaseId)
       └─ lockedByMember = Map<memberId, sessionCode[]>
```

**The buyer is NOT automatically an attendee.** Only explicit assignees get locked sessions. If Alice buys for Bob and Carol, only Bob and Carol have locked sessions — not Alice (unless she's also listed as an assignee).

### Purchase Checkmark in UI

The green checkmark on a session indicates that ANY group member has purchased tickets
for that session. This is intentionally group-wide — the purchase tracker is a group
coordination tool. The session detail shows exactly who has tickets and who still needs
them via the assignee list.

### Excluded Sessions List (Purchase Tracker)

```
excludedCodes = union of:
  ├─ Stored from last generation (member.excludedSessionCodes)
  ├─ Currently sold-out sessions NOT on this member's schedule
  └─ Currently out-of-budget sessions NOT on this member's schedule
```

Sessions already on the member's schedule are never shown as excluded.

### Purchase Data Changed Flag

These actions set `group.purchaseDataChangedAt`:

- recordPurchase, deletePurchase, removePurchaseAssignee
- markSoldOut, unmarkSoldOut, markOutOfBudget, unmarkOutOfBudget

Signals to the UI that regeneration may be beneficial.

---

## 11. Regeneration

Owner can regenerate when something changed since last generation:

- Member updated preferences (`statusChangedAt > scheduleGeneratedAt`)
- Member departed or rejoined
- Purchase data changed (`purchaseDataChangedAt` is non-null)
- Member previously had no combos but has since updated preferences

Regeneration replaces all previous combos and window rankings with fresh results.

### Schedule Warning Flow

```
Member edits preferences while phase = "schedule_review"
  → Warning modal: "Changes require regeneration"
  ├─ Cancel → reverts to saved state
  └─ Proceed → ackScheduleWarning(), save preferences
       → UI shows "regeneration needed" to owner
```

---

## Edge Case Summary

| Scenario                                              | Outcome                                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| User tries to join a full group (12 members)          | Rejected: "Group is full"                                                                                       |
| Denied user re-requests with same invite code         | Reset to `pending_approval`                                                                                     |
| Member removed while schedule exists (was part of it) | Combos deleted, phase → "preferences", all members must re-generate                                             |
| Member removed while schedule exists (joined after)   | Schedule preserved; only affected buddy tracking updated                                                        |
| Buddy member departs                                  | Remaining buddy members must confirm review before generation                                                   |
| Member rejoins after departure                        | Matched by `userId` in `departedMembers`; `rejoinedAt` set; no auto-regeneration                                |
| Removing a ranked sport                               | All session preferences for that sport silently deleted                                                         |
| Member has only locked sessions on one day            | Single combo; no backups possible                                                                               |
| 4+ locked sessions on one day                         | All go in one combo with no cap; travel feasibility ignored                                                     |
| Locked sessions travel-infeasible with unlocked       | Falls back to locked-only combo                                                                                 |
| Locked session not in member's preferences            | Injected with interest = "high"                                                                                 |
| Another member's purchased session                    | Does NOT appear on your schedule unless you independently expressed interest                                    |
| All sessions filtered by buddy constraints            | Member in `membersWithNoCombos`; phase stays "preferences"                                                      |
| Hard buddy doesn't exist in group                     | Ignored in filter (no MemberData match)                                                                         |
| 5 convergence iterations exhausted                    | Returns partial solution, `converged = false`; affected members see warning on My Schedule and in Notifications |
| Sold-out session: member A purchased, member B didn't | Kept for A (locked), excluded for B                                                                             |
| Out-of-budget session purchased by the same member    | Kept (locked overrides OOB)                                                                                     |
| Session sold out AFTER generation                     | Still on schedule, but sold-out indicator shows in purchase tracker                                             |
| Member has 0 sessions on a day                        | No combo for that day (not an error)                                                                            |
| All members have 0 combos                             | `membersWithNoCombos` = everyone; phase = "preferences"                                                         |
| `dateMode` not configured                             | Window rankings skipped                                                                                         |
| Specific date mode                                    | Single window (no sliding)                                                                                      |
| Locked sessions can prevent convergence               | If a locked session causes a violation, it persists since locked sessions are never pruned                      |
| Mutual hard buddies with divergent preferences        | Cascading pruning can strip both members' candidates; likely lands in `membersWithNoCombos`                     |
| Buyer member departs                                  | FK cascade deletes their purchases; assignees lose locked status on next regeneration                           |
| Sold-out reporter departs                             | Sold-out record persists (reporter field set to null); session stays excluded for all members                   |

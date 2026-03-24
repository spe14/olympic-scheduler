# End-to-End Test Plan — Browser Testing Before Production

Comprehensive test plan tracing every user workflow, edge case, and error path.
Each section lists the **happy path**, **validation errors**, **edge cases**, and
**concurrency scenarios** that should be verified in the browser.

> **Notation:** `[OWNER]` = test as group owner, `[MEMBER]` = test as non-owner
> member, `[GUEST]` = test while logged out. Scenarios marked `[MULTI-TAB]`
> require two browser sessions (different users or same user in incognito).

---

## 1. Authentication

### 1.1 Sign Up

**Happy path:**

- Fill all fields (firstName, lastName, username, email, password, avatarColor)
- Verify redirect to `/` after successful sign up
- Verify user row created in DB (correct authId, email, username, avatarColor)

**Validation — client-side hints appear while typing:**

- Username < 3 chars → hint shown
- Username > 30 chars → hint shown
- Username with special chars (spaces, `@`, `!`) → hint shown
- Username with uppercase → verify it's lowercased on submit
- First name / last name empty → hint shown
- First/last name > 50 chars → hint shown
- Invalid email format → hint shown
- Password < 8 chars → hint shown
- Password > 72 chars → hint shown
- No avatar color selected → button disabled or error

**Server-side errors:**

- Username already taken → error message displayed
- Email already registered → error message displayed
- Submit with all fields empty → validation errors shown

**Edge cases:**

- Sign up, then navigate to `/signup` again while logged in → should redirect to `/`
- Orphaned auth account recovery: if a previous sign-up created the Supabase auth
  user but the DB insert failed, a retry with the same email should recover
  gracefully (creates the missing DB row)

### 1.2 Login

**Happy path:**

- Enter valid email + password → redirect to `/`
- Verify session cookies set (`session_start_at`, `last_active_at`)

**Validation:**

- Empty email → hint shown
- Empty password → hint shown
- Wrong password → "Invalid email or password" (no email enumeration)
- Non-existent email → same generic error message

**Edge cases:**

- Login while already logged in → should redirect to `/`
- Navigate to `/login` while authenticated → redirect to `/`

### 1.3 Logout

- Click logout in nav bar → redirected to `/login`
- Session cookies (`session_start_at`, `last_active_at`) deleted
- Attempting to visit `/(main)/*` routes after logout → redirect to `/login`

### 1.4 Session Timeout

**Inactivity timeout (30 minutes):**

- Leave browser idle for 30+ minutes → next interaction should redirect to `/login`
- Client-side `InactivityGuard` fires logout on idle
- Server-side proxy checks `last_active_at` cookie

**Max session duration (7 days):**

- After 7 days, even active sessions expire → redirect to `/login`

**Edge case:**

- Open two tabs, go idle in one → activity in the other tab should keep session alive
  (both read/write the same cookies)

### 1.5 Forgot / Reset Password

**Happy path:**

1. Click "Forgot Password" on login page
2. Enter email → success message ("Check your email") regardless of whether account exists
3. Click email link → redirected to `/reset-password` via `/api/auth/callback`
4. Enter new password + confirm → redirect to `/login`
5. Login with new password

**Validation:**

- Reset password: passwords don't match → error shown
- Reset password: password < 8 chars → hint shown
- Navigate to `/reset-password` without `password_reset` cookie → redirect to `/forgot-password`

**Edge case:**

- Reset link expires (5-minute cookie) → redirect to `/forgot-password`
- Use reset link twice → second use should fail (session already consumed)

### 1.6 Profile Management

**Happy path:**

- Edit username, firstName, lastName via inline edit fields → saves on confirm
- Change avatar color → saves immediately
- Update password (current + new + confirm) → success message

**Validation:**

- Username taken → error displayed inline
- Username invalid chars → validation hint
- Current password wrong → error displayed
- New password < 8 chars → hint shown
- Confirm password doesn't match → error shown

---

## 2. Home Page

### 2.1 Group Display

- **Groups You Own**: shows groups where user role = "owner" and status is active
- **Joined Groups**: shows groups where role = "member" and status is active
- **Pending Requests**: shows groups where status = "pending_approval" or "denied"
- **Empty state**: "Create a Group" and "Join with Invite Code" buttons visible
- Each group card shows: name, member count, member avatars, user's role/status

### 2.2 Withdraw Pending Request

- Click withdraw on a pending request → membership deleted
- Click withdraw on a denied request → membership deleted
- Verify group disappears from "Pending Requests" section

**Edge case [MULTI-TAB]:**

- User A requests to join, User B (owner) approves concurrently → withdrawal
  should be a no-op (status guard in DELETE WHERE clause prevents deleting an
  approved member); page refreshes to show group in "Joined Groups"

---

## 3. Group Creation

### 3.1 Happy Path

1. Click "Create a Group"
2. Enter group name (1–50 chars)
3. Select date mode:
   - **Consecutive Days** → enter number (1–19)
   - **Specific Dates** → pick start/end within Jul 12–30, 2028
   - **Decide Later** → no date fields
4. Submit → redirect to group overview
5. Verify: group created with `phase = "preferences"`, invite code generated,
   user is owner with `status = "joined"`

### 3.2 Validation

- Group name empty → error
- Group name > 50 chars → error
- Consecutive days < 1 or > 19 → error
- Specific dates: start > end → error
- Specific dates: outside Olympic period (before Jul 12 or after Jul 30) → error

### 3.3 Edge Cases

- Create group when already at 10 groups → "You can be in at most 10 groups"
- `[MULTI-TAB]` Create two groups simultaneously when at 9 groups → only one
  should succeed (count check is inside transaction)

---

## 4. Joining a Group

### 4.1 Happy Path

1. Get invite code from owner
2. Click "Join with Invite Code" → enter code → submit
3. Verify: membership created with `status = "pending_approval"`
4. Group appears in "Pending Requests" on home page

### 4.2 Validation & Error Messages

- Invalid invite code → "Group not found"
- Already pending → "You already have a pending request"
- Already a member → "You are already a member"

### 4.3 Denied Re-request

- After being denied, use same invite code → status reset to "pending_approval"
- Verify appears in "Pending Requests" again

### 4.4 Capacity Checks

- Join when group has 12 active members → "Group is full"
- Join when user already in 10 active groups → "You can be in at most 10 groups"

### 4.5 Edge Cases [MULTI-TAB]

- Two users join simultaneously when group has 11 members → only one should
  succeed (group row locked with `FOR UPDATE`)
- User at 9 groups joins two groups simultaneously → only the first to commit
  should succeed
- Denied user re-requests while owner approves concurrently → UPDATE has
  `status = "denied"` guard; if status already changed, no-op

---

## 5. Member Management (Owner)

### 5.1 Approve Member

**Happy path:**

- Owner sees pending members in group overview
- Click approve → member status changes to "joined", `joinedAt` set
- Member now appears in active members list

**Edge cases:**

- Approve when group already has 12 members → "Group is full" (capacity re-checked
  inside transaction after `FOR UPDATE` lock)
- `[MULTI-TAB]` Approve while member withdraws request → UPDATE is no-op
  (status guard: `WHERE status = 'pending_approval'`)
- Approve a previously departed member → `rejoinedAt` set in `departedMembers`
  (only if `approvedUser` SELECT confirms `status = 'joined'`)

### 5.2 Deny Member

**Happy path:**

- Click deny → member status changes to "denied"
- Member disappears from pending list

**Edge cases:**

- `[MULTI-TAB]` Deny while another admin approves → UPDATE is no-op (status guard)
- Denied member can re-request via same invite code

### 5.3 Remove Member

**Happy path:**

- Owner clicks remove on active member → confirmation modal appears
- Modal shows phase-specific warning (preferences vs schedule_review)
- If member has purchase data → red warning about cascading deletes
- Confirm → member deleted, buddy constraints cleaned up

**Phase-specific behavior:**

- **Preferences phase**: buddy constraints and session preferences deleted;
  affected buddy members tracked
- **Schedule exists AND member was part of it** (joinedAt <= scheduleGeneratedAt):
  - All combos, comboSessions, windowRankings deleted
  - Members at "preferences_set" get `statusChangedAt` bumped
  - Members at "joined" stay at "joined" (no status promotion bug — fix #14)
  - `departedMembers` updated with member info
  - Phase → "preferences"
- **Schedule exists AND member joined AFTER generation**:
  - Schedule preserved (member wasn't part of generation)
  - Only buddy tracking updated

**Edge cases:**

- Cannot remove owner → error
- Cannot remove pending/denied members via this action
- `[MULTI-TAB]` Remove member while concurrent transferOwnership makes them
  owner → `removeMemberTransaction` re-checks role after `FOR UPDATE` lock;
  aborts if member is now owner (fix #24)

### 5.4 Transfer Ownership

**Happy path:**

- Owner opens settings modal → selects eligible member → confirm
- Previous owner becomes "member", target becomes "owner"
- UI updates to reflect new roles

**Validation:**

- No eligible members (only owner in group) → button disabled
- Cannot transfer to pending/denied members

**Edge cases [MULTI-TAB]:**

- Transfer while target member leaves group concurrently → target re-verified
  inside transaction after `FOR UPDATE` lock; returns error if member departed
  (fix #20)

### 5.5 Leave Group (Non-Owner)

**Happy path:**

- Member clicks "Leave Group" → confirmation modal
- Confirm → member deleted, redirected to home page

**Validation:**

- Owner cannot leave → shown "OwnerLeaveModal" directing to transfer ownership
- If member has purchase data → warning about cascading deletes

**Edge cases [MULTI-TAB]:**

- Leave while concurrent ownership transfer makes user the owner → transaction
  re-checks role after lock; aborts transaction (fix #24)

### 5.6 Delete Group (Owner)

- Owner opens settings → danger zone → type group name to confirm
- All data cascade-deleted (members, preferences, schedules, purchases)
- Redirected to home page

### 5.7 Update Group Name

- Owner edits group name inline → validated against `groupNameSchema`
- Verify name updates across all pages

### 5.8 Update Date Configuration

**Happy path:**

- Owner opens settings → edit date config
- Change between consecutive/specific/decide-later
- If schedules already generated: window rankings recomputed with new dates

**Edge cases:**

- Change date config to "decide later" → window rankings deleted
- Change consecutive days count → new window rankings computed from existing combos

---

## 6. Preference Wizard

### 6.1 Step 0 — Buddies

**Happy path:**

- Set `minBuddies` (0 to number of other active members)
- Tag members as Required (hard), Preferred (soft), or None
- Save → buddy constraints stored, `preferenceStep` updated

**Validation:**

- `minBuddies` must be >= count of hard (Required) buddies
- Cannot select yourself
- `minBuddies` cannot exceed number of other active members
- Number input rejects `-`, `e`, `E`, `+` keys (fix #12)

**Edge cases:**

- Schedule already generated → warning modal: "Changes require regeneration"
  - Cancel → reverts to saved state
  - Proceed → saves + calls `ackScheduleWarning()` only if save succeeds (fix #7)
- All members tagged as Required → `minBuddies` auto-clamped

### 6.2 Step 1 — Sport Rankings

**Happy path:**

- Search/browse available sports
- Click to add sport (max 10)
- Drag-and-drop or arrow buttons to reorder
- Save → `sportRankings` stored

**Validation:**

- Must select at least 1 sport → hint shown
- Cannot exceed 10 sports

**Cascade behavior:**

- Removing a ranked sport silently deletes all session preferences for that sport
- Verify: after removing a sport, its sessions no longer appear in step 2

### 6.3 Step 2 — Session Interests

**Happy path:**

- Browse sessions filtered by ranked sports
- Click session → modal to set High / Medium / Low interest
- Filter by: sport, type, date, zone, interest level
- Search across session fields
- Hide sessions not of interest
- Must select >= 1 session

**Validation:**

- Cannot save with 0 sessions selected → hint shown
- Sessions must belong to ranked sports only

**Side effects on save:**

- Status set to "preferences_set" (generation gate)
- `affectedBuddyMembers` entry cleared for this member

**Edge cases:**

- Mount sync: if sport rankings changed, stale session preferences auto-removed
- Sessions loading state after sport rankings save → spinner shown until new
  sessions arrive (counter-based, not reference equality — fix #8)

### 6.4 Step 3 — Review

**Happy path:**

- Read-only summary of buddies, sports, sessions
- All data displayed correctly across three columns

**Affected buddy review:**

- If member is in `group.affectedBuddyMembers` → "Confirm" button appears
- Click confirm → clears member from `affectedBuddyMembers`
- Error handling on confirm failure → error displayed (fix #10)

**No combos warning:**

- If member is in `membersWithNoCombos` → warning banner shown
- Instructs user to go back and update preferences

### 6.5 Dirty State Guard

**In-app navigation with unsaved changes:**

- Click sidebar link → confirmation modal: "You have unsaved changes in [step names]"
- "Stay" → remains on page
- "Discard & Leave" → navigates away, changes lost

**Browser navigation with unsaved changes:**

- Refresh / close tab → native `beforeunload` prompt
- Browser back/forward → in-app modal (Navigation API intercept)

**Step progression blocking:**

- Cannot advance forward if current step has unsaved changes
- Can always go backward
- Tooltip shown on blocked step indicator

### 6.6 Schedule Warning Flow (Post-Generation Edits)

**Trigger conditions** (all must be true):

- Schedule has been generated
- User joined before generation
- User doesn't have no-combos state
- User doesn't have affected buddy review pending
- Current step has unsaved changes
- Warning not already acknowledged for this generation

**Flow:**

- Warning modal: "Schedules have already been generated. If you update preferences
  now, the owner will need to re-generate schedules for all group members."
- Cancel → reverts ALL steps to saved state
- Proceed → save + `ackScheduleWarning()` (only on save success)

---

## 7. Schedule Generation

### 7.1 Pre-Generation Guards

Verify each guard blocks generation with correct error message:

| Condition                                         | Expected Error                          |
| ------------------------------------------------- | --------------------------------------- |
| Non-owner clicks generate                         | Auth error                              |
| Phase is not `preferences` or `schedule_review`   | Phase error                             |
| `affectedBuddyMembers` is non-empty               | "All affected members must review"      |
| Any active member has status != `preferences_set` | "All members must have preferences set" |

### 7.2 Generate Button States

- **First generation**: enabled when all members have `preferences_set`
- **Regeneration needed**: enabled when any of:
  - Member updated preferences after generation
  - New member joined and set preferences post-generation
  - Member departed or rejoined
  - Members with no combos who updated preferences
  - Purchase data changed
- **Up to date**: disabled with "Schedules are up to date" tooltip

**Tooltip specificity (fix #22):**

- Blocked by affected buddies → "All affected members must review their buddy
  preferences first."
- Blocked by no-combo members → "Members without sessions need to update their
  preferences."
- Blocked by missing preferences → "All members must set their preferences first."

### 7.3 Generation In-Progress

- Modal prevents accidental interruption
- `beforeunload` prompt on browser close during generation
- X button and Cancel disabled during generation
- "Generating..." text with loading spinner
- Message: "This may take up to a few minutes. Do not refresh the page."

### 7.4 Successful Generation

**Verify post-generation state:**

- Combos created for all members (primary, backup1, backup2 per day)
- Phase → "schedule_review"
- `scheduleGeneratedAt` set
- `departedMembers` cleared
- `affectedBuddyMembers` cleared
- `purchaseDataChangedAt` reset to null
- Window rankings computed (if date mode configured)
- Member `excludedSessionCodes` populated (sold-out/OOB sessions)

### 7.5 Partial Generation (membersWithNoCombos)

- Some members receive 0 combos (e.g., conflicting buddy constraints)
- Phase stays "preferences" (not "schedule_review")
- `membersWithNoCombos` populated → notification shown
- Affected members see guidance to update preferences

### 7.6 Non-Convergence

- Algorithm hits 5 iterations without resolving all violations
- `nonConvergenceMembers` populated
- Amber warning shown to affected members on My Schedule and in Notifications
- Schedule is still saved (best-effort)

### 7.7 Timeout Scenarios

- **Timeout during first pass** (some members unprocessed): fatal error, no
  schedule saved, user advised to reduce preferences/constraints
- **Timeout during convergence refinement**: treated as non-convergence,
  best-effort schedule saved, no backup enhancement runs

### 7.8 Post-Generation Guards (TOCTOU)

**Verify [MULTI-TAB]:**

- Member count changed during generation → "Group membership changed..." error
- Group phase changed during generation → "Group state changed..." error
- Both checked inside `FOR UPDATE` transaction after algorithm completes

---

## 8. My Schedule View

### 8.1 Display Modes

- **Calendar view**: week layout, hours 6 AM – 1 AM, session blocks positioned
  by time with overlap layout
- **List view**: days sorted by primary combo score (descending)
- Toggle between views → state persists during session

### 8.2 Rank Filtering

- Toggle Primary (blue), Backup1 (orange), Backup2 (pink)
- Selecting "all" shows all ranks
- Toggling one rank when all selected → shows only that rank
- Cannot deselect last rank

### 8.3 Session Display

Each session block shows:

- Sport name and session code
- Rank tags (P, B1, B2) with correct colors
- Time range (if block has space)
- Venue and zone (if block has space)

### 8.4 Session Detail Modal

Click any session → modal shows:

- Full session info (code, sport, type, time, venue, zone, description)
- Attending members (those with purchased tickets)
- Other interested members (with their rank tags: P, B1, B2)
- Reported prices from group members
- Status badges: purchased / sold out / out of budget

### 8.5 Non-Convergence Warning

- If current user is in `nonConvergenceMembers` → amber banner above schedule
- Message: "The algorithm was not able to meet all of your requirements..."
- Not shown to unaffected members

### 8.6 No Schedule Placeholder

- If schedules not yet generated → placeholder message instead of schedule
- All schedule-dependent tabs show warning icon with tooltip

### 8.7 Additional Filters

- Purchase status: all / purchased / not purchased
- Sold out status: all / sold out / available
- Search by sport, session code, type, description, venue, zone

---

## 9. Group Schedule View

### 9.1 Display Modes

- **Week view**: calendar with up to 3 overlapping session columns per day;
  "+N more" badges for overflow
- **Day view**: click a day cell to zoom into single-day view
- Scale toggle between week and day

### 9.2 Member Filtering

- Toggle individual members on/off
- "Any" mode: sessions with at least one selected member
- "All" mode: sessions with ALL selected members attending/interested

### 9.3 Window Rankings (Consecutive Mode)

- Sidebar shows top 3 windows ranked by group score
- Each window: date range + score
- Click window → calendar jumps to window start date, days highlighted
- Active window: light blue background
- Info tooltip explains scoring methodology

### 9.4 Date Configuration Display

- Consecutive: "N consecutive days"
- Specific: "Start – End" formatted dates
- Neither configured → no window rankings section

### 9.5 Session Detail (Group View)

- Attending members with price paid
- Interested members with rank tags
- Reported prices
- Status badges

---

## 10. Notifications (Overview Page)

### 10.1 Notification Types — verify each appears in correct conditions

**RED (Error) notifications:**

1. **No Combos**: `membersWithNoCombos.length > 0`
   - Lists affected member names
   - Message instructs to wait for affected members to update preferences

2. **Departed Members**: members departed and not rejoined
   - `[OWNER]` → "You will need to regenerate schedules"
   - `[MEMBER]` → "Wait for the group owner to regenerate"
   - Timestamp shows most recent departure

3. **Affected Buddies** (owner view): affected buddy entries exist
   - Different messages based on whether owner is personally affected
   - Lists departed names that caused the issue

4. **Affected Buddies** (member view): current user has affected buddies
   - Lists names auto-removed from required buddies
   - Instructs to review and update preferences

**BLUE (Info) notifications:**

5. **Rejoined Members**: departed members who rejoined
   - One notification per rejoined name

6. **Newly Joined Members**: joined after `scheduleGeneratedAt`
   - Excludes affected buddy members and rejoined departed members
   - Sub-messages based on preference status:
     - All ready → "Regenerate schedules to include them"
     - Some ready → "Wait for remaining members..."
     - None ready → "Wait for them to enter preferences..."

7. **Updated Preferences**: members who updated after generation
   - Excludes post-generation joiners (they get "newly joined" instead)
   - `[OWNER]` → "Regenerate schedules to reflect these changes"
   - `[MEMBER]` → "These updates won't be reflected until owner regenerates"

**AMBER (Warning) notifications:**

8. **Non-Convergence**: shown only to affected members
   - "The algorithm was not able to meet all of your requirements..."

9. **Purchase Changes**: `purchaseDataChangedAt > scheduleGeneratedAt`
   - `[OWNER]` → "You may want to regenerate..."
   - `[MEMBER]` → "These changes won't be reflected until owner regenerates"

### 10.2 Notification Priority

- Notifications displayed in order listed above
- Each has correct styling (red/blue/amber border and background)
- Timestamps formatted as relative time ("12 hours ago")

---

## 11. Purchase Tracker

### 11.1 Timeslot Management

**Happy path:**

- Enter purchase timeslot (start datetime, end datetime) → upsert saves
- Edit existing timeslot → updates in place
- Timeslot shown on overview page next to member name

**Validation:**

- End must be after start
- Dates must be parseable

**Edge case:**

- Edit timeslot after purchasing tickets → purchases unaffected (independent tables)
- Multiple purchase windows: set timeslot A, buy tickets, edit to timeslot B, buy more →
  both timeslot and purchase data persist correctly

### 11.2 Purchase Plan

**Happy path:**

- Open "Plan Purchases" on a session → select assignees, set price ceilings
- Save → purchase plan entries created/updated
- View plan entries on session row

**Validation:**

- Price ceiling must be >= 0
- Assignees must be active group members (fix #14 from third audit)

**Batch save:**

- Save multiple plan entries for same session atomically
- Old entries replaced, new ones inserted

### 11.3 Record Purchase

**Happy path:**

- Click "Record Purchases" on a session
- Select assignees (members without existing purchases for this session)
- Optionally enter price per assignee
- Submit → purchase record + assignee records created
- Green checkmark appears on session (group-wide indicator)

**Validation:**

- At least 1 assignee required
- Prices must be non-negative and not NaN (fix #3)
- Session must not be sold out (server-side check — fix #5)
- Assignees must be active group members (fix #14 from third audit)
- Duplicate assignees filtered server-side (fix #4)

**Edge case:**

- All requested assignees already have purchases → error returned
- Buyer is NOT automatically an assignee → only listed assignees get locked sessions

### 11.4 Delete Purchase / Remove Assignee

**Delete purchase:**

- Click delete on your purchase → entire purchase + all assignees deleted
- Can only delete purchases you recorded
- `purchaseDataChangedAt` updated

**Remove single assignee:**

- Remove one assignee from a multi-assignee purchase
- If last assignee removed → entire purchase auto-deleted (intentional — item B)
- `purchaseDataChangedAt` updated

**Update assignee price:**

- Inline edit price paid → updated per-assignee
- Validates non-negative, not NaN

### 11.5 Mark / Unmark Sold Out

**Happy path:**

- Click "Mark Sold Out" on any session → group-wide exclusion
- `purchaseDataChangedAt` updated → regeneration notification to owner
- Unmark → re-included for all members

**Scope:** Group-wide — affects ALL members on next regeneration

**Edge case:**

- Sold-out session with purchased tickets → kept for assignees (locked), excluded
  for everyone else
- Reporter departs → sold-out record persists (`reportedByMemberId` set to null)
- Marking sold out disabled if member has no timeslot (except for unmarking)
- Idempotent: `onConflictDoNothing`

### 11.6 Mark / Unmark Out of Budget

**Happy path:**

- Click "Mark Out of Budget" → per-member exclusion
- `purchaseDataChangedAt` updated
- Unmark → re-included for this member only

**Scope:** Per-member only — only affects the member who marked it

**Edge case:**

- OOB session with purchased tickets → kept (locked overrides OOB)
- Idempotent: `onConflictDoNothing`

### 11.7 Report Price

**Happy path:**

- Enter min price, max price, and/or comments (200 char limit)
- Submit → new price report row created (appended, not upserted)
- Report visible to all group members

**Validation:**

- At least one field required
- Prices must be non-negative and not NaN
- Min price must be <= max price
- Comments trimmed to 200 chars

**Design notes:**

- Multiple reports per member allowed (prices change over time)
- Reports are informational only — no effect on generation
- `purchaseDataChangedAt` NOT updated (reports don't affect scheduling)
- Reports NOT deleted when purchase deleted (independent concepts — item N)

### 11.8 Off-Schedule Purchases

**Happy path:**

- Search for session code not on your schedule
- Session lookup returns details
- Record purchases, prices, mark sold out/OOB — same actions as on-schedule

**Validation:**

- Cannot add a session already on your schedule
- Up to 25 autocomplete suggestions
- Delete off-schedule session → removes user's purchases and price reports for it

### 11.9 Excluded Sessions

**Display:**

- Shows sessions excluded from last generation
- Each shows: `wasSoldOut`/`wasOutOfBudget` (at generation) and
  `isSoldOut`/`isOutOfBudget` (current DB state)
- Sessions on member's schedule never shown as excluded

**Actions:**

- "Undo" sold out / OOB → calls unmark action
- "Re-mark" → calls mark action
- Search/filter within excluded sessions

### 11.10 UI State Management

- **Global busy state**: editing any row disables all other rows
- **Optimistic updates**: UI updates immediately, server confirms
- **Navigation guard**: warns when navigating away during edits
- **beforeunload**: prevents browser close during pending operations

---

## 12. Tab Warning Badges

### 12.1 Highest-Priority Warning

All schedule-dependent tabs (My Schedule, Group Schedule, Purchase Tracker) show
a warning icon with tooltip "Schedules have not been generated yet." when group
is NOT in `schedule_review` phase. This takes precedence over all other tab warnings.

### 12.2 Overview Tab Badge

Shows attention badge when any of:

- Affected buddy members exist
- Members with no combos exist
- Members have unset preferences
- Newly joined members (including those with `preferences_set` who joined
  post-generation — fix #16)
- Members updated preferences post-generation
- Purchase data changed post-generation

### 12.3 Preferences Tab

- Warning if preferences not yet complete for current user

### 12.4 My Schedule Tab

- Warning if non-convergence affects current user
- Warning if schedule not generated

---

## 13. Member Departure Impact Scenarios

These scenarios combine multiple flows and should be tested end-to-end:

### 13.1 Buddy Departs Before Generation

1. Member A sets Member B as Required buddy
2. Member B leaves group
3. Verify: Member A appears in `affectedBuddyMembers`
4. Verify: notification shown to Member A
5. Verify: generation blocked until Member A reviews
6. Member A confirms review → `affectedBuddyMembers` cleared
7. Generation now allowed

### 13.2 Member Departs After Generation (Was Part of It)

1. Generate schedules with members A, B, C
2. Member B leaves
3. Verify: all combos, comboSessions, windowRankings deleted
4. Verify: phase → "preferences"
5. Verify: members at "preferences_set" get `statusChangedAt` bumped
6. Verify: members at "joined" are NOT promoted (fix #14)
7. Verify: departed member tracked in `departedMembers`
8. Owner regenerates → new schedule without Member B

### 13.3 Member Departs After Generation (Joined After)

1. Generate schedules with members A, B
2. Member C joins and sets preferences
3. Member C leaves
4. Verify: schedule preserved (C wasn't part of generation)
5. Verify: only buddy tracking updated

### 13.4 Member Rejoins

1. Member B departs (tracked in `departedMembers`)
2. Member B re-requests via invite code → owner approves
3. Verify: `rejoinedAt` set in `departedMembers`
4. Verify: "rejoined" notification appears
5. Verify: B must set preferences again before generation

### 13.5 Buyer Departs

1. Member A purchases tickets for session X, assigned to Members B and C
2. Member A leaves
3. Verify: FK cascade deletes purchases (and assignee rows)
4. Verify: Members B and C lose locked session status on next regeneration
5. Verify: sold-out records are NOT deleted (reporter set to null)

---

## 14. Algorithm Edge Cases (Browser Verification)

### 14.1 Locked Session Behavior

- Locked (purchased) sessions always appear regardless of:
  - Sold-out status (kept for assignee)
  - Out-of-budget status (locked overrides OOB)
  - Buddy constraints (bypasses all filters)
  - Travel feasibility (included even if infeasible)
- Locked sessions not in member's preferences → injected with `interest = "high"`
- Verify: another member's purchased session does NOT appear on your schedule
  unless you independently expressed interest

### 14.2 Travel Feasibility

- Same zone sessions → need 90 min gap
- Trestles Beach Zone → need 240 min gap (special venue)
- Various driving distances → corresponding gap requirements
- If no combos are travel-feasible AND locked sessions exist → locked-only
  combo generated (travel feasibility ignored)
- If no combos feasible and no locked sessions → 0 combos for that day

### 14.3 Combo Generation

- Max 3 unlocked sessions per day combo
- 4+ locked sessions on same day → all in one combo (no cap)
- Primary = highest score; B1 = first with new session vs P; B2 = first with
  new session vs both P and B1
- Tie-breaking: session count desc → sportMultiplierSum desc → alphabetical

### 14.4 Convergence Edge Cases

- Mutual hard buddies with divergent preferences → cascading pruning likely
  lands both in `membersWithNoCombos`
- Hard buddy who left the group → buddy ID silently skipped in filter (but
  departure flow should have triggered affected buddy review)
- Locked sessions can prevent convergence (never pruned)

### 14.5 Window Ranking

- Specific date mode → single window (no sliding)
- Consecutive mode → sliding N-day window across 19 Olympic days
- No date mode configured → window rankings skipped
- Fairness penalty: `stdev × memberCount × 0.5` (can produce negative scores)
- Sort: score desc → stdev asc → resilience desc → earlier start date

---

## 15. Concurrency & Race Condition Scenarios

These scenarios require multiple browser sessions and careful timing:

### 15.1 Approve/Deny Race

- `[MULTI-TAB]` Owner A approves while Owner B denies same member
- Result: whichever commits first wins; second UPDATE is no-op (status guard)

### 15.2 Approve/Withdraw Race

- `[MULTI-TAB]` Owner approves while member withdraws
- Withdrawal DELETE has status guard → if approval committed first, DELETE is no-op

### 15.3 Transfer/Leave Race

- `[MULTI-TAB]` Owner transfers to Member X while X simultaneously leaves
- Transfer transaction locks group row → re-verifies X; if departed, returns error

### 15.4 Remove/Transfer Race

- `[MULTI-TAB]` Owner removes Member X while another tab transfers ownership to X
- `removeMemberTransaction` re-checks role after lock; aborts if now owner

### 15.5 Concurrent Group Creation at Limit

- Same user creates two groups simultaneously at 9 groups
- Transaction-scoped count check → only one succeeds

### 15.6 Generation During Member Departure

- Owner generates while member leaves concurrently
- Post-generation TOCTOU check: active member count mismatches → error

---

## 16. Cross-Cutting Concerns

### 16.1 Auth Guards

- Every server action checks `getCurrentUser()` → returns error if not logged in
- Group actions check membership via `requireMembership()` or `requireOwnerMembership()`
- Denied and pending members cannot access group pages
- Direct URL navigation to group page as non-member → error/redirect

### 16.2 Revalidation

- After mutations, verify `revalidatePath()` fires correctly
- Page data refreshes without manual reload
- `router.refresh()` used for client-side data sync

### 16.3 Error Display

- Server action errors displayed as error alerts on the page
- Network errors caught and displayed
- Loading states always reset via `try/finally`
- Group schedule loading: `setLoading(false)` in `.finally()` (fix #11)

### 16.4 Empty States

- No groups → "Create a Group" / "Join with Invite Code" buttons
- No schedule generated → placeholder messages on schedule tabs
- No purchase data → empty state in purchase tracker
- No window rankings → section hidden
- No notifications → section hidden

### 16.5 Responsive Behavior

- Sidebar collapses/adjusts on smaller screens
- Calendar view handles different screen widths
- Session blocks resize with overlap layout
- Modal dialogs fit within viewport

---

## 17. Data Integrity Checks

### 17.1 FK Cascade Behavior

Verify these cascades work correctly:

- Delete group → all members, combos, purchases, etc. deleted
- Delete member → buddy constraints, session preferences, purchases,
  purchase assignees, plan entries, timeslots deleted
- Delete member → `soldOutSession.reportedByMemberId` set to null (not deleted)
- Delete combo → combo_sessions deleted
- Delete ticket_purchase → assignees deleted

### 17.2 Unique Constraints

Verify these uniqueness constraints are enforced:

- `users.username` — no duplicate usernames
- `users.email` — no duplicate emails
- `users.authId` — no duplicate auth IDs
- `member(userId, groupId)` — one membership per user per group
- `purchaseTimeslot(memberId, groupId)` — one timeslot per member per group
- `purchasePlanEntry(memberId, sessionId, assigneeMemberId)` — one plan per combo
- `soldOutSession(groupId, sessionId)` — one record per session per group
- `outOfBudgetSession(memberId, sessionId)` — one record per member per session

### 17.3 Status Transitions

Valid transitions to verify:

- `pending_approval` → `joined` (approve)
- `pending_approval` → `denied` (deny)
- `denied` → `pending_approval` (re-request)
- `joined` → `preferences_set` (complete wizard)
- `preferences_set` → `preferences_set` (status stays, `statusChangedAt` bumped
  when schedule reset after member departure)

Invalid transitions to verify are blocked:

- `joined` → `denied` (no code path)
- `preferences_set` → `joined` (no demotion path)
- `pending_approval` / `denied` → `preferences_set` (must go through `joined`)

---

## 18. Suggested Testing Order

For systematic browser testing, follow this order to build up state progressively:

1. **Auth flows** (signup, login, logout, forgot/reset password, profile edit)
2. **Group creation** (all date modes)
3. **Join flow** (invite code, capacity limits, denied re-request)
4. **Member management** (approve, deny, remove, transfer, leave)
5. **Preference wizard** (all 4 steps, dirty state guards, schedule warnings)
6. **Schedule generation** (first generation, verify combos and window rankings)
7. **Schedule views** (My Schedule calendar/list, Group Schedule, filters, detail modals)
8. **Purchase tracker** (timeslots, plans, purchases, sold out, OOB, prices, off-schedule)
9. **Regeneration triggers** (preference updates, member changes, purchase changes)
10. **Notifications** (verify all 9 types in correct conditions)
11. **Member departure scenarios** (impact on schedules, buddies, purchases)
12. **Concurrency scenarios** (multi-tab race conditions)
13. **Edge cases** (empty states, capacity limits, error recovery)

---

## Appendix A: Key Constants

| Constant                   | Value                       | Location                            |
| -------------------------- | --------------------------- | ----------------------------------- |
| MAX_GROUP_MEMBERS          | 12                          | `lib/constants.ts`                  |
| MAX_GROUPS_PER_USER        | 10                          | `lib/constants.ts`                  |
| MAX_SESSION_DURATION       | 7 days (604,800s)           | `lib/constants.ts`                  |
| INACTIVITY_TIMEOUT         | 30 min (1,800s)             | `lib/constants.ts`                  |
| OLYMPIC_START              | 2028-07-12                  | `lib/schedule-utils.ts`             |
| OLYMPIC_END                | 2028-07-30                  | `lib/schedule-utils.ts`             |
| OLYMPIC_DAYS_COUNT         | 19                          | `lib/schedule-utils.ts`             |
| Max sports ranked          | 10                          | `saveSportRankings` validation      |
| Min sessions selected      | 1                           | `saveSessionPreferences` validation |
| Invite code length         | 8 hex chars                 | `createGroup`                       |
| Algorithm timeout          | 5 minutes                   | `lib/algorithm/runner.ts`           |
| Max convergence iterations | 5                           | `lib/algorithm/runner.ts`           |
| Max sessions per day combo | 3 (unlocked)                | `lib/algorithm/combos.ts`           |
| Username                   | 3–30 chars, `[a-zA-Z0-9_-]` | `lib/validations.ts`                |
| Password                   | 8–72 chars                  | `lib/validations.ts`                |
| Group name                 | 1–50 chars                  | `lib/validations.ts`                |
| Consecutive days           | 1–19                        | `lib/validations.ts`                |

## Appendix B: Known Intentional Behaviors

These behaviors are by design and should NOT be filed as bugs (documented in
`docs/bugfixes-2026-03-23.md`):

- `getOwnerMembership` doesn't filter by active status → owner can never have
  non-active status (item A)
- Last assignee removed → entire purchase deleted (item B)
- `removePurchaseAssignee` returns success for non-existent purchase → idempotent (item C)
- 4+ locked sessions exceed 3-per-day limit → purchased tickets must appear (item D)
- All sessions travel-infeasible on a day → 0 combos with no specific warning (item E)
- Locked sessions bypass travel feasibility → purchased tickets must appear (item F)
- Empty travel matrix defaults to 210 min → data is complete (item G)
- Convergence loop can leave violations → non-convergence tracked and surfaced (item H)
- Reported prices survive purchase deletion → independent concepts (item N)
- Owner can't leave without transferring → no zombie groups (item O)
- Cascading interest count drops → intentional convergence mechanism (item Q)
- Fairness penalty scales with group size → intentional (item R)
- `globalBusy` disables all rows → prevents concurrent edit races (item V)
- Multiple price reports per member per session → historical tracking (item AF)
- Overview "Purchased?" requires timeslot → sequential pipeline tracking (item AA)

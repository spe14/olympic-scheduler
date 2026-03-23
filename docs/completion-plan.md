# Olympic Scheduler — Completion & New Features Plan

## Context

The core app (auth, groups, preferences, algorithm, schedule display) is built. What remains is:

1. **Finishing Phase 1** — schedule confirmation, window ranking, group schedule view
2. **Phase 2: Ticket Purchase Plan** — combo-based purchase plan with price ceilings, 3-window tabs, buy-for-others
3. **Phase 3: Purchase Tracking** — purchase records, budget tracking, sold-out sessions, re-generation with locks
4. **Supporting features** — reference schedule page, how-it-works page
5. **Hardening** — algorithm integration testing, navigation guard edge cases

### Key Design Changes From Original Spec

| Change                                             | Rationale                                                                                                                                                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove willingness/price ceilings from preferences | Doesn't affect algorithm; confusing to set speculatively for 30+ sessions. Price ceilings move to Phase 2 where they're set against actual schedule assignments                                                                         |
| Remove conflict resolution phase                   | Buddy constraint issues related to pricing are resolved through conversation + preference updates, not a dedicated UI phase. Algorithm conflicts (hard buddy filtering, min buddies) are handled during generation                      |
| Budget moves to user level                         | Doesn't affect algorithm. Set in user settings, editable anytime. Global like 12-ticket limit.                                                                                                                                          |
| Remove viable configs from Phase 1                 | Without willingness tiers, there are no price-based configs to compute. Buddy constraints are enforced during combo generation                                                                                                          |
| Simplify state machine                             | `preferences` -> `schedule_review`. No confirmation step, no `completed` phase, no `conflict_resolution` phase                                                                                                                          |
| Purchased session locks only                       | No voluntary locks — if you want to guarantee a session survives re-generation, buy the ticket                                                                                                                                          |
| Override persistence across re-generations         | `excluded` flags preserved across re-generations. `hardBuddyOverride` and `minBuddyOverride` removed — convergence loop makes per-session overrides unnecessary. Users adjust constraints directly (hard→soft buddy, lower minBuddies). |

---

## Phase 1: Schedule Generation (Current Focus)

### 1A. Algorithm Integration Tests

Validate algorithm correctness before building more on top.

**New files:**

- `tests/algorithm/integration.test.ts` — Multi-member end-to-end with realistic data (3-4 members, overlapping sports, buddy constraints), verify combos
- `tests/algorithm/scoring.test.ts` — Sport multiplier, interest adjustment, soft buddy bonus
- `tests/algorithm/combos.test.ts` — Subset generation, day grouping, travel-constrained ranking
- `tests/algorithm/filter.test.ts` — Hard buddy filter, min buddies filter, empty-result edge case
- `tests/algorithm/travel.test.ts` — Matrix building, gap calculation, Trestles Beach, feasibility

**Reference:** `lib/algorithm/*.ts`, `tests/algorithm/viable-configs.test.ts` (follow existing patterns)

### 1B. In-Place Preference Editing (COMPLETED)

There is no explicit "re-enter preferences" action or schedule confirmation step. Members implicitly accept the schedule and can edit preferences in-place during `schedule_review`.

**How it works:**

- Members navigate to the Preferences tab and edit any step (buddies, sport rankings, sessions)
- Their status remains `preferences_set` — only `statusChangedAt` is updated
- `shouldResetStatus` always returns `false`
- The system detects updated preferences by comparing `statusChangedAt > scheduleGeneratedAt`
- A warning is shown before saving: "Schedules have already been generated. If you update preferences now, the owner will need to re-generate schedules for all group members."
- The owner sees a regeneration notification on the Overview page and can regenerate from `schedule_review`

### 1C. Window Ranking

**New files:**

- `lib/algorithm/window-ranking.ts` — Sliding window scoring (fairness_weight=0.5)
- `tests/algorithm/window-ranking.test.ts`

**New files (UI):**

- `group-schedule/_components/window-selector.tsx` — View/select windows

**Modify:**

- `actions.ts` (generate schedules) — Compute and write window rankings as part of generation. No separate `computeWindowRankings` action needed.
- `actions.ts` — `selectWindow(groupId, windowId)` (owner-only)
- Write to existing `windowRanking` table in schema
- Group schedule page highlights selected window's date range

**Window narrowing behavior:**

- After initial ranking, valid windows filter as purchases accumulate
- Filter rule: window is valid only if ALL purchased session dates fall within `[start, start+N-1]`
- Top 3 valid windows surfaced in purchase plan as tabs (consecutive mode only; specific mode = 1 window)
- If 0 valid windows remain: UI prompts owner to increase N or switch to specific date range

### 1D. Group Schedule Page

**New files:**

- `app/(main)/groups/[groupId]/group-schedule/page.tsx` — Full calendar view
- `app/(main)/groups/[groupId]/group-schedule/actions.ts` — `getGroupSchedule(groupId)`

**Details:**

- Query all primary combos for all members, join with sessions
- Reuse week-based calendar grid, color-code by member (avatarColors)
- Click session -> see attending members
- Visible from `schedule_review` phase onward

### 1E. Preference Update Notification (minor polish)

Already functionally complete in `generate-schedule-section.tsx`. Verify styling + add tests.

**Modify:**

- `generate-schedule-section.tsx` — Change `text-red-600` to amber banner styling
- Add test coverage for formatting (single, self, multiple with Oxford comma)

### 1F. Remove Willingness From Preferences

**Modify:**

- `app/(main)/groups/[groupId]/preferences/_components/session-interest-modal.tsx` — Remove price ceiling selector, keep interest-only
- `app/(main)/groups/[groupId]/preferences/_components/sessions-step.tsx` — Remove willingness badges from session cards
- `app/(main)/groups/[groupId]/preferences/_components/review-step.tsx` — Remove willingness from review display
- `app/(main)/groups/[groupId]/preferences/actions.ts` — Stop saving `maxWillingness`
- `lib/algorithm/types.ts` — Remove `maxWillingness` from `CandidateSession`
- `lib/algorithm/viable-configs.ts` — Remove or gut (may repurpose in Phase 2)
- `tests/` — Update affected tests

**Modify (buddy/budget step -> buddy step):**

- Rename "Buddies & Budget" step to "Buddies" step
- Remove budget input from preference wizard
- Add budget input to user settings (global, not per-group — mirrors 12-ticket limit)

### 1G. Schema Changes (Phase 1) (COMPLETED)

**Applied to `lib/db/schema.ts`:**

1. Removed `maxWillingness` from `sessionPreference` table
2. Removed `conflict`-related tables/columns
3. Removed `schedule_review_pending`, `schedule_review_confirmed` from member status enum — members stay at `preferences_set` through schedule_review phase
4. Removed `conflict_resolution` and `completed` from group phase enum — simplified to `preferences` → `schedule_review`
5. Removed `budget` entirely (dropped from scope — may revisit in a future phase)
6. Removed `excluded` from `sessionPreference` — exclusion handled at generation time via sold-out/out-of-budget filtering
7. Added `excluded_session_codes` JSONB on `member` for generation-time exclusion snapshots

---

## Phase 2: Ticket Purchase Plan

### Data Flow Into Phase 2

```
FROM Phase 1:
  - Member schedules: P/B1/B2 combos per day per member
  - Valid windows: top 3 if consecutive mode, 1 if specific mode
  - Buddy overlap: which members share sessions in their combos

PHASE 2 ADDS:
  - Price ceilings: freeform $ per session, set by timeslot holder
  - "Buy for others" assignments: which members to buy tickets for at each session
  - Combo-based purchase plan: day-by-day with primary + B1/B2 fallbacks
  - Window narrowing: valid windows reduce as purchases accumulate
```

### 2A. Schema Changes (Phase 2) (COMPLETED)

**Applied to `lib/db/schema.ts`:**

1. **New table: `purchase_plan_entry`** — A planned purchase per session per assignee:
   ```
   id (UUID PK), groupId (FK), memberId (FK), sessionId (FK),
   assigneeMemberId (FK -> member the ticket is planned for),
   priceCeiling (integer, nullable — null = no limit),
   createdAt, updatedAt
   Unique: (memberId, sessionId, assigneeMemberId)
   ```
   Normalized design: one row per member-session-assignee triple (instead of a `buyForMemberIds` array).
2. **New table: `purchase_timeslot`** — Member's declared purchase window
3. **New table: `ticket_purchase`** — Recorded purchases (no `quantity` column — uses assignee rows instead)
4. **New table: `ticket_purchase_assignee`** — Per-member ticket assignments with optional `pricePaid`
5. **New table: `sold_out_session`** — Group-scoped sold-out tracking
6. **New table: `out_of_budget_session`** — Per-member out-of-budget tracking
7. **New table: `reported_price`** — Price reports with min/max/comments (no unique constraint per member+session)

### 2B. Purchase Plan UI

**New files:**

- `app/(main)/groups/[groupId]/purchase-plan/page.tsx` — Purchase plan page for timeslot holders
- `app/(main)/groups/[groupId]/purchase-plan/actions.ts`:
  - `getPurchasePlan(groupId)` — Get current member's purchase plan
  - `savePurchasePlan(groupId, entries[])` — Save/update the full plan
- `app/(main)/groups/[groupId]/purchase-plan/_components/plan-day-card.tsx` — Card for each day showing primary combo + fallbacks
- `app/(main)/groups/[groupId]/purchase-plan/_components/price-ceiling-input.tsx` — Freeform currency input (`$___`)
- `app/(main)/groups/[groupId]/purchase-plan/_components/assignee-selector.tsx` — Select which members to buy for
- `app/(main)/groups/[groupId]/purchase-plan/_components/window-tabs.tsx` — Top 3 valid window tabs

**Modify:**

- `group-shell.tsx` — Add "Purchase Plan" nav item in sidebar (visible at `schedule_review` phase)

**Details:**

The purchase plan displays **window tabs** at the top — up to 3 tabs in consecutive mode, 1 tab in specific mode. Each tab shows the full combo-based plan for that window's days:

For each **day** within the selected window tab:

- Show the **primary combo** as the purchase target (all sessions to buy for that day)
- Show **B1 and B2** as fallback combos
- For each session in the primary combo:
  - Freeform price ceiling input: `$___` (optional, null = no limit)
  - "Buy for" member selector (checkboxes — only shows group members who have indicated interest in this session)
- Days ordered by primary combo score (highest first); sessions ordered by score within each day. No manual reordering.
- Price ceilings are shared across windows for sessions that appear in multiple windows (overlapping days)

**Prompt text:**

> "Set your price ceiling for each session. (Optional) This will help you quickly determine whether to buy tickets or skip if a session is above your ceiling. You can also select other group members to buy tickets for."

### 2C. Purchase Plan Summary View

Read-only view of the purchase plan for the timeslot holder to reference during their purchase window. Structured by day with combos:

```
=== ALICE'S PURCHASE PLAN (Window 1: Jul 18-22) ===

JULY 18:
  Primary: [Gymnastics 10am, Swimming 3pm, Track 7pm]
    Gymnastics: $400   buy for: Alice, Bob        Buy/Skip
    Swimming:   $200   buy for: Alice             Buy/Skip
    Track:      $150   buy for: Alice, Eve        Buy/Skip
  If unavailable -> B1: [Gymnastics 10am, Swimming 3pm]
                 -> B2: [Gymnastics 10am, Track 7pm]

JULY 19:
  Primary: [Diving 10am, Swimming 3pm]
    Diving:   $300   buy for: Alice, Carol        Buy/Skip
    Swimming: $200   buy for: Alice               Buy/Skip
  ...
```

---

## Phase 3: Purchase Tracking & Re-generation

### Data Flow Into Phase 3

```
FROM Phase 2:
  - Purchase plan: ordered sessions with price ceilings
  - Assignee mappings: who to buy for at each session

PHASE 3 ADDS:
  - Actual purchase records: what was bought, at what price, for whom
  - Sold-out tracking: which sessions are no longer available
  - Budget tracking: spent vs. remaining per member
  - Re-generation with locks: purchased sessions fixed, algorithm re-optimizes the rest
```

### 3A. Schema Changes (Phase 3) (COMPLETED — merged into Phase 2)

The purchase tracking tables originally planned for Phase 3 were implemented as part of Phase 2. See 2A above for the final schema. Key differences from original plan:

- `ticket_purchase` has no `quantity` column — individual `ticket_purchase_assignee` rows track per-member assignments
- `ticket_purchase_assignee` has an additional `pricePaid` column for per-member pricing
- Added `out_of_budget_session` table (not in original Phase 3 plan)
- Added `reported_price` table with `minPrice`/`maxPrice`/`comments` (not in original plan)
- _(Removed: `purchased_travel_conflict` — handled as a UI warning, not tracked in DB)_

### 3B. Purchased Tickets Tab (Group-Level)

New sidebar tab within each group for managing ticket purchases.

**New files:**

- `app/(main)/groups/[groupId]/purchased-tickets/page.tsx` — List/calendar of purchase records for this group
- `app/(main)/groups/[groupId]/purchased-tickets/actions.ts`:
  - `createPurchase(groupId, { sessionId, pricePerTicket, quantity, assigneeMemberIds[] })` — Create purchase record + assignee rows. Check 12-ticket limit for each assignee (COUNT across all groups). Auto-locks session for all assignees.
  - `updatePurchase(purchaseId, { pricePerTicket, quantity, assigneeMemberIds[] })` — Edit record. Reassign tickets (remove old assignees, add new). Re-check 12-ticket limits.
  - `deletePurchase(purchaseId)` — Remove purchase + all assignee records. Unlocks session for affected members.
  - `getGroupPurchases(groupId)` — All purchases for the group with session details + assignee names
- `app/(main)/groups/[groupId]/purchased-tickets/_components/purchase-form-modal.tsx` — Create/edit purchase form
- `app/(main)/groups/[groupId]/purchased-tickets/_components/purchase-card.tsx` — Display card for each purchase

**Modify:**

- `group-shell.tsx` — Add "Purchased Tickets" nav item in sidebar (visible at all phases)

**Details:**

- Any session can be purchased (not just ones in the algorithm output)
- Buyer can edit/delete their own purchase records
- Assignees see the session locked into their schedule automatically
- Shows "X/12 tickets" badge per member

### 3C. My Tickets Page (User-Level, Cross-Group)

Global view of all purchased tickets across all groups.

**New files:**

- `app/(main)/my-tickets/page.tsx` — Cross-group ticket overview
- `app/(main)/my-tickets/actions.ts`:
  - `getMyTickets()` — All `ticket_purchase_assignee` rows for current user, join with purchase + session + group

**Modify:**

- `components/nav-bar.tsx` — Add "My Tickets" link

**Details:**

- Shows "X/12 Global Ticket Limit" prominently
- Lists all sessions user is assigned to, grouped by group
- Each entry shows: session info, price paid, who bought it, which group
- If user is in multiple groups, show warning: "It's not recommended to join multiple groups since optimal schedules are only generated at the group level."

### 3D. Sold-Out Sessions

**Modify:**

- `purchased-tickets/actions.ts` or `schedule/actions.ts`:
  - `toggleSoldOut(groupId, sessionId)` — Insert/delete from `soldOutSession`
  - `getSoldOutSessions(groupId)` — List for the group
- `schedule/page.tsx` — Gray out sold-out sessions, "SOLD OUT" badge
- `session-detail-modal.tsx` — "Mark as Sold Out" button (any member)

### 3E. Algorithm Changes for Purchased Locks

**Modify:**

- `lib/algorithm/types.ts` — Add `purchasedSessionCodes: string[]` to `MemberData`
- `lib/algorithm/combos.ts` — `generateDayCombos()`:
  1. Separate purchased vs non-purchased sessions for each day
  2. Purchased sessions fixed in primary combo (count toward max 3/day)
  3. Fill remaining slots from non-purchased candidates
  4. Travel feasibility includes purchased as fixed points
  5. Backup combos also include purchased sessions
- `lib/algorithm/runner.ts` — Pass purchased data through
- `app/(main)/groups/[groupId]/actions.ts` — In `generateSchedules()`:
  - Query purchased sessions per member (via `ticket_purchase_assignee` JOIN `ticket_purchase`)
  - Query `soldOutSession` for group -> exclude from candidates
  - Pass `purchasedSessionCodes` into `MemberData`
  - **Preserve** `excluded` flags across re-generations (override columns removed)
- Two purchased sessions same day not travel-feasible -> UI warning (not tracked in DB)

**Window ranking on re-generation:**

- Re-generation recomputes window rankings with purchased-date filter applied
- Only windows containing ALL purchased session dates are valid
- Purchased sessions outside any valid window are not flagged/blocked — they exist on the schedule and Purchased Tickets tab independently, noted as "outside attendance window"

### 3F. Budget Tracking

**Modify:**

- Remove budget from preference wizard (done in Phase 1F)
- Add budget input to user settings page (global, not per-group)
- `schedule/page.tsx` or `purchased-tickets/page.tsx` — Show "Spent $X / $Y budget" based on sum of purchase prices assigned to user across all groups
- `my-tickets/page.tsx` — Show global spending vs budget summary

---

## Supporting Features (Parallelizable)

### S1. Olympic Reference Schedule Page

Standalone page at `/schedule` (outside group context) to browse all 765 sessions.

**New files:**

- `app/(main)/schedule/page.tsx` — Server component, fetch all sessions
- `app/(main)/schedule/_components/schedule-browser.tsx` — Calendar/list view toggle
- `app/(main)/schedule/_components/schedule-filters.tsx` — Filter sidebar (sport, venue, zone, date, type)
- `app/(main)/schedule/actions.ts` — `getAllSessions()`

**Modify:**

- `components/nav-bar.tsx` — Add "Schedule" link with `globalGuardNavigation`

**Details:**

- Calendar view reuses week-based grid pattern from group schedule page
- List view: sortable table with all columns
- Filters: multi-select dropdowns, date range, session type checkboxes
- Click session -> detail modal (reuse `SessionDetailModal` without group-specific sections)

### S2. How It Works Page

Static page at `/how-it-works` with embedded video + workflow steps.

**New files:**

- `app/(main)/how-it-works/page.tsx`

**Modify:**

- `components/nav-bar.tsx` — Add "How It Works" link
- `app/(main)/_components/home-content.tsx` — "New here? Learn how it works" card for users with no groups

**Details:**

- Video embed via `<iframe>` (user provides URL later)
- Workflow steps with icons: Create group -> Set preferences -> Generate schedule -> Review schedule -> Plan purchases -> Buy tickets

---

## Hardening

### H1. Navigation Guard Edge Cases

- Phase transitions while editing
- Member removal post-generation
- Re-enter preferences cascade

### H2. End-to-End Testing

Full flow: create group -> preferences (interest only, no willingness) -> generate (window rankings computed) -> review schedule -> select window -> create purchase plan -> record purchases -> mark sold out -> re-generate with locks -> view group schedule

---

## Suggested Execution Order

**Day 1:** 1A (algorithm tests) + 1F (remove willingness) + 1E (notification polish)
**Day 2:** 1B (schedule confirmation) + 1G (schema cleanup)
**Day 3:** 1C (window ranking) + 1D (group schedule page)
**Day 4:** 2A (purchase plan schema) + 2B-2C (purchase plan UI)
**Day 5:** 3A (purchase tracking schema) + 3B (purchased tickets tab)
**Day 6:** 3C (my tickets) + 3D (sold out) + 3E (algorithm locks)
**Day 7:** 3F (budget tracking) + S1 (reference schedule) + S2 (how it works)
**Day 8:** H1-H2 (hardening + end-to-end testing)

---

## Verification

1. **Algorithm tests:** `npx vitest tests/algorithm/` — all pass
2. **Phase 1 flow:** Create group -> preferences (interest only) -> generate (window rankings computed) -> review schedule -> window select
3. **Phase 2 flow:** Create purchase plan -> set price ceilings (freeform $) -> review combo-based plan with 3-window tabs -> set buy-for-others
4. **Phase 3 flow:** Record purchase -> verify locked on schedule -> mark sold out -> re-generate with locks -> verify locks preserved
5. **12-ticket limit:** Purchase across 2 groups -> verify global count -> attempt 13th -> blocked
6. **Buy-for-others:** Alice buys for Bob -> session auto-locked on Bob's schedule -> Alice reassigns to Carol -> Bob unlocked, Carol locked
7. **Budget tracker:** Set budget -> purchase tickets -> verify "Spent $X / $Y" updates
8. **Navigation guards:** Edit preferences -> navigate away -> modal -> phase warning on save post-generation
9. **Reference schedule:** Browse 765 sessions, filter, toggle views
10. **Full test suite:** `npx vitest` — all tests pass

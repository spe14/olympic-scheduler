# Phase 2: Purchase Tracking — Progress & Remaining Work

## Overview

Phase 2 adds ticket purchase planning and tracking to the Olympic Scheduler. Users can plan which sessions to buy, set price ceilings, record purchases, mark sessions as sold out or out of budget, and report prices. The algorithm respects these changes on re-generation. Purchase actions are centralized on the Ticket Purchases page — My Schedule and Group Schedule remain read-only.

---

## Completed

### Schema Changes

- **7 new tables**: `purchaseTimeslot`, `purchasePlanEntry`, `ticketPurchase`, `ticketPurchaseAssignee`, `soldOutSession`, `outOfBudgetSession`, `reportedPrice`
- **Dropped columns**: `excluded` from `sessionPreference`, `budget` from `users`
- **Schema updates**:
  - `reportedPrice`: single `price` column replaced with `minPrice`, `maxPrice` (nullable integers) + `comments` (nullable text); unique constraint on `(groupId, sessionId, reportedByMemberId)` **dropped** — members can now report multiple prices for the same session over time
  - `ticketPurchaseAssignee`: added `pricePaid` (nullable integer) for per-member pricing
  - `ticketPurchase.pricePerTicket`: now optional (defaults to 0 when not provided)
- Migrations applied via `drizzle-kit generate` + `drizzle-kit migrate` (through migration 0017)

### Server Actions (`schedule/purchase-actions.ts`)

- Timeslot CRUD: `saveTimeslot`, `updateTimeslotStatus`, `getTimeslot`
- Purchase plan: `savePurchasePlanEntry`, `removePurchasePlanEntry`
- Ticket purchases: `markAsPurchased`, `deletePurchase`, `removePurchaseAssignee`, `updatePurchaseAssigneePrice`
- Sold out: `markAsSoldOut`, `unmarkSoldOut`
- Out of budget: `markAsOutOfBudget`, `unmarkOutOfBudget`
- Price reporting: `reportSessionPrice` (plain insert — no upsert; accepts min/max prices + optional comments with 200-char limit; allows comments-only entries)
- Off-schedule cleanup: `deleteOffScheduleSessionData` (deletes purchases + reported prices for a session by the current member)
- Data query helper: `getPurchaseDataForSessions` (reused by My Schedule, Group Schedule, and Purchase Tracker)

### Server Actions (`purchase-tracker/actions.ts`)

- `getPurchaseTrackerData`: returns combos, members, window rankings, off-schedule sessions, and excluded sessions
- `lookupSession`: validates a session code for off-schedule purchases
- `searchSessionCodes`: prefix search on session codes (returns up to 25 results with code, sport, type) for autocomplete

### Overview Page

- **Timeslot input** moved here (from My Schedule). Opens as a modal from the member row. Custom date + HH:MM AM/PM picker (user-designed).
- **"Timeslot Assigned?" column** added to the member status table with checkmarks
- **"Entered Preferences" renamed** to "Entered Preferences?"
- `myTimeslot` and `memberTimeslots` added to `GroupDetail` type and fetched in `getGroupDetail`

### My Schedule Page (read-only)

- **List view** added (calendar/list toggle). List view sorts days by primary combo score descending.
- **Sidebar filters** (matching Group Schedule pattern): View As, Filter by Combo (All/P/B1/B2), Filter by Purchase Status (All/Purchased/Not Purchased) — all in bordered boxes
- **Status badges** on calendar and list views: green checkmark (purchased), red X (sold out), amber $ (out of budget)
- **Session detail modal** — fully read-only:
  - Status badges (purchased, sold out, out of budget)
  - Attending Members section (members with purchased tickets, with per-member price)
  - Interested Members section (excludes attending members, with combo rank tags as rounded squares)
  - Reported prices with min/max range display + comments + full timestamps (date + time)

### Group Schedule Page (read-only)

- **Session detail modal** — fully read-only:
  - Status badges, Attending Members, Interested Members (flat list with inline rank tags as rounded squares)
  - Reported prices with min/max + comments + full timestamps. Attending members excluded from interested list.
- **Purchase data** fetched via `getPurchaseDataForSessions` in `getGroupSchedule`
- **Filter by Purchase Status** in its own bordered box (All/Purchased/Not Purchased) — blue styling matching member filters
- **"Members" renamed** to "Filter by Members"
- **"Any Attending"/"All Attending" renamed** to "Any"/"All" with tooltips: "attending or interested in attending"

### Purchase Tracker Page (`/groups/[groupId]/purchase-tracker`)

- **Access gated**: Only visible to members with a declared purchase timeslot. Others see prompt to enter timeslot on Overview page.
- **Filters** (side by side):
  - **Filter by Attendance Window**: Consecutive mode shows clickable window buttons (#1, #2, #3) + "Show All Sessions" option with tooltip ("Display all sessions from my schedule."). Defaults to owner-selected window. Specific date mode displays fixed range. No config shows amber warning.
  - **Filter by Purchase Status**: All / Purchased / Not Purchased — filters sessions within day cards, hides days with no matching sessions
- **Main section**: User's P/B1/B2 combos organized by day, sorted by primary combo score descending
  - Collapsible day cards with priority score + info tooltip explaining the score
  - "Collapse All" button when any day is expanded
  - Primary combo sessions shown by default
  - Backup combos expanded by default with "Show/Hide Backups" toggle and explanatory message
  - **"View Session Details"** link on every session row (sport-colored) — opens a modal with full session info (sport, code, type, date/time, venue/zone, session description events)
  - Each session row expands to show:
    - **Purchase Plan table** (side-by-side with Recorded Purchases): member + price ceiling columns, with inline edit (pencil) and delete (trash) icons
    - **Recorded Purchases table**: member + purchase price columns, with inline edit and delete icons
    - **Reported Prices section** (collapsible, above action buttons): larger font, shows min/max range + comments + reporter + full timestamp (date + time)
    - **Action buttons**: Plan Purchases, Mark as Sold Out, Record Prices, Record Purchases, Mark as Out of Budget
- **All actions via modals** — save completes before modal closes:
  - **Plan Purchases**: shows interested members (not already attending), current user first + defaulted to checked, per-member price ceiling inputs. Empty state message when all interested members already have tickets.
  - **Mark as Sold Out**: confirmation modal with session code
  - **Record Prices**: min/max price fields + optional comments textarea (200-char limit with live counter). Validation: max >= min. Submit requires at least one price OR a comment.
  - **Record Purchases**: shows all group members (not already attending), per-member price input. Prices optional. Disabled with tooltip when all members already have tickets.
  - **Mark as Out of Budget**: confirmation modal explaining exclusion from future schedules
- **Off-schedule purchases**:
  - Full-width search input with **autocomplete dropdown** — prefix-matches session codes as user types (debounced 200ms, up to 25 results). Keyboard navigation (arrow keys, Enter, Escape). "Search" button for direct lookup.
  - **Persistent session cards**: off-schedule sessions with purchases or reported prices survive page refresh (fetched from server). Sessions that appear in any group member's combos are excluded from off-schedule.
  - Each off-schedule card shows session info (sport-colored in blue by default), "View Session Details" link, recorded purchases table with inline edit/delete, collapsible reported prices, and action buttons (Record Prices, Record Purchases, Mark as Sold Out)
  - **Mark as Sold Out**: available on off-schedule sessions so earlier timeslot holders can mark sessions on other users' schedules as sold out. Uses the same `SoldOutModal` confirmation. Toggles to "Undo Sold Out" when active, with red "Sold Out" badge in header.
  - **X dismiss button** on sessions with no data entered yet (hidden when session has purchases, reported prices, or sold out status)
  - Duplicate session detection — looking up an already-displayed session shows an error message
- **Excluded Sessions section** (bottom of page, only shown when excluded sessions exist):
  - Shows sessions excluded from the latest schedule generation (marked sold out or out of budget but NOT in current user's combos) — one row per session (merged model)
  - Search input (filters by code, sport, type, description, venue, zone — same pattern as preferences page)
  - Each row shows session code, sport, type, status badges (red "Sold Out" and/or amber "Out of Budget"), date/time/venue, and "View Session Details" link (blue, opens session info modal)
  - **Undo buttons** with confirmation modal: "Do you want to undo this [action]? This will allow the session **[code]** to appear on future schedule generations."
  - If a session is both sold out AND out of budget, both badges and both undo buttons display. "Undo Out of Budget" is disabled with tooltip ("Undo sold out first") until the sold out is undone.
  - **Pending state**: After undoing, the session stays visible with an amber "Pending Schedule Regeneration" tag (replacing the undo button). Hovering the tag shows: "This session was unmarked as [sold out / out of budget / sold out and out of budget] and will be considered during the next schedule generation." Row gets amber border/background. Sessions disappear from the section after the next data refresh (post-regeneration).
- **Shared session state**: Actions on a session in one combo propagate to all combos containing that session (P, B1, B2) via page-level `sessionOverrides` map
- **Global busy state**: When any session row is editing or saving, ALL other interactions are disabled (buttons, accordions, window switching, off-schedule lookup, etc.)
- **Navigation guard**: "Unsaved changes" warning when navigating away during editing. Browser reload/close guard via `beforeunload`.
- **Currency inputs**: Custom component with `$` prefix, decimal validation (max 2 places), no leading zeros, auto-pad to 2 decimal places on blur
- **Nav item**: visible during `schedule_review` phase, with status indicator (checkmark if timeslot completed, warning if in progress)

### Algorithm Changes

- **Purchased sessions locked** into primary combo for all assignees on re-generation
- **Sold-out sessions excluded** — but **only for members who did NOT purchase tickets** for that session. Purchased sessions take precedence over sold-out status.
- **Out-of-budget sessions excluded** for the specific member
- Zero purchases = identical to Phase 1 behavior

### Terminology Updates

- "Scheduled Members" / "Other Interested Members" → "Interested Members" (members with session in combos) and "Attending Members" (members with purchased tickets)
- Attending members are excluded from the interested members list in all views
- "Any Attending"/"All Attending" → "Any"/"All" with updated tooltips

### Reported Price Timestamps

- All reported price displays (Purchase Tracker, My Schedule modal, Group Schedule modal) now show full date + time (e.g. "Mar 21, 2026, 3:45 PM") matching the notification timestamp format

### All 1125 tests passing

---

## Known Issues (Resolved)

- ~~Bug: Out-of-budget filter doesn't protect purchased sessions~~ — Fixed: added `|| memberLocked.has(sp.sessionCode)` to OOB filter
- ~~Bug: `unmarkOutOfBudget` missing `groupId` in WHERE clause~~ — Fixed: added `groupId` to WHERE
- ~~Race condition: `removePurchaseAssignee` auto-delete not transactional~~ — Fixed: wrapped in `db.transaction()`
- ~~Auth gap: `lookupSession` and `searchSessionCodes`~~ — Fixed: added `getCurrentUser()` auth check
- ~~Design decision: Undo detection for regeneration notification~~ — Fixed: added `purchaseDataChangedAt` column to groups table, bumped on schedule-affecting mutations, reset on generation
- ~~Missing `groupId` scoping in `deletePurchase`, `removePurchaseAssignee`, `updatePurchaseAssigneePrice`~~ — Fixed: added groupId verification queries
- ~~Algorithm: Locked sessions bypass travel feasibility~~ — Fixed: travel constraints now apply to combos with locked sessions; falls back to locked-only if nothing is feasible
- ~~`removePurchasePlanEntry` missing `groupId`~~ — Fixed: added `groupId` to WHERE
- ~~`getPurchaseDataForSessions` OOB query missing `groupId`~~ — Fixed: added `groupId` to WHERE
- ~~Cleanup: unused timeslot state and session detail modal props~~ — Fixed: removed
- ~~Silent error handling on purchase tracker mutations~~ — Fixed: modal callbacks return `string | null`, modals display errors and allow retry; inline edits show `actionError` with 5s auto-clear
- ~~`revalidatePath` only targets `/schedule`~~ — Fixed: purchase actions now also revalidate `/group-schedule`; purchase tracker intentionally excluded (uses optimistic UI)
- ~~`removePurchaseAssignee` missing `purchaseDataChangedAt`~~ — Fixed: added inside transaction
- ~~`deletePurchase` non-atomic~~ — Fixed: wrapped in `db.transaction()`
- ~~`deleteGroup` skips purchase table cleanup~~ — Fixed: explicit deletion of all 7 purchase tables
- ~~`reportSessionPrice` allows `minPrice > maxPrice`~~ — Fixed: added validation
- ~~Network errors crash purchase tracker~~ — Fixed: all server action calls wrapped in try/catch with inline row errors
- ~~Cascade delete on member removal~~ — Fixed: leave/remove allowed with warning dialog explaining purchase data will be deleted (purchases recorded by them + their ticket assignments from others)

## Known Issues (Open)

None.

---

## Completed (This Session)

### Step 6: Regeneration Notification

- Added `purchaseDataChangedAt` timestamp to `groups` table (migration 0018)
- Schedule-affecting actions (`markAsPurchased`, `deletePurchase`, `markAsSoldOut`, `unmarkSoldOut`, `markAsOutOfBudget`, `unmarkOutOfBudget`) bump `purchaseDataChangedAt`
- `generateSchedules` resets `purchaseDataChangedAt` to null
- Amber notification in `notifications-section.tsx` when `purchaseDataChangedAt > scheduleGeneratedAt`
- Role-aware messaging (owner: "you may want to regenerate" / member: "until the owner regenerates")
- `needsRegeneration` in `generate-schedule-section.tsx` includes `hasPurchaseChanges`
- Overview nav item warning includes purchase changes

### Purchase Tracker Access Gating

- Removed page-level timeslot gate — all members can now access the purchase tracker
- Action-level gating: "Record Purchase", "Record Prices", and "Mark as Sold Out" require a timeslot (disabled with tooltip when absent)
- "Plan Purchases", "Mark as Out of Budget", and all undo actions available to all members
- Same gating applied to off-schedule session cards and excluded sessions (sold out undo/redo)

### Excluded Sessions Overhaul

- **Independent toggles**: Removed ordering constraint ("undo sold out first" on OOB button). Users can undo/redo sold out and out of budget independently.
- **Re-marking**: "Redo Sold Out" / "Redo Out of Budget" buttons appear after undoing, allowing re-marking without regeneration
- **Persistent state across refresh**: Added `excludedSessionCodes` JSONB column to `member` table (migration 0019) storing `{ code, soldOut, outOfBudget }[]` snapshot at generation time. Excluded sessions persist after undo + page refresh, showing "Pending Schedule Regeneration" tag when current state differs from generation state.
- **Purchase/price history on excluded sessions**: Each excluded session row is expandable, showing read-only purchase history and reported prices
- **Excluded section always visible**: Shows description + "No excluded sessions." when empty

### Algorithm: Travel Feasibility with Locked Sessions

- Travel constraints now apply to combos containing locked sessions
- If no combo is feasible with locked + unlocked sessions, falls back to locked-only combo
- Purchased session overlap/infeasibility is the user's responsibility

### Session Search

- Added text search to **My Schedule** and **Group Schedule** sidebars (below View As toggle)
- Searches across sport, session code, type, description, venue, zone
- Filters both calendar and list views; hides days with no matching sessions

### Filter by Sold Out Status

- Added "Filter by Sold Out Status" (All / Available / Sold Out) to **My Schedule**, **Group Schedule**, and **Ticket Purchases** sidebars

### Ticket Purchases Sidebar Filters

- Moved all filters (Attendance Window, Purchase Status, Sold Out Status) from inline to the right sidebar, matching the layout of other schedule pages
- Attendance window pills show date ranges inline (e.g. "#1 Jul 14 – Jul 18")
- "All" button has tooltip: "Display all sessions from 'My Schedule'."

### Expand/Collapse All

- Added "Expand All" / "Collapse All" toggle for day accordions on the Ticket Purchases page
- Expand All also shows backup combos
- State persists across filter/window changes via `expandCounter` pattern
- Disabled during global busy state

### Purchase Ownership & Display

- Added `buyerMemberId` to `PurchaseData` type — tracks who recorded each purchase
- **Your Purchases** section (editable): Shows only purchases you recorded, with inline edit/delete for member and price
- **Purchase History** section (collapsible, read-only): Shows purchases recorded by other users, with "Purchased By" and "Purchase Recorded On" columns
- Edit/delete buttons only visible for your own purchases
- Purchased icon tooltip: "At least 1 user has purchased tickets to this session."

### Off-Schedule Session Search

- Restyled to match other search bars (search icon left, X clear button right, same input styling)
- Removed separate "Search" button — Enter key triggers lookup
- Added on-schedule session check: prevents looking up sessions already in user's combos

### My Schedule Status Icons Removed

- Removed purchased/sold out/out of budget icons from calendar and list views (too crowded)
- Session detail modal retains status badges (Purchased, Sold Out, Out of Budget)

### Action Button Styling

- Reordered: Plan Purchases, Record Prices, Record Purchases, Mark as Out of Budget, Mark as Sold Out
- All buttons use light colored shades (emerald-50, amber-50, red-50) instead of dark fills
- Consistent across SessionRow, OffScheduleSessionCard, and excluded sessions

### Empty State & Filter Messaging

- "No matching sessions for this filter." when purchase status or sold out filter hides all sessions
- "No excluded sessions." with description always visible

### Overview Page Updates

- **"Purchased Tickets?" column** added to member status table — checkmark when member has a timeslot AND has recorded at least 1 purchase as buyer (derived at query time, no DB field)
- **Phase badge removed** from group header (phase still used internally for gating)
- **Ticket Purchases nav tab**: Warning icon + tooltip when timeslot not entered, checkmark when entered

### Navigation

- Clicking any nav tab while already on that page triggers `router.refresh()` for fresh data

### Error Handling on Purchase Tracker Mutations

- **Modal pattern**: `onConfirm`/`onSave` callbacks now return `string | null`. Modals (`SoldOutModal`, `OutOfBudgetModal`, `RecordPriceModal`, `RecordPurchaseModal`, `PriceCeilingModal`) display error text above buttons and stay open for retry.
- **Inline edit pattern**: `SessionRow`, `OffScheduleSessionCard`, and `ExcludedSessions` have `actionError` state with 5-second auto-clear. Errors shown below expanded content.
- All server action call sites (13 modal callbacks + 6 inline edits) now check `result.error` before applying optimistic updates.

### Member Removal with Purchase Data

- `removeMember` and `leaveGroup` no longer block when member has purchase data
- Confirmation modal shows red warning box when member has purchase records, explaining:
  - All purchases they recorded (including tickets bought for other members) will be deleted
  - Their ticket assignments from purchases made by other members will be removed
  - "This action cannot be undone."
- `membersWithPurchaseData` added to `GroupDetail` (derived from `ticketPurchase` buyers + `ticketPurchaseAssignee` assignees)
- `memberHasPurchaseData` server-side helper retained for potential future use

### Leave Group Navigation Guard

- "Leave Group" button checks `guardNavigation` before opening modal — blocked during unsaved changes on the purchase tracker

### Cleanup

- Removed unused `timeslot` state from `schedule-content.tsx`
- Removed unused `groupId`/`currentMemberId`/`onRefresh` props from My Schedule session detail modal

### All 1125 tests passing

---

## Completed (Bug Fixes & Polish — 2026-03-22)

### Bug Fixes

#### `removePurchaseAssignee` missing `purchaseDataChangedAt`

- `removePurchaseAssignee` now updates `purchaseDataChangedAt` inside its existing transaction
- The sidebar regeneration warning now correctly appears when ticket assignees are removed

#### `deletePurchase` non-atomic operations

- Wrapped the delete + `purchaseDataChangedAt` update in a `db.transaction()` — previously two separate operations that could partially fail

#### Cross-route `revalidatePath` for purchase actions

- Purchase actions that affect data visible on the Group Schedule page (`markAsPurchased`, `deletePurchase`, `removePurchaseAssignee`, `markAsSoldOut`, `unmarkSoldOut`, `markAsOutOfBudget`, `unmarkOutOfBudget`, `reportSessionPrice`) now also revalidate `/groups/${groupId}/group-schedule`
- Purchase Tracker is intentionally NOT revalidated — it uses optimistic UI via `sessionOverrides`
- `updatePurchaseAssigneePrice` only revalidates `/schedule` (price changes don't affect schedules)

#### `deleteGroup` missing purchase table cleanup

- Added explicit deletion of all 7 purchase tables in dependency order (assignees → purchases → plan entries → timeslots → sold-out → out-of-budget → reported prices) before member deletion
- Added `purchaseTimeslot`, `purchasePlanEntry`, `reportedPrice` to imports
- Updated test schema mock and delete count expectation (7 → 14)

#### `reportSessionPrice` missing `minPrice <= maxPrice` validation

- Added validation: "Min price cannot exceed max price." when both values are provided

### Network Error Handling on Purchase Tracker

- All `startTransition(async () => { ... })` calls in `purchase-tracker-content.tsx` (9 occurrences) and `timeslot-form.tsx` (2 occurrences) now wrapped in try/catch
- **Inline edit/delete errors** (edit price, remove assignee, edit/remove ceiling) use per-row `rowError` state keyed by row identifier — error message renders directly under the affected table row, not at the bottom of the session accordion
- Inline row errors persist until dismissed (no auto-clear) — user must cancel or retry
- **Non-inline errors** (session lookup, excluded section unmark/remark) use existing `actionError` with 5s auto-clear
- Consistent message: "An unexpected error occurred. Please try again."

### Timeslot Form Simplified

- Removed display mode entirely (status badge, Start/Complete/Edit buttons)
- The form always renders with fields pre-filled when a timeslot already exists
- Removed `updateTimeslotStatus` usage, `isEditing` toggle, `statusStyles`, unused imports (`Clock`, `Edit2`, `Check`)
- Modal title: "Enter Purchase Timeslot" (new) / "Edit Purchase Timeslot" (existing)
- Button label: "Edit Purchase Timeslot" (was "Edit Timeslot")

### All 1125 tests passing

---

## Remaining

### End-to-End Testing

- Full flow: generate schedules → enter timeslot → purchase tracker → plan purchases → record prices → record purchases → mark sold out → mark out of budget → verify schedule badges → re-generate with locks
- Edge cases: purchased + sold-out for same member (purchased takes precedence), purchased + out-of-budget for same member, all sessions sold out on a day, member removal with purchase data, shared sessions across combos, off-schedule persistence across refresh, excluded sessions undo/redo flow

### Future Considerations

- Budget tracking (currently removed — may revisit)
- 12-ticket global limit (currently removed — may revisit)
- Reference schedule page (`/schedule` — browse all 765 sessions)
- How-it-works page

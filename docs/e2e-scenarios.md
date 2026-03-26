# End-to-End Test Scenarios — Exact Inputs & Expected Results

Companion to [docs/e2e-test-plan.md](e2e-test-plan.md), which lists every workflow
and edge case to cover. This document provides **three concrete test groups** with
exact user inputs, preference data, and expected algorithm outputs. Running through
these three groups in sequence should exercise every major code path.

> **How to use:** Follow each phase in order. Each phase builds on the previous
> state. Verification steps tell you exactly what to check in the browser.

---

## Reference: Scoring Formulas

These formulas are used to compute expected results throughout this document.

```
sportMultiplier = 2.0 - ((rank - 1) / (totalSports - 1))
  → single sport: 2.0
  → 2 sports: rank 1 = 2.0, rank 2 = 1.0
  → 3 sports: rank 1 = 2.0, rank 2 = 1.5, rank 3 = 1.0

sessionAdjustment = high: 1.0, medium: 0.7, low: 0.4

softBuddyBonus = 0 buddies: 1.0 | 1 buddy: 1.25 | 2 buddies: 1.35 | etc.

sessionScore = sportMultiplier × sessionAdjustment × softBuddyBonus
comboScore = sum of sessionScores

prunedPenalty = 0.1× (applied to sessions re-included during backup enhancement)
```

**Travel gap requirements** (based on driving time between zones):

| Condition           | Required Gap |
| ------------------- | ------------ |
| Same zone           | 90 min       |
| Trestles Beach Zone | 240 min      |
| Driving < 15 min    | 90 min       |
| Driving < 30 min    | 120 min      |
| Driving < 45 min    | 150 min      |
| Driving < 60 min    | 180 min      |
| Driving >= 60 min   | 210 min      |

**Key driving times referenced in these scenarios:**

| Route                   | Driving (min) | Required Gap |
| ----------------------- | ------------- | ------------ |
| Exposition Park ↔ DTLA  | 9.9 / 11.3    | 90 min       |
| Expo Park → Pasadena    | 27.33         | 120 min      |
| Pasadena → Expo Park    | 25.02         | 120 min      |
| Inglewood → DTLA        | 27.35         | 120 min      |
| Inglewood → Pasadena    | 36.25         | 150 min      |
| Pasadena → Inglewood    | 43.55         | 150 min      |
| Pasadena → Valley       | 25.52         | 120 min      |
| Valley → Pasadena       | 24.72         | 120 min      |
| Pasadena → Long Beach   | 49.38         | 180 min      |
| Long Beach → Pasadena   | 49.88         | 180 min      |
| Long Beach ↔ Long Beach | 0             | 90 min       |
| Pasadena ↔ Pasadena     | 0             | 90 min       |
| Expo Park ↔ Expo Park   | 0             | 90 min       |
| Long Beach → DTLA       | 37.13         | 150 min      |

**Key algorithm rules for locked sessions:**

- Locked (purchased) sessions bypass ALL filters (hard buddy, minBuddies, sold-out, OOB)
- Locked sessions must appear in EVERY combo on their day — unlocked sessions cannot appear without them
- Locked sessions are never pruned during convergence
- Locked sessions skip post-generation constraint validation
- If all combos containing locked sessions are travel-infeasible, the locked-only combo is used with travel feasibility ignored
- Sessions locked for a member but not in their preferences are injected with `interest = "high"`

---

# GROUP B — Solo Member (1 User)

**Purpose:** Verify basic algorithm scoring, combo ranking, travel feasibility,
and window ranking with the simplest possible setup. No buddy constraints.

## Phase B1: Setup

### Account

| Field        | Value                 |
| ------------ | --------------------- |
| First Name   | Solo                  |
| Last Name    | Tester                |
| Username     | `solotester`          |
| Email        | (any valid email)     |
| Password     | (any valid, 8+ chars) |
| Avatar Color | Purple                |

### Group Configuration

| Field      | Value           |
| ---------- | --------------- |
| Group Name | Solo Test Group |
| Date Mode  | Specific Dates  |
| Start Date | 2028-07-22      |
| End Date   | 2028-07-23      |

**Verify after creation:**

- Group appears in "Groups You Own" on home page
- Phase = "Entering Preferences"
- Invite code generated (8 hex chars)
- User 1 shown as owner

- [x] **Tested:** Phase B1: Setup

## Phase B2: Preferences

### Step 0 — Buddies

| Setting     | Value               |
| ----------- | ------------------- |
| Min Buddies | 0                   |
| Buddy Tags  | (none — solo group) |

### Step 1 — Sport Rankings

| Rank | Sport    |
| ---- | -------- |
| 1    | Swimming |
| 2    | Diving   |

Sport multipliers: Swimming = 2.0, Diving = 1.0

### Step 2 — Session Interests

| Session | Sport    | Zone      | Date   | Time        | Interest |
| ------- | -------- | --------- | ------ | ----------- | -------- |
| SWM01   | Swimming | Inglewood | Jul 22 | 09:30–11:30 | High     |
| SWM02   | Swimming | Inglewood | Jul 22 | 18:00–20:00 | High     |
| SWM03   | Swimming | Inglewood | Jul 23 | 09:30–11:30 | Medium   |
| SWM04   | Swimming | Inglewood | Jul 23 | 18:00–20:00 | High     |
| DIV11   | Diving   | Pasadena  | Jul 22 | 10:00–12:00 | Medium   |
| DIV12   | Diving   | Pasadena  | Jul 22 | 15:30–16:45 | High     |

### Step 3 — Review

Verify all preferences displayed correctly. No affected buddy warnings.

- [x] **Tested:** Phase B2: Preferences

## Phase B3: Generate Schedules

### Sanity Check — What Solo Tester Should See

The user ranked Swimming #1 and Diving #2. Both Swimming sessions are High interest,
DIV12 is High, DIV11 is Medium. The schedule should favor Swimming (higher multiplier)
and try to include Diving where it fits. The key constraint is geography: Diving is
in Pasadena and Swimming is in Inglewood (43.55 min drive → 150 min gap required).
This means DIV12 (ends 16:45) can't pair with SWM02 (starts 18:00) — only 75 min gap.

### Expected Output — Jul 22 (day score: 4.0)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | SWM01, SWM02 | 4.0   |
| Backup 1 | SWM01, DIV12 | 3.0   |
| Backup 2 | DIV11, SWM02 | 2.7   |

- Primary is both Swimming sessions (top sport, both High interest).
- B1 swaps evening Swimming for afternoon Diving (DIV12). SWM01 in morning stays.
- B2 swaps morning Swimming for morning Diving (DIV11). SWM02 in evening stays.
- No 3-session combos are feasible because DIV12→SWM02 gap is only 75 min (need 150).
- Session detail for any session: no "Attending" or "Interested" members shown (solo group).

### Expected Output — Jul 23 (day score: 3.4)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | SWM03, SWM04 | 3.4   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

- Only 2 sessions on this day, both in Primary. No alternatives exist for backups.
- SWM03 is Medium interest (score 1.4), SWM04 is High (score 2.0). Total 3.4.

### Group Schedule Sidebar

- "Selected Dates" shows "Jul 22 – Jul 23" (specific date mode — no window rankings).

### Verification Checklist — Phase B3

- [x] Phase changes to "Reviewing Schedules"
- [x] My Schedule Jul 22: P=[SWM01, SWM02] score=4.0, B1=[SWM01, DIV12] score=3.0, B2=[DIV11, SWM02] score=2.7
- [x] My Schedule Jul 23: P=[SWM03, SWM04] score=3.4, no B1, no B2
- [x] Calendar view: SWM01 (09:30–11:30) and SWM02 (18:00–20:00) positioned correctly with gap between them; DIV11/DIV12 visible when B1/B2 rank filter enabled
- [x] List view: Jul 22 first, then Jul 23. Sessions sorted by start time within each day
- [x] Session detail modal: shows correct session info, no "attending" or "interested" members (solo group)
- [x] No non-convergence warnings
- [x] Group Schedule sidebar: "Selected Dates" with "Jul 22 – Jul 23"

- [x] **Tested:** Phase B3: Generate Schedules

## Phase B4: Purchase Tracking

### B4.1 — Record a Purchase

1. Open Purchase Tracker
2. Save timeslot: start = any future datetime, end = 1 hour later
3. On session SWM02 (Jul 22): Record Purchase
   - Assignee: User 1 (self)
   - Price: $150.00
4. **Verify:**
   - Green checkmark on SWM02
   - Session detail shows "You" as attending with price $150
   - Overview: "Timeslot Assigned?" ✓, "Purchased Tickets?" ✓

- [x] **Tested:** B4.1

### B4.2 — Mark Sold Out + Regenerate

1. Mark SWM01 as Sold Out
2. **Verify:** Amber notification appears for owner about purchase data changes
3. Regenerate schedules

**What the schedule should look like after regeneration:**

SWM01 is sold out (no purchase) → gone. SWM02 is locked (purchased) → must appear in every combo. DIV12 can't pair with SWM02 (only 75 min gap, need 150). DIV11 CAN pair with SWM02 (360 min gap).

**Jul 22 (day score: 2.7):**

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | DIV11, SWM02 | 2.7   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

Compared to Phase B3: lost SWM01 from Primary, gained DIV11 (morning Diving + evening Swimming). Score dropped from 4.0 to 2.7. No backups because the only other feasible option is [SWM02] alone (subset of P).

**Jul 23:** unchanged — P=[SWM03, SWM04] score=3.4, no B1/B2.

**Purchase Tracker:** SWM01 appears in "Excluded Sessions" with "Sold Out" badge.

- [x] **Tested:** B4.2

### B4.3 — Mark Out of Budget + Regenerate

1. Mark DIV11 as Out of Budget
2. Regenerate

**What the schedule should look like:**

Now both SWM01 (sold out) and DIV11 (OOB) are excluded. Only SWM02 (locked) and DIV12 remain. DIV12+SWM02 is infeasible (75 min gap). So only SWM02 alone.

**Jul 22 (day score: 2.0):**

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | SWM02    | 2.0   |
| Backup 1 | —        | —     |
| Backup 2 | —        | —     |

Schedule is now just a single evening Swimming session. This makes sense: the user sold out their morning Swimming and marked morning Diving out of budget, and afternoon Diving can't reach evening Swimming in time.

**Jul 23:** unchanged.

**Purchase Tracker:** Excluded list shows SWM01 (sold out) and DIV11 (out of budget).

- [x] **Tested:** B4.3

### B4.4 — Unmark and Restore (SWM02 Still Locked)

SWM02 is still purchased from B4.1. Locked sessions must appear in every combo,
which prevents DIV12 from appearing (DIV12 ends 16:45, SWM02 starts 18:00 —
only 75 min gap, need 150 for Pasadena→Inglewood). The schedule does NOT return
to the original B3 state.

1. Unmark DIV11 Out of Budget
2. Unmark SWM01 Sold Out
3. Regenerate

**Jul 22 (day score: 4.0) — SWM02 locked:**

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | SWM01, SWM02 | 4.0   |
| Backup 1 | DIV11, SWM02 | 2.7   |
| Backup 2 | —            | —     |

- SWM02 is locked → must be in every combo.
- [SWM01, DIV12] is gone: DIV12 can't pair with locked SWM02 (75 min gap < 150 min).
- [DIV11, SWM02] is B1 (DIV11 ends 12:00, SWM02 starts 18:00, gap=360 ≥ 150 ✓).
- No B2: only [SWM02] alone remains, which has no new session vs B1.

**Jul 23:** unchanged — P=[SWM03, SWM04] score=3.4.

**Excluded sessions:** empty (SWM01 and DIV11 both restored).

4. **Verify:**
   - Jul 22: P=[SWM01, SWM02], B1=[DIV11, SWM02], no B2
   - Jul 23: P=[SWM03, SWM04]
   - Excluded sessions list empty

### B4.5 — Delete Purchase and Fully Restore

1. Delete the SWM02 purchase from B4.1
2. Regenerate
3. **Verify:** Schedule returns to original Phase B3 state (SWM02 no longer locked):
   - Jul 22: P=[SWM01, SWM02] score=4.0, B1=[SWM01, DIV12] score=3.0, B2=[DIV11, SWM02] score=2.7
   - Jul 23: P=[SWM03, SWM04] score=3.4
   - Excluded sessions list should be empty

- [x] **Tested:** B4.4
- [x] **Tested:** B4.5
- [x] **Tested:** Phase B4: Purchase Tracking (all sub-sections)

---

## Phase B5: Directional Travel Feasibility

**Purpose:** Verify that travel gap requirements use the correct directional
driving time (origin zone → destination zone), not a symmetric average.
DTLA → Valley is 26.97 min (gap 120 min), but Valley → DTLA is 32.08 min
(gap 150 min). A session pair with a 120-min gap is feasible in one
direction but not the other.

### B5.1 — Update Preferences

> **Prerequisite:** Restore solo group to clean state (unmark all sold-out/OOB,
> delete purchases, regenerate to confirm Phase B3 results). Then update
> preferences for this test.

1. **Solo Tester:** Update Sport Rankings to:

| Rank | Sport          | Multiplier |
| ---- | -------------- | ---------- |
| 1    | Boxing         | 2.0        |
| 2    | 3x3 Basketball | 1.5        |
| 3    | Table Tennis   | 1.0        |

2. **Solo Tester:** Update Session Interests (remove all previous, add these):

| Session | Sport          | Zone   | Date   | Time        | Interest |
| ------- | -------------- | ------ | ------ | ----------- | -------- |
| BOX15   | Boxing         | DTLA   | Jul 22 | 12:00–15:00 | High     |
| BK319   | 3x3 Basketball | Valley | Jul 22 | 17:00–19:00 | High     |
| TTE23   | Table Tennis   | DTLA   | Jul 22 | 21:00–23:15 | High     |

3. Generate schedules

### B5.2 — Verify Directional Travel Constraints

**Key driving times:**

| Route         | Driving (min) | Required Gap |
| ------------- | ------------- | ------------ |
| DTLA → Valley | 26.97         | 120 min      |
| Valley → DTLA | 32.08         | 150 min      |

**Travel feasibility analysis:**

| Pair              | Direction     | Gap     | Required | Feasible?               |
| ----------------- | ------------- | ------- | -------- | ----------------------- |
| BOX15 → BK319     | DTLA → Valley | 120 min | 120 min  | ✓ Yes                   |
| BK319 → TTE23     | Valley → DTLA | 120 min | 150 min  | ✗ No                    |
| BOX15 → TTE23     | DTLA → DTLA   | 360 min | 90 min   | ✓ Yes                   |
| BOX15,BK319,TTE23 | (3-session)   | —       | —        | ✗ No (second hop fails) |

The same 120-min gap is feasible for DTLA → Valley (26.97 min drive, needs
120 min) but NOT feasible for Valley → DTLA (32.08 min drive, needs 150 min).
If travel times were incorrectly symmetric, [BK319, TTE23] would appear as a
feasible combo.

**Expected Output — Jul 22 (day score: 3.5):**

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | BOX15, BK319 | 3.5   |
| Backup 1 | BOX15, TTE23 | 3.0   |
| Backup 2 | —            | —     |

- Primary pairs Boxing (DTLA, ends 15:00) with 3x3 Basketball (Valley,
  starts 17:00). DTLA → Valley = 26.97 min → 120 min gap required.
  Actual gap = 120 min. Feasible.
- B1 pairs Boxing (DTLA, ends 15:00) with Table Tennis (DTLA, starts 21:00).
  Same zone → 90 min gap required. Actual gap = 360 min. Feasible.
- [BK319, TTE23] is **not** a combo because Valley → DTLA = 32.08 min →
  150 min gap required. Actual gap = 120 min < 150 min. **Not feasible.**
- The 3-session combo [BOX15, BK319, TTE23] is also infeasible (second hop
  fails). No B2 exists because no remaining combo introduces a session not
  already in P or B1.

**Verify:**

- [x] Jul 22: P=[BOX15, BK319] score=3.5, B1=[BOX15, TTE23] score=3.0, no B2
- [x] [BK319, TTE23] does NOT appear as any combo (travel infeasible: Valley → DTLA needs 150 min, only 120 min available)
- [x] No 3-session combo exists

- [x] **Tested:** Phase B5: Directional Travel Feasibility

---

# GROUP A — Six Members (Main Test Group)

**Purpose:** Test the full application with buddy constraints, multi-member
interactions, travel feasibility, notifications, purchases, departures, and
regeneration. Algorithm verified in detail for **Jul 17** focus day.

## Phase A1: Account Setup

Create 6 user accounts:

| User   | First Name | Last Name | Username       | Avatar Color | Role   |
| ------ | ---------- | --------- | -------------- | ------------ | ------ |
| User 1 | Alex       | Owner     | `alexowner`    | Blue         | Owner  |
| User 2 | Blake      | Runner    | `blakerunner`  | Green        | Member |
| User 3 | Casey      | Gymnast   | `caseygymnast` | Pink         | Member |
| User 4 | Dana       | Beacher   | `danabeacher`  | Orange       | Member |
| User 5 | Ellis      | Diver     | `ellisdiver`   | Purple       | Member |
| User 6 | Frankie    | Allround  | `frankieall`   | Teal         | Member |

### Group Configuration

**Alex creates group:**

| Field            | Value            |
| ---------------- | ---------------- |
| Group Name       | Olympic Friends  |
| Date Mode        | Consecutive Days |
| Consecutive Days | 5                |

**Blake–Frankie join:** Alex shares invite code. Alex approves all.

**Verify:**

- All 6 members shown on overview with status "Joined"
- Phase = "Entering Preferences"

- [x] **Tested:** Phase A1: Account Setup

## Phase A2: Enter Preferences

### User 1 — Alex (Owner)

**Buddies:**

| Setting        | Value            |
| -------------- | ---------------- |
| Min Buddies    | 1                |
| User 2 (Blake) | Required (hard)  |
| User 3 (Casey) | Preferred (soft) |

> minBuddies must be ≥ hard buddy count. 1 hard buddy → minBuddies ≥ 1.

**Sport Rankings:**

| Rank | Sport                     | Multiplier |
| ---- | ------------------------- | ---------- |
| 1    | Athletics (Track & Field) | 2.0        |
| 2    | Artistic Gymnastics       | 1.0        |

**Session Interests:**

| Session | Sport        | Zone            | Date   | Time        | Interest |
| ------- | ------------ | --------------- | ------ | ----------- | -------- |
| ATH03   | Athletics    | Exposition Park | Jul 16 | 09:00–12:00 | High     |
| ATH04   | Athletics    | Exposition Park | Jul 16 | 15:15–18:55 | High     |
| ATH05   | Athletics    | Exposition Park | Jul 17 | 09:00–14:00 | High     |
| ATH06   | Athletics    | Exposition Park | Jul 17 | 16:30–19:30 | High     |
| ATH07   | Athletics    | Exposition Park | Jul 18 | 09:30–12:10 | High     |
| ATH08   | Athletics    | Exposition Park | Jul 18 | 15:50–18:50 | Medium   |
| ATH09   | Athletics    | Exposition Park | Jul 19 | 09:35–12:00 | High     |
| ATH10   | Athletics    | Exposition Park | Jul 19 | 16:00–18:40 | Medium   |
| GAR04   | Artistic Gym | DTLA            | Jul 16 | 09:45–13:35 | Medium   |
| GAR08   | Artistic Gym | DTLA            | Jul 17 | 17:15–20:30 | Medium   |
| GAR09   | Artistic Gym | DTLA            | Jul 18 | 18:00–20:30 | Low      |
| GAR10   | Artistic Gym | DTLA            | Jul 19 | 18:00–20:30 | Low      |

- [x] **Tested:** Phase A2: Enter Preferences

---

### User 2 — Blake

**Buddies:**

| Setting       | Value            |
| ------------- | ---------------- |
| Min Buddies   | 0                |
| User 1 (Alex) | Preferred (soft) |

**Sport Rankings:**

| Rank | Sport                     | Multiplier |
| ---- | ------------------------- | ---------- |
| 1    | Athletics (Track & Field) | 2.0        |
| 2    | Diving                    | 1.0        |

**Session Interests:**

| Session | Sport     | Zone            | Date   | Time        | Interest |
| ------- | --------- | --------------- | ------ | ----------- | -------- |
| ATH03   | Athletics | Exposition Park | Jul 16 | 09:00–12:00 | High     |
| ATH04   | Athletics | Exposition Park | Jul 16 | 15:15–18:55 | High     |
| ATH05   | Athletics | Exposition Park | Jul 17 | 09:00–14:00 | High     |
| ATH06   | Athletics | Exposition Park | Jul 17 | 16:30–19:30 | Medium   |
| ATH07   | Athletics | Exposition Park | Jul 18 | 09:30–12:10 | High     |
| ATH08   | Athletics | Exposition Park | Jul 18 | 15:50–18:50 | High     |
| ATH09   | Athletics | Exposition Park | Jul 19 | 09:35–12:00 | Medium   |
| DIV01   | Diving    | Pasadena        | Jul 16 | 10:00–12:30 | High     |
| DIV02   | Diving    | Pasadena        | Jul 17 | 10:00–12:00 | Medium   |
| DIV03   | Diving    | Pasadena        | Jul 17 | 15:30–16:45 | High     |
| DIV04   | Diving    | Pasadena        | Jul 18 | 10:00–12:30 | Medium   |

---

### User 3 — Casey

**Buddies:**

| Setting         | Value |
| --------------- | ----- |
| Min Buddies     | 0     |
| (no buddy tags) |       |

**Sport Rankings:**

| Rank | Sport                     | Multiplier |
| ---- | ------------------------- | ---------- |
| 1    | Artistic Gymnastics       | 2.0        |
| 2    | Athletics (Track & Field) | 1.5        |
| 3    | Beach Volleyball          | 1.0        |

**Session Interests:**

| Session | Sport            | Zone            | Date   | Time        | Interest |
| ------- | ---------------- | --------------- | ------ | ----------- | -------- |
| GAR04   | Artistic Gym     | DTLA            | Jul 16 | 09:45–13:35 | High     |
| GAR05   | Artistic Gym     | DTLA            | Jul 16 | 15:05–16:45 | High     |
| GAR08   | Artistic Gym     | DTLA            | Jul 17 | 17:15–20:30 | High     |
| GAR09   | Artistic Gym     | DTLA            | Jul 18 | 18:00–20:30 | High     |
| GAR10   | Artistic Gym     | DTLA            | Jul 19 | 18:00–20:30 | High     |
| ATH05   | Athletics        | Exposition Park | Jul 17 | 09:00–14:00 | Medium   |
| ATH07   | Athletics        | Exposition Park | Jul 18 | 09:30–12:10 | Medium   |
| ATH09   | Athletics        | Exposition Park | Jul 19 | 09:35–12:00 | Low      |
| VBV07   | Beach Volleyball | Long Beach      | Jul 17 | 09:00–12:00 | Low      |
| VBV10   | Beach Volleyball | Long Beach      | Jul 18 | 09:00–12:00 | Low      |

---

### User 4 — Dana

**Buddies:**

| Setting        | Value           |
| -------------- | --------------- |
| Min Buddies    | 1               |
| User 5 (Ellis) | Required (hard) |

**Sport Rankings:**

| Rank | Sport            | Multiplier |
| ---- | ---------------- | ---------- |
| 1    | Beach Volleyball | 2.0        |
| 2    | 3x3 Basketball   | 1.0        |

**Session Interests:**

| Session | Sport            | Zone       | Date   | Time        | Interest |
| ------- | ---------------- | ---------- | ------ | ----------- | -------- |
| VBV04   | Beach Volleyball | Long Beach | Jul 16 | 09:00–12:00 | High     |
| VBV05   | Beach Volleyball | Long Beach | Jul 16 | 14:00–18:00 | High     |
| VBV07   | Beach Volleyball | Long Beach | Jul 17 | 09:00–12:00 | High     |
| VBV08   | Beach Volleyball | Long Beach | Jul 17 | 14:00–18:00 | High     |
| VBV10   | Beach Volleyball | Long Beach | Jul 18 | 09:00–12:00 | High     |
| VBV11   | Beach Volleyball | Long Beach | Jul 18 | 14:00–18:00 | Medium   |
| VBV13   | Beach Volleyball | Long Beach | Jul 19 | 09:00–12:00 | High     |
| VBV14   | Beach Volleyball | Long Beach | Jul 19 | 14:00–18:00 | High     |
| BK301   | 3x3 Basketball   | Valley     | Jul 16 | 14:00–16:00 | Medium   |
| BK304   | 3x3 Basketball   | Valley     | Jul 17 | 14:00–16:00 | Medium   |
| BK307   | 3x3 Basketball   | Valley     | Jul 18 | 14:00–16:00 | Low      |

---

### User 5 — Ellis

**Buddies:**

| Setting         | Value |
| --------------- | ----- |
| Min Buddies     | 0     |
| (no buddy tags) |       |

**Sport Rankings:**

| Rank | Sport            | Multiplier |
| ---- | ---------------- | ---------- |
| 1    | Beach Volleyball | 2.0        |
| 2    | Diving           | 1.0        |

**Session Interests:**

| Session | Sport            | Zone       | Date   | Time        | Interest |
| ------- | ---------------- | ---------- | ------ | ----------- | -------- |
| VBV04   | Beach Volleyball | Long Beach | Jul 16 | 09:00–12:00 | High     |
| VBV05   | Beach Volleyball | Long Beach | Jul 16 | 14:00–18:00 | Medium   |
| VBV07   | Beach Volleyball | Long Beach | Jul 17 | 09:00–12:00 | High     |
| VBV08   | Beach Volleyball | Long Beach | Jul 17 | 14:00–18:00 | Medium   |
| VBV10   | Beach Volleyball | Long Beach | Jul 18 | 09:00–12:00 | High     |
| VBV11   | Beach Volleyball | Long Beach | Jul 18 | 14:00–18:00 | Medium   |
| VBV13   | Beach Volleyball | Long Beach | Jul 19 | 09:00–12:00 | High     |
| DIV01   | Diving           | Pasadena   | Jul 16 | 10:00–12:30 | Medium   |
| DIV02   | Diving           | Pasadena   | Jul 17 | 10:00–12:00 | High     |
| DIV04   | Diving           | Pasadena   | Jul 18 | 10:00–12:30 | Medium   |
| DIV06   | Diving           | Pasadena   | Jul 19 | 15:30–16:45 | High     |

---

### User 6 — Frankie

**Buddies:**

| Setting         | Value |
| --------------- | ----- |
| Min Buddies     | 0     |
| (no buddy tags) |       |

**Sport Rankings:**

| Rank | Sport          | Multiplier |
| ---- | -------------- | ---------- |
| 1    | Diving         | 2.0        |
| 2    | 3x3 Basketball | 1.0        |

**Session Interests:**

| Session | Sport          | Zone     | Date   | Time        | Interest |
| ------- | -------------- | -------- | ------ | ----------- | -------- |
| DIV01   | Diving         | Pasadena | Jul 16 | 10:00–12:30 | High     |
| DIV02   | Diving         | Pasadena | Jul 17 | 10:00–12:00 | High     |
| DIV03   | Diving         | Pasadena | Jul 17 | 15:30–16:45 | High     |
| DIV04   | Diving         | Pasadena | Jul 18 | 10:00–12:30 | High     |
| DIV05   | Diving         | Pasadena | Jul 18 | 15:30–17:30 | Medium   |
| DIV06   | Diving         | Pasadena | Jul 19 | 15:30–16:45 | High     |
| BK301   | 3x3 Basketball | Valley   | Jul 16 | 14:00–16:00 | Low      |
| BK304   | 3x3 Basketball | Valley   | Jul 17 | 14:00–16:00 | Medium   |
| BK307   | 3x3 Basketball | Valley   | Jul 18 | 14:00–16:00 | Low      |
| BK310   | 3x3 Basketball | Valley   | Jul 19 | 14:00–16:00 | Medium   |

---

## Phase A3: Generate Schedules — Algorithm Verification

After all 6 members complete preferences, Alex generates schedules.

### Sanity Check — What to Expect at a Glance

Before checking exact scores, verify that the overall schedules make intuitive sense:

- **Alex** sees ONLY Athletics sessions (no Artistic Gymnastics at all). This is correct:
  hard buddy Blake has zero Gymnastics interest, so every Gymnastics session gets
  filtered. Alex's #2 sport is completely invisible. Jul 19 is particularly thin
  (single ATH09, no backups) because Blake also has only 1 session that day.
- **Blake** gets Athletics primary every day with Diving appearing in backups (Jul 16–18).
  Good variety matching both ranked sports.
- **Casey** gets a mix of all 3 ranked sports (Gymnastics, Athletics, Beach Volleyball).
  No constraints → the algorithm freely picks best-scoring combos.
- **Dana** sees ONLY Beach Volleyball (no 3x3 Basketball at all). Same reason as Alex:
  hard buddy Ellis has zero 3x3 interest. Additionally, Dana has **no backups on any
  day** because after filtering only same-zone BV sessions remain, and both fit in Primary.
- **Ellis** gets Beach Volleyball primary with Diving in backups. Jul 19 is the standout:
  both sports appear together in Primary (travel timing works out).
- **Frankie** is Diving-focused. Jul 16 and Jul 19 are thin (1 Diving session available
  each day) with 3x3 Basketball as solo backups.

None of these are bugs — the hard buddy constraint is intentionally strict ("only attend
if my buddy attends too"). The schedules correctly reflect each user's preferences filtered
through their constraints.

### Expected Output — Jul 16

**Filtering:** Alex's GAR04 filtered (Blake doesn't have it). Dana's BK301 filtered (Ellis doesn't have it).

#### Alex — Jul 16 (day score: 4.0)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | ATH03, ATH04 | 4.0   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

GAR04 filtered out. ATH03+ATH04 both Expo Park, 195 min gap. No backups.

- [x] **Tested:** Alex Jul 16

#### Blake — Jul 16 (day score: 5.0)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | ATH03, ATH04 | 5.0   |
| Backup 1 | DIV01, ATH04 | 3.5   |
| Backup 2 | —            | —     |

Soft buddy Alex boosts ATH03 and ATH04 to 2.5 each. ATH03+DIV01 overlap. DIV01+ATH04 feasible (Pasadena→Expo 165 min gap ≥ 120 required).

- [x] **Tested:** Blake Jul 16

#### Casey — Jul 16 (day score: 4.0)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | GAR04, GAR05 | 4.0   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

Both DTLA, gap exactly 90 min (15:05−13:35). No backups.

- [x] **Tested:** Casey Jul 16

#### Dana — Jul 16 (day score: 4.0)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | VBV04, VBV05 | 4.0   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

BK301 filtered out. Both Long Beach, 120 min gap. No backups.

- [x] **Tested:** Dana Jul 16

#### Ellis — Jul 16 (day score: 3.4)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | VBV04, VBV05 | 3.4   |
| Backup 1 | DIV01        | 0.7   |
| Backup 2 | —            | —     |

VBV04+DIV01 overlap. DIV01+VBV05 infeasible (Pasadena→LB needs 180 min, only 90 min gap). DIV01 stands alone as B1.

- [x] **Tested:** Ellis Jul 16

#### Frankie — Jul 16 (day score: 2.0)

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | DIV01    | 2.0   |
| Backup 1 | BK301    | 0.4   |
| Backup 2 | —        | —     |

DIV01+BK301 infeasible (Pasadena→Valley needs 120 min, only 90 min gap). Each stands alone.

- [x] **Tested:** Frankie Jul 16

---

### Expected Output — Jul 17

**Filtering:** Alex's GAR08 filtered (Blake doesn't have it). Dana's BK304 filtered (Ellis doesn't have it). All other members: no filtering.

#### Alex — Jul 17 (day score: 4.5)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | ATH05, ATH06 | 4.5   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

No backups — only ATH05 and ATH06 survived hard buddy filter, both in Primary.

Session detail — **ATH05**: Attending: (none purchased yet). Interested: Alex (P), Blake (P), Casey (P).
Session detail — **ATH06**: Attending: (none). Interested: Alex (P), Blake (P, B1).

- [x] **Tested:** Alex Jul 17

#### Blake — Jul 17 (day score: 4.25)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | ATH05, ATH06 | 4.25  |
| Backup 1 | DIV02, ATH06 | 2.45  |
| Backup 2 | DIV02, DIV03 | 1.7   |

Key travel infeasibilities that shaped these combos:

- ATH05+DIV03 can't be together (90 min gap, need 120 for Expo→Pasadena)
- ATH05+DIV02 overlap (ATH05 runs 09:00–14:00 during DIV02's 10:00–12:00)
- DIV03+ATH06 overlap (DIV03 ends 16:45, ATH06 starts 16:30)

Session detail — **DIV02**: Interested: Blake (B1, B2), Ellis (P), Frankie (P).
Session detail — **DIV03**: Interested: Blake (B2), Frankie (P, B1).

- [x] **Tested:** Blake Jul 17

#### Casey — Jul 17 (day score: 3.05)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | ATH05, GAR08 | 3.05  |
| Backup 1 | VBV07, GAR08 | 2.4   |
| Backup 2 | —            | —     |

ATH05+VBV07 overlap so they can't be in the same combo.

Session detail — **GAR08**: Interested: Casey (P, B1), Alex (filtered — won't appear since GAR08 was filtered out of Alex's candidates).
Session detail — **VBV07**: Interested: Casey (B1), Dana (P), Ellis (P).

- [x] **Tested:** Casey Jul 17

#### Dana — Jul 17 (day score: 4.0)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | VBV07, VBV08 | 4.0   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

No backups — BK304 was filtered out by hard buddy (Ellis doesn't have it). Only VBV07 and VBV08 remain, both in Primary.

Session detail — **VBV07**: Interested: Casey (B1), Dana (P), Ellis (P).
Session detail — **VBV08**: Interested: Dana (P), Ellis (P).

- [x] **Tested:** Dana Jul 17

#### Ellis — Jul 17 (day score: 3.4)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | VBV07, VBV08 | 3.4   |
| Backup 1 | DIV02        | 1.0   |
| Backup 2 | —            | —     |

DIV02 can't pair with VBV07 (overlap) or VBV08 (Pasadena→LB needs 180 min, only 120 available), so it stands alone as B1.

Session detail — **DIV02**: Interested: Blake (B1, B2), Ellis (B1), Frankie (P).

- [x] **Tested:** Ellis Jul 17

#### Frankie — Jul 17 (day score: 4.0)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | DIV02, DIV03 | 4.0   |
| Backup 1 | DIV02, BK304 | 2.7   |
| Backup 2 | —            | —     |

DIV02+BK304 is feasible (exactly 120 min gap = 120 min required for Pasadena→Valley).
BK304+DIV03 overlap (BK304 ends 16:00, DIV03 starts 15:30) so can't be together.

Session detail — **BK304**: Interested: Dana (filtered — won't appear), Frankie (B1).

- [x] **Tested:** Frankie Jul 17

---

### Expected Output — Jul 18

**Filtering:** Alex's GAR09 filtered (Blake doesn't have it). Dana's BK307 filtered (Ellis doesn't have it).

#### Alex — Jul 18 (day score: 3.9)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | ATH07, ATH08 | 3.9   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

GAR09 filtered. Soft buddy Casey has ATH07 → ATH07 score boosted to 2.5. ATH08 medium interest = 1.4.

- [x] **Tested:** Alex Jul 18

#### Blake — Jul 18 (day score: 5.0)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | ATH07, ATH08 | 5.0   |
| Backup 1 | DIV04, ATH08 | 3.2   |
| Backup 2 | —            | —     |

Soft buddy Alex boosts ATH07 and ATH08 to 2.5 each. ATH07+DIV04 overlap. DIV04+ATH08 feasible (200 min gap ≥ 120).

- [x] **Tested:** Blake Jul 18

#### Casey — Jul 18 (day score: 3.05)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | ATH07, GAR09 | 3.05  |
| Backup 1 | VBV10, GAR09 | 2.4   |
| Backup 2 | —            | —     |

ATH07+VBV10 overlap. Both ATH07 and VBV10 pair with GAR09 (large time gap to evening session).

- [x] **Tested:** Casey Jul 18

#### Dana — Jul 18 (day score: 3.4)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | VBV10, VBV11 | 3.4   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

BK307 filtered. Both Long Beach. No backups.

- [x] **Tested:** Dana Jul 18

#### Ellis — Jul 18 (day score: 3.4)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | VBV10, VBV11 | 3.4   |
| Backup 1 | DIV04        | 0.7   |
| Backup 2 | —            | —     |

VBV10+DIV04 overlap. DIV04+VBV11 infeasible (Pasadena→LB needs 180 min, only 90 min gap). DIV04 alone as B1.

- [x] **Tested:** Ellis Jul 18

#### Frankie — Jul 18 (day score: 3.4)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | DIV04, DIV05 | 3.4   |
| Backup 1 | BK307        | 0.4   |
| Backup 2 | —            | —     |

DIV04+BK307 infeasible (Pasadena→Valley needs 120 min, only 90 min gap). BK307+DIV05 overlap. BK307 alone as B1.

- [x] **Tested:** Frankie Jul 18

---

### Expected Output — Jul 19

**Filtering:** Alex's ATH10 and GAR10 both filtered (Blake has neither). Dana's VBV14 filtered (Ellis doesn't have it).

#### Alex — Jul 19 (day score: 2.5)

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | ATH09    | 2.5   |
| Backup 1 | —        | —     |
| Backup 2 | —        | —     |

ATH10 and GAR10 both filtered by hard buddy. Only ATH09 remains. Soft buddy Casey has ATH09 → score boosted to 2.5.

- [x] **Tested:** Alex Jul 19

#### Blake — Jul 19 (day score: 1.75)

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | ATH09    | 1.75  |
| Backup 1 | —        | —     |
| Backup 2 | —        | —     |

Only session on Jul 19. Soft buddy Alex has ATH09 → score boosted. Medium interest × 1.25 = 1.75.

- [x] **Tested:** Blake Jul 19

#### Casey — Jul 19 (day score: 2.6)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | ATH09, GAR10 | 2.6   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

ATH09 (Expo, ends 12:00) + GAR10 (DTLA, starts 18:00) feasible (360 min gap ≥ 90). Both in P, no backups.

- [x] **Tested:** Casey Jul 19

#### Dana — Jul 19 (day score: 2.0)

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | VBV13    | 2.0   |
| Backup 1 | —        | —     |
| Backup 2 | —        | —     |

VBV14 filtered by hard buddy (Ellis doesn't have it). Only VBV13 remains.

- [x] **Tested:** Dana Jul 19

#### Ellis — Jul 19 (day score: 3.0)

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | VBV13, DIV06 | 3.0   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

VBV13 (LB, ends 12:00) + DIV06 (Pasadena, starts 15:30): 210 min gap ≥ 180 required (LB→Pasadena 49.88, <60). Feasible. Both in P, no backups.

- [x] **Tested:** Ellis Jul 19

#### Frankie — Jul 19 (day score: 2.0)

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | DIV06    | 2.0   |
| Backup 1 | BK310    | 0.7   |
| Backup 2 | —        | —     |

DIV06+BK310 overlap (BK310 ends 16:00, DIV06 starts 15:30). Each stands alone. DIV06 higher score → Primary.

- [x] **Tested:** Frankie Jul 19

---

### Overall Generation Checks

- [x] Algorithm converged in 1 iteration (no violations)
- [x] No non-convergence warnings for any member
- [x] No members in `membersWithNoCombos`
- [x] Phase transitions to "Reviewing Schedules"
- [x] Group Schedule shows all 6 members' sessions
- [x] No member has sessions on days outside Jul 16–19 (no preferences entered for other days)

---

## Phase A4: Notification & Regeneration Testing

### A4.1 — User Updates Preferences After Generation

1. **As Casey:** Go to Preferences → Step 2 (Sessions)
2. Add session ATH11 (Jul 20, Expo, 09:30–12:00) with High interest
3. Click "Next" (to advance/save)
4. **Schedule warning modal should appear:** "Schedules have already been generated. If you update preferences now, the owner will need to re-generate schedules for all group members. Are you sure you want to proceed?"
5. **First test Cancel:** Click Cancel → verify all steps revert to saved state (ATH11 removed)
6. Re-add ATH11, click Next again → modal appears → click **Proceed**
7. Save succeeds → `ackScheduleWarning()` called (only on save success)
8. **Verify as Casey:** `statusChangedAt` updated (now > `scheduleGeneratedAt`)
9. **Verify as Alex (owner):**
   - Blue notification: "Casey Gymnast has updated their preferences. These updates won't be reflected on your schedule until the owner regenerates schedules."
   - Generate button enabled with regeneration-needed state
   - Overview tab shows attention badge
10. **Verify as Blake (member):**
    - Blue notification about Casey's updated preferences
    - Message variant for non-owners: "...won't be reflected until the owner regenerates schedules"

- [x] **Tested:** A4.1

### A4.2 — New Member Joins After Generation

1. Create **User 7** (username: `guestuser7`, avatar: Yellow)
2. User 7 joins "Olympic Friends" with invite code
3. **Alex approves** User 7
4. User 7 enters preferences: Sport = Diving (#1), sessions = DIV02 (High), DIV03 (High)
5. **Verify as Alex:**
   - Blue notification: "Guest recently joined. Regenerate schedules to include them."
   - Generate button enabled

- [x] **Tested:** A4.2

### A4.3 — Regenerate with New Member

1. Alex regenerates
2. **Verify:** User 7 now has a schedule (DIV02 and DIV03 on Jul 17)
3. **Verify:** User 7's presence increases interest counts for DIV02 (now 4: Blake, Ellis, Frankie, User 7) and DIV03 (now 3: Blake, Frankie, User 7)
4. All notifications cleared, all departure tracking reset

- [x] **Tested:** A4.3
- [x] **Tested:** Phase A4: Notification & Regeneration Testing (all sub-sections)

---

## Phase A5: Purchase Tracking & Locked Session Testing

### A5.1 — Record Purchases

1. **Dana:** Save timeslot (any future date/time range)
2. **Dana:** Record purchase for VBV07 (Jul 17)
   - Assignees: Dana (self), Ellis
   - Price per ticket: $75.00
3. **Verify:** Green checkmark on VBV07 for both Dana and Ellis
4. **Verify as Ellis:** VBV07 shows "purchased" in session detail

- [x] **Tested:** A5.1

### A5.2 — Mark Sold Out + Regenerate

**Pre-action checks (before marking sold out):**

- [x] Dana must have a timeslot saved (from A5.1) — "Mark as Sold Out" button is disabled without one
- [x] Tooltip on disabled button (if no timeslot): "Enter your purchase timeslot on the Overview page to use this action."
- [x] "Mark as Out of Budget" button does NOT require a timeslot (always enabled)
- [x] Any member can mark any session as sold out (not just the session owner or buyer)

1. **Dana:** Mark VBV08 as Sold Out
2. **Verify notification flow:**
   - [x] `purchaseDataChangedAt` is set on the group
   - [x] Alex (owner) sees amber notification: "Some sessions have had their purchase status and/or availability updated since the last schedule generation. You may want to regenerate schedules to reflect these changes."
   - [x] Blake (member) sees amber notification: "Some sessions have had their purchase status and/or availability updated since the last schedule generation. These changes won't be reflected on member schedules until the owner regenerates schedules."
   - [x] Generate button on overview shows regeneration needed (enabled for Alex)
3. **Before regenerating — verify Excluded Sessions:**
   - [x] Dana and Ellis: VBV08 does NOT appear in Excluded Sessions (it's still on their current schedule from the original generation — sessions on schedule are never shown as excluded)
   - [x] Dana and Ellis: VBV08 should show a "Sold Out" indicator on the schedule/purchase tracker session row instead
   - [x] Alex, Blake, Casey, Frankie: VBV08 does NOT appear in their Excluded Sessions (it hasn't been excluded from any generation yet — excluded section only shows what was actually excluded from the last generation; the amber notification handles alerting about the change)
4. **Alex:** Regenerate

**What Dana should see on Jul 17 after regeneration (day score: 2.0):**

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | VBV07    | 2.0   |
| Backup 1 | —        | —     |
| Backup 2 | —        | —     |

VBV08 sold out → excluded. BK304 still filtered by hard buddy (Ellis doesn't have it). Only VBV07 (locked) remains. Single session, no backups. Down from P=[VBV07, VBV08] score=4.0 before.

**What Ellis should see on Jul 17 after regeneration (day score: 2.0):**

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | VBV07    | 2.0   |
| Backup 1 | —        | —     |
| Backup 2 | —        | —     |

VBV08 sold out → excluded. DIV02 still in candidates but can't pair with locked VBV07 (overlap). Unlocked sessions can't appear without the locked session → DIV02 drops out. Down from P=[VBV07, VBV08] with B1=[DIV02].

**Sanity check:** Both Dana and Ellis went from a 2-session Primary to a single-session day. This makes sense — VBV08 was their second BV session, and losing it means only the locked VBV07 survives.

**Other members:** Alex, Blake, Casey, Frankie are unaffected (VBV08 was not in their preferences).

**Purchase Tracker — Excluded Sessions (after regeneration):**

- [x] Dana and Ellis: VBV08 shows with "Sold Out" badge, NO "Pending Schedule Regeneration" tag (`wasSoldOut=true` matches `isSoldOut=true`)
- [x] Alex, Blake, Casey, Frankie: VBV08 also shows with "Sold Out" badge, NO "Pending Schedule Regeneration" tag (`soldOutCodesAtGeneration` now includes VBV08, matching current state)
- [x] No "Pending Schedule Regeneration" tags anywhere (VBV08 is appearing in excluded for the first time — the tag only appears when a session's status changes AFTER generation, e.g., unmarking a sold-out session post-generation)
- [x] Amber purchase-changes notification is gone (`purchaseDataChangedAt` reset to null after generation)

**Also verify:**

- [x] "Undo Sold Out" button visible on VBV08 in excluded sessions (requires timeslot — disabled with tooltip if no timeslot)
- [x] Searching for VBV08 in off-schedule sessions shows error: "VBV08 is in the excluded sessions list. You can manage it from the Excluded Sessions section below." (excluded sessions are blocked from off-schedule lookup)

- [x] **Tested:** A5.2

### A5.3 — Out of Budget

**Pre-action check:** "Mark as Out of Budget" does NOT require a timeslot (unlike sold out). OOB can only be marked on sessions visible in the Purchase Tracker (on-schedule sessions), not via off-schedule search.

Blake has DIV02 on their schedule (B1 and B2 on Jul 17 from Phase A3). Blake can mark it as OOB.

1. **Blake:** Mark DIV02 as Out of Budget in the Purchase Tracker
2. **Verify notification flow:**
   - [x] `purchaseDataChangedAt` updated on group
   - [x] Alex (owner) sees amber notification about purchase status changes
   - [x] Other members see member-variant notification
3. **Verify scope:** OOB is per-member — only Blake marked it
   - [x] Frankie's Purchase Tracker: DIV02 does NOT show "Out of Budget" badge
4. Regenerate

**What Blake should see on Jul 17 after regeneration (day score: 4.25):**

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | ATH05, ATH06 | 4.25  |
| Backup 1 | DIV03        | 1.0   |
| Backup 2 | —            | —     |

DIV02 excluded for Blake (OOB). DIV03 still available but can't pair with ATH05 (90 min gap, need 120 for Expo→Pasadena) or ATH06 (overlap), so it stands alone as B1. Blake lost the multi-session backups B1=[DIV02, ATH06] and B2=[DIV02, DIV03] since both contained DIV02.

**Sanity check:** Primary unchanged (never had DIV02). Backups degraded from two 2-session combos to a single standalone DIV03. DIV03 survived because only DIV02 was marked OOB.

**Other members unaffected:** Frankie still has DIV02 in their Primary. Ellis doesn't have DIV02 on schedule (unrelated to OOB).

**Excluded sessions for Blake:** DIV02 (out of budget). VBV08 also shows (sold out, group-wide via `soldOutCodesAtGeneration`).

- [x] **Tested:** A5.3

### A5.4 — Purchase Overrides Exclusion (Locked Beats OOB)

Blake marked DIV02 as OOB in A5.3. DIV02 is now in Blake's Excluded Sessions and can't
be accessed for purchasing (off-schedule search doesn't show excluded sessions). Another
member must purchase it for Blake.

1. **Dana** (has timeslot from A5.1): Record purchase for DIV02
   - Assignees: **Blake** (not Dana — Dana is the buyer, Blake is the assignee)
   - Price: $50.00
2. **Verify:** Purchase recorded. DIV02 shows green checkmark. Blake listed as assignee. Dana listed as buyer.
3. **Verify:** Blake did NOT need a timeslot — only the buyer (Dana) needs one
4. **Alex:** Regenerate

**What Blake should see on Jul 17 after regeneration (day score: 2.45):**

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | DIV02, ATH06 | 2.45  |
| Backup 1 | DIV02, DIV03 | 1.7   |
| Backup 2 | —            | —     |

DIV02 is now locked (purchased) → included despite OOB marking. But locked DIV02 must appear in EVERY combo, and ATH05 overlaps with DIV02 (Expo 09:00–14:00 vs Pasadena 10:00–12:00). So ATH05 is forced out of all combos. The schedule does NOT return to Phase A3 — it's fundamentally different because of the locked session constraint.

Feasible combos: [DIV02, ATH06] (gap 270 ≥ 120 ✓), [DIV02, DIV03] (same zone, gap 210 ✓), [DIV02] alone.

**Sanity check:** Dana bought tickets for Blake for DIV02, which makes it locked for Blake and overrides Blake's OOB exclusion. However, the locked DIV02 now forces out ATH05 (they overlap). Blake's Primary dropped from score 4.25 to 2.45 — a significant downgrade. This is the trade-off of locked sessions: they guarantee attendance but can crowd out higher-scoring sessions. Blake's schedule is now Diving-heavy instead of Athletics-heavy.

**Verify:**

- [x] Blake's Primary is [DIV02, ATH06] NOT [ATH05, ATH06] (ATH05 can't coexist with locked DIV02)
- [x] DIV02 still shows "Out of Budget" badge in Purchase Tracker but IS on the schedule
- [x] Blake's excluded sessions: only VBV08 (sold out). DIV02 no longer excluded (locked override).
- [x] Frankie still has DIV02 in Primary (unaffected by Blake's OOB/purchase)

- [x] **Tested:** A5.4

### A5.5 — Remove Last Assignee Auto-Deletes Purchase

When the last assignee is removed from a purchase, the purchase record itself
should be automatically deleted. This prevents orphaned purchase rows with no
assignees.

> **Prerequisite:** A5.4 completed. Dana's purchase of DIV02 for Blake exists.

1. **Dana:** Open Purchase Tracker, find DIV02
2. **Verify:** DIV02 shows as purchased with Blake as assignee, Dana as buyer
3. **Dana:** Remove Blake as assignee from DIV02 purchase
4. **Verify:**
   - [x] Purchase record for DIV02 is completely gone (not just the assignee — the entire purchase)
   - [x] DIV02 no longer shows green checkmark or any purchased indicator
   - [x] Blake's Purchase Tracker no longer shows DIV02 as purchased
   - [x] Amber notification appears (purchaseDataChangedAt updated)
5. **Alex:** Regenerate
6. **Verify:** DIV02 is no longer locked for Blake. Blake's Jul 17 returns to pre-A5.4
   state (OOB still applies since Blake marked it in A5.3):
   - Blake Jul 17: P=[ATH05, ATH06] score=4.25, B1=[DIV03] score=1.0

- [x] **Tested:** A5.5
- [x] **Tested:** Phase A5: Purchase Tracking & Locked Session Testing (all sub-sections)

---

## Phase A6: Member Departure Scenarios

> These scenarios use a **separate group** with Alex, Blake, and Casey from Group A
> to test departure flows in isolation.

### Departure Group Setup

**Alex creates a new group:**

| Field            | Value            |
| ---------------- | ---------------- |
| Group Name       | Departure Test   |
| Date Mode        | Consecutive Days |
| Consecutive Days | 3                |

Blake and Casey join via invite code, Alex approves both.

**Alex preferences:**

- Buddies: minBuddies=1, Blake = Required (hard)
- Sports: Beach Volleyball (#1)
- Sessions: VBV04 (Jul 16, High), VBV05 (Jul 16, High), VBV07 (Jul 17, High), VBV08 (Jul 17, High), VBV10 (Jul 18, High), VBV11 (Jul 18, High)

**Blake preferences:**

- Buddies: minBuddies=0, no tags
- Sports: Beach Volleyball (#1)
- Sessions: VBV04 (Jul 16, High), VBV05 (Jul 16, High), VBV07 (Jul 17, High), VBV08 (Jul 17, High), VBV10 (Jul 18, High), VBV11 (Jul 18, High)

**Casey preferences:**

- Buddies: minBuddies=0, no tags
- Sports: Beach Volleyball (#1)
- Sessions: VBV04 (Jul 16, High), VBV07 (Jul 17, High), VBV10 (Jul 18, High)

**Generate schedules. Expected:**

- All 3 members get BV sessions on Jul 16–18
- Alex: P=[VBV04, VBV05], P=[VBV07, VBV08], P=[VBV10, VBV11] (all pass hard buddy filter since Blake has the same sessions)
- Blake: same as Alex
- Casey: P=[VBV04], P=[VBV07], P=[VBV10] (1 session per day, no backups)

- [x] **Tested:** Departure Group Setup

### A6.1 — Post-Generation Joiner (Schedule Preserved)

1. **Dana** (from Group A) joins "Departure Test" with invite code, Alex approves
2. Dana enters preferences: Sport = Beach Volleyball, sessions = VBV04 (High)
3. **Do NOT regenerate** — Dana is a post-generation joiner
4. **Alex:** Remove Dana
5. **Verify:**
   - [x] Phase stays "Reviewing Schedules"
   - [x] Alex, Blake, Casey schedules unchanged
   - [x] No "updated preferences" notification
   - [ ] Dana tracked in `departedMembers`: `{name: "Dana ...", departedAt: ..., wasPartOfSchedule: false}`
   - [x] Blue (info) notification: "Dana ... recently left the group." — **no** "regenerate schedules" suffix
   - [x] Only other departure-related notifications if anyone had Dana as buddy

- [x] **Tested:** A6.1

### A6.2 — Blake Departs (Hard Buddy, Part of Generation)

1. **Blake:** Click "Leave Group"
   - [x] Confirmation modal warns: schedules will be deleted and regeneration needed
2. **Blake:** Confirm leave
3. **Verify side effects:**
   - [x] All combos, comboSessions, windowRankings deleted
   - [x] Phase → "Entering Preferences"
   - [x] Blake tracked in `departedMembers`: `{name: "Blake Runner", departedAt: ..., wasPartOfSchedule: true}`
   - [x] Alex had Blake as hard buddy → Alex in `affectedBuddyMembers`: `{AlexId: ["Blake Runner"]}`
   - [x] All schedule-dependent tabs (My Schedule, Group Schedule, Purchase Planner) show warning icon: "Schedules may need to be regenerated."
4. **Verify NO false "updated preferences" notification:**
   - [x] Alex does NOT see "Alex Owner has updated their preferences" or similar — member statuses are not bumped on departure
   - [x] Casey does NOT see "updated preferences" for anyone
   - [x] Only notifications visible: "Blake Runner recently left the group" (red) + affected buddy for Alex
5. **Verify as Alex (owner):**
   - [x] Red notification: "Blake Runner recently left the group. You will need to regenerate schedules."
   - [x] Red notification about affected buddies (Blake was Alex's hard buddy)
   - [x] Generate button disabled: "All affected members must review their buddy preferences first."
6. **Verify as Casey (member):**
   - [x] Red notification: "Blake Runner recently left the group. Wait for the group owner to regenerate schedules."
   - [x] No affected buddy notification for Casey (Casey had no buddy constraints)

- [x] **Tested:** A6.2

### A6.3 — Alex Reviews Affected Buddies

1. **Alex:** Go to Preferences → Review step
   - [x] Affected buddy warning visible: "Blake Runner was automatically removed from your required buddies list"
2. Click "Confirm" to acknowledge
   - [x] Warning disappears, `affectedBuddyMembers` cleared
3. **Alex:** Go to Buddies step → remove Blake as hard buddy, set minBuddies=0
4. Save

- [x] **Tested:** A6.3

### A6.4 — Regenerate After Departure

1. **Alex:** Generate schedules (now unblocked)
2. **Verify:**
   - [x] Schedules generated for Alex and Casey (2 remaining members)
   - [x] Phase → "Reviewing Schedules"
   - [x] Alex's schedule: same sessions, no hard buddy constraint (all BV sessions pass freely)
   - [x] Casey's schedule: unchanged (was never affected by Blake)
   - [x] Departed members notification cleared
   - [x] No "updated preferences" notifications

- [x] **Tested:** A6.4

### A6.5 — Blake Rejoins

1. **Blake:** Re-request to join "Departure Test" with the same invite code
   - [x] Blake appears in "Pending Requests" on home page
2. **Alex:** Approve Blake
   - [x] `departedMembers` was already cleared by A6.4 regeneration, so no `rejoinedAt` is set — Blake is simply a new joiner
3. **Verify notifications:**
   - [x] No "left and rejoined" notification (departed entry was cleared on regeneration)
   - [x] Blue "Blake Runner recently joined the group. Wait for them to enter their preferences and then regenerate schedules."
4. **Blake:** Must re-enter all preferences from scratch (member row was deleted on departure)
5. Blake re-enters same preferences as setup, saves
6. **Alex:** Regenerate
   - [x] All 3 members have schedules again
   - [x] Departed/rejoined notifications cleared

- [x] **Tested:** A6.5

### A6.6 — Buyer Departure Cascades Purchase Deletion

When a member who **created** purchases for other members departs, all their
purchase records are CASCADE-deleted — including ticket assignments for other
members. This tests that the cascade works correctly and that the remaining
members' Purchase Trackers reflect the loss.

> **Prerequisite:** A6.5 completed. All 3 members (Alex, Blake, Casey) are in
> the "Departure Test" group with schedules generated. All have BV sessions
> on Jul 16–18.

**Setup:**

1. **Alex:** Save a purchase timeslot (any future date/time range)
2. **Alex:** Record purchase for VBV04 (Jul 16, Long Beach)
   - Assignees: **Alex** (self) and **Blake**
   - Price per ticket: $100.00
3. **Verify:** VBV04 shows green checkmark for both Alex and Blake
4. **Verify as Blake:** VBV04 shows "purchased" in session detail, Alex listed as buyer

**Departure:**

5. **Alex:** Remove Casey from the group (to reset schedules without affecting purchases — Casey has no purchase data, so no red warning)
6. **Verify:** Phase → "Entering Preferences", schedules gone, Casey departure tracked
7. Casey re-joins, re-enters preferences, Alex regenerates (restore 3-member state with purchase intact)
8. **Verify:** VBV04 still purchased for Alex and Blake after regeneration

**Now test the cascading deletion:**

9. **Blake:** Click "Leave Group"
10. **Verify:** Confirmation modal shows red purchase warning:
    - "You have ticket purchase records. This action will:"
    - "Remove your ticket assignments from purchases made by other members"
11. **Blake:** Confirm leave
12. **Verify side effects:**
    - [x] Blake's assignee record on VBV04 is gone (CASCADE from member deletion)
    - [x] Alex's purchase for VBV04 still exists (Alex is still a member)
    - [x] Alex is now the only assignee on the VBV04 purchase
    - [x] VBV04 still shows green checkmark for Alex
    - [x] Phase → "Entering Preferences" (Blake was part of generation)

**Now test buyer departure:**

13. Blake re-joins, Alex approves, Blake re-enters preferences, Alex regenerates
14. **Alex:** Record a new purchase for VBV07 (Jul 17)
    - Assignees: **Blake** (not Alex — Alex is buyer, Blake is sole assignee)
    - Price per ticket: $75.00
15. **Verify:** Blake's Purchase Tracker shows VBV07 as purchased
16. **Alex:** Click "Leave Group" — **wait, Alex is owner.** Transfer ownership to Casey first.
17. **Alex:** Transfer ownership to Casey via Group Settings
18. **Alex:** Click "Leave Group"
19. **Verify:** Confirmation modal shows red purchase warning:
    - "You have ticket purchase records. This action will:"
    - "Delete all purchases you recorded (including tickets bought for other members)"
20. **Alex:** Confirm leave
21. **Verify side effects:**
    - [x] Alex's purchase record for VBV07 is CASCADE-deleted (Alex was the buyer)
    - [x] Blake's assignee record on VBV07 is also deleted (child of the deleted purchase)
    - [x] Blake's Purchase Tracker no longer shows VBV07 as purchased
    - [x] Alex's earlier purchase for VBV04 is also CASCADE-deleted (Alex was the buyer)
    - [x] VBV04 no longer shows as purchased for anyone
    - [x] On regeneration: VBV07 and VBV04 are no longer locked for anyone

- [x] **Tested:** A6.6
- [x] **Tested:** Phase A6: Member Departure Scenarios (all sub-sections)

---

## Phase A7: Convergence, Pruning & Non-Convergence

> **Prerequisite:** Restore the group to 6 original members (Alex–Frankie) with original
> preferences from Phase A2. Remove User 7 if still present. Unmark all sold-out and OOB.
> Delete all purchases. Regenerate clean to confirm Phase A3 results.

### A7.1 — MinBuddies Partial Filtering

Tests that minBuddies filters out sessions with too few interested members on some
days while keeping sessions that meet the threshold on other days.

**Setup:**

1. **Casey:** Update buddies → set minBuddies = 2
2. Regenerate

**What gets filtered for Casey (minBuddies=2 means need count ≥ 3):**

| Session | Day    | Interested         | Count−1 | Passes?    |
| ------- | ------ | ------------------ | ------- | ---------- |
| GAR04   | Jul 16 | Alex, Casey        | 1       | ✗ filtered |
| GAR05   | Jul 16 | Casey              | 0       | ✗ filtered |
| ATH05   | Jul 17 | Alex, Blake, Casey | 2       | ✓          |
| GAR08   | Jul 17 | Alex, Casey        | 1       | ✗ filtered |
| VBV07   | Jul 17 | Casey, Dana, Ellis | 2       | ✓          |
| ATH07   | Jul 18 | Alex, Blake, Casey | 2       | ✓          |
| GAR09   | Jul 18 | Alex, Casey        | 1       | ✗ filtered |
| VBV10   | Jul 18 | Casey, Dana, Ellis | 2       | ✓          |
| ATH09   | Jul 19 | Alex, Blake, Casey | 2       | ✓          |
| GAR10   | Jul 19 | Alex, Casey        | 1       | ✗ filtered |

All Gymnastics sessions filtered (only Alex + Casey interested = 2 members). Athletics and BV sessions survive (3 members interested).

**What Casey should see:**

- **Jul 16:** No sessions (both GAR04 and GAR05 filtered)
- **Jul 17:** ATH05 and VBV07 survive. They overlap (Expo 09:00–14:00 vs LB 09:00–12:00) so separate combos. P=[ATH05] score=1.05, B1=[VBV07] score=0.4.
- **Jul 18:** ATH07 and VBV10 survive. Same overlap pattern. P=[ATH07] score=1.05, B1=[VBV10] score=0.4.
- **Jul 19:** Only ATH09 survives. P=[ATH09] score=0.6.

**Sanity check:** Casey's #1 sport (Gymnastics) is completely gone — only 2 members were ever interested in Gymnastics sessions, falling below the minBuddies=2 threshold. Casey is left with their #2 and #3 sports only. Jul 16 is empty. But Casey is NOT in `membersWithNoCombos` because Jul 17–19 still have combos.

**Verify:**

- [x] Casey's My Schedule shows no sessions for Jul 16
- [x] Casey has sessions on Jul 17, 18, 19 (Athletics and BV only, no Gymnastics)
- [x] Casey is NOT in `membersWithNoCombos`
- [x] Phase is "Reviewing Schedules" (all members have at least some combos)
- [x] No non-convergence warning

- [x] **Tested:** A7.1

### A7.2 — membersWithNoCombos (Total Filterout)

To put a member in `membersWithNoCombos`, ALL their sessions across ALL days must be filtered out.

**Setup:**

1. **Casey:** Set minBuddies = 5 (only 5 other members in group → need 5 others per session, meaning ALL 6 members must be interested)
2. No session in Casey's preferences has all 6 members interested
3. Regenerate

**Expected:**

- Every session for Casey fails minBuddies filter (no session has 6 interested members)
- Casey ends up in `membersWithNoCombos`
- Phase stays **"preferences"** (NOT "schedule_review")
- Other members' combos are saved to DB but not visible in the UI (schedule tabs show "Schedules have not been generated yet" because phase ≠ "schedule_review")

**Verify:**

- [x] Phase stays "Entering Preferences"
- [x] Red notification: "Some members received no sessions on their schedules..."
- [x] Casey's Review step shows "no combos" warning instructing them to update preferences
- [x] Generate button shows: "Members without sessions need to update their preferences"
- [x] All schedule-dependent tabs (My Schedule, Group Schedule, Purchase Planner) show warning icon: "Schedules unavailable — some members didn't receive any sessions."

- [x] **Tested:** A7.2

### A7.3 — Trigger Non-Convergence

Non-convergence requires a member's primary session to fail validation (hard buddy
doesn't have it in any combo) AND for this to repeat across all 5 iterations. The
trick: give the hard buddy so many high-scoring sessions on one day that they fill
P/B1/B2 with no room for shared sessions.

**Setup — modify Alex and Blake preferences:**

> This requires significant preference changes. The key: Alex needs exactly 5 sessions
> on Jul 17 that are ALL mutually travel-infeasible (so only 1 session per primary →
> 1 prune per iteration → reaches iteration 5). Blake needs all 5 as candidates but
> with Low interest so Volleyball dominance isn't broken by soft buddy bonus.

> **IMPORTANT:** Verify Blake's buddy settings FIRST before changing anything else.
> If any previous A7 test changed Blake's buddies (e.g., setting Alex as hard buddy),
> those changes persist in Group A and will silently filter out Blake's Volleyball
> sessions. A hard buddy or minBuddies > 0 on Blake causes VVO sessions to be
> filtered (only Blake is interested in Volleyball → count=1, fails minBuddies;
> Alex doesn't have VVO sessions → fails hard buddy filter).

1. **Blake:** Verify buddies are: minBuddies=**0**, Alex = **Preferred (soft)**, no Required buddies. Fix if different.

2. **Casey:** Restore minBuddies=**0** (undo A7.1/A7.2)

3. **Blake:** Update sport rankings to: Volleyball (#1), Athletics (#2), Diving (#3), Beach Volleyball (#4), Fencing (#5), Boxing (#6).
   Update session interests for Jul 17:
   - VVO09 (Volleyball, Anaheim, 09:00–11:30) — **High**
   - VVO10 (Volleyball, Anaheim, 13:00–15:30) — **High**
   - VVO11 (Volleyball, Anaheim, 17:00–19:30) — **High**
   - VVO12 (Volleyball, Anaheim, 21:00–23:30) — **High**
   - ATH05 (Athletics, Expo, 09:00–14:00) — **Low** (change from High)
   - DIV02 (Diving, Pasadena, 10:00–12:00) — **Low** (change from Medium)
   - VBV07 (Beach Volleyball, Long Beach, 09:00–12:00) — **Low** (new)
   - FEN05 (Fencing, DTLA, 09:00–16:20) — **Low** (new)
   - BOX05 (Boxing, DTLA, 12:00–15:00) — **Low** (new)
   - **Remove ATH06 and DIV03** from Jul 17 (to eliminate confounding variables)
   - Keep other-day sessions unchanged

4. **Alex:** Update sport rankings to: Athletics (#1), Diving (#2), Beach Volleyball (#3), Fencing (#4), Boxing (#5).
   Update session interests for Jul 17:
   - ATH05 (Athletics, Expo, 09:00–14:00) — **High** (keep)
   - DIV02 (Diving, Pasadena, 10:00–12:00) — **High** (new)
   - VBV07 (Beach Volleyball, Long Beach, 09:00–12:00) — **High** (new)
   - FEN05 (Fencing, DTLA, 09:00–16:20) — **High** (new)
   - BOX05 (Boxing, DTLA, 12:00–15:00) — **High** (new)
   - **Remove ATH06** from Jul 17, remove GAR sessions (Gymnastics dropped from rankings)
   - Keep hard buddy = Blake, minBuddies=1, keep other-day sessions

5. Regenerate

**Why this triggers non-convergence (Jul 17):**

**Blake's Volleyball dominance:** 4 Volleyball sessions (all Anaheim, 90 min gaps)
score 2.0 each (Volleyball rank #1, mult=2.0, High interest). Three-session combos
score 6.0 and fill P/B1/B2. Blake's Low-interest shared sessions can't compete even
with soft buddy bonus (×1.25). Highest: ATH05 = 0.4 × 1.6 × 1.25 = 0.80 (rank #2
of 6 sports → mult=1.8... actually let me just say: all well below 2.0).

**Alex's 5 mutually infeasible sessions:** All overlap or have insufficient gaps:

| Pair          | Why infeasible                                             |
| ------------- | ---------------------------------------------------------- |
| ATH05 + DIV02 | Overlap (09:00–14:00 vs 10:00–12:00)                       |
| ATH05 + VBV07 | Overlap (09:00–14:00 vs 09:00–12:00)                       |
| ATH05 + FEN05 | Overlap (09:00–14:00 vs 09:00–16:20)                       |
| ATH05 + BOX05 | Overlap (ends 14:00, starts 12:00)                         |
| DIV02 + VBV07 | Overlap (10:00–12:00 vs 09:00–12:00)                       |
| DIV02 + FEN05 | Overlap (10:00–12:00 vs 09:00–16:20)                       |
| DIV02 + BOX05 | Gap=0, Pasadena→DTLA needs 120 min                         |
| VBV07 + FEN05 | Overlap (09:00–12:00 vs 09:00–16:20)                       |
| VBV07 + BOX05 | Gap=0, LB→DTLA needs 150 min                               |
| FEN05 + BOX05 | Overlap (09:00–16:20 contains 12:00–15:00, same zone DTLA) |

Every combo is a single session. Alex's scores (5 sports: 2.0, 1.75, 1.5, 1.25, 1.0):

- ATH05: 2.0 × 1.0 × 1.25 (Casey has it) = **2.5**
- DIV02: 1.75 × 1.0 = **1.75**
- VBV07: 1.5 × 1.0 = **1.5**
- FEN05: 1.25 × 1.0 = **1.25**
- BOX05: 1.0 × 1.0 = **1.0**

Exactly 1 pruned per iteration (highest-scoring singleton becomes primary, violates):

| Iteration | Alex's Primary | Score | Blake has it in combos?       | Result                                          |
| --------- | -------------- | ----- | ----------------------------- | ----------------------------------------------- |
| 1         | ATH05          | 2.5   | No (Volleyball fills P/B1/B2) | Violation → prune                               |
| 2         | DIV02          | 1.75  | No                            | Violation → prune                               |
| 3         | VBV07          | 1.5   | No                            | Violation → prune                               |
| 4         | FEN05          | 1.25  | No                            | Violation → prune                               |
| 5         | BOX05          | 1.0   | No                            | **Violation at iteration 5 → converged=false!** |

`nonConvergenceMembers = [Alex]`.

**What Alex should see on Jul 17 (best-effort, day score: 1.0):**

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | BOX05    | 1.0   |
| Backup 1 | ATH05    | 0.25  |
| Backup 2 | VBV07    | 0.19  |

Primary is the last session standing after 4 rounds of pruning. Backups come from
the **backup enhancement** phase: after the convergence loop exits with `converged=false`,
pruned sessions are re-included in backups with a 0.1× score penalty. Casey (Alex's
soft buddy) has ATH05 and VBV07, giving those a 1.25× bonus that pushes them above
DIV02 (0.175) in backup ranking. Other days are unaffected.

**What Blake should see on Jul 17 (day score: 6.0):**

| Rank     | Sessions            | Score |
| -------- | ------------------- | ----- |
| Primary  | VVO09, VVO10, VVO11 | 6.0   |
| Backup 1 | VVO09, VVO10, VVO12 | 6.0   |
| Backup 2 | VVO09, VVO11, VVO12 | 6.0   |

**Verify non-convergence UI:**

- [x] Alex sees amber warning banner above My Schedule: "The algorithm was not able to meet all of your requirements..."
- [x] Alex sees amber notification in Overview Notifications (visible ONLY to Alex)
- [x] Blake, Casey, Dana, Ellis, Frankie do NOT see the amber warning
- [x] Phase is "Reviewing Schedules" (schedule IS saved, just with violations)
- [x] Generate button disabled until a member updates preferences (regenerating without changes would produce the same non-convergence)

**Sanity check:** Blake's Volleyball dominance crowds out all shared sessions from
Blake's combos. Alex depends on Blake (hard buddy) but every session fails
validation because Blake's schedule has no room. After 5 iterations of pruning,
Alex is left with a single Boxing session. The fix would be to remove Blake as
hard buddy or share Volleyball sessions with Blake.

- [x] **Tested:** A7.3

### A7.4 — Locked Session Bypasses Hard Buddy Filter

Locked sessions bypass all constraint filters. This tests that a locked session
appears even when the hard buddy doesn't have it.

**Setup:**

1. Restore all preferences to Phase A2 state (undo A7.1–A7.3 changes)
2. **Dana:** Save a timeslot (any future date/time range)
3. **Dana:** Record purchase for VBV07 (Jul 17), assignee = Dana (self), price = $75
4. **Dana:** Change hard buddy from Ellis to Frankie, keep minBuddies=1
5. Regenerate

**Expected for Dana on Jul 17:**

Frankie's Jul 17 sessions: DIV02, DIV03, BK304. Frankie does NOT have VBV07.

- VBV07: locked → bypasses hard buddy filter (Frankie doesn't have it, but doesn't matter)
- VBV08: Frankie doesn't have it → filtered out
- BK304: Frankie has it → passes filter

After filter: VBV07 (locked), BK304.

Travel: VBV07 (LB, ends 12:00) → BK304 (Valley, starts 14:00). Long Beach → Valley = 50.97 → < 60 → 180 min gap. Gap = 120 min. 120 < 180 → **NOT feasible.**

BK304 can't pair with locked VBV07. Only combo: [VBV07] alone.

**P=[VBV07] score=2.0.** No B1, no B2.

Post-validation: VBV07 is locked → skips validation. No violations.

**Sanity check:** Dana's hard buddy Frankie doesn't have VBV07 at all, but VBV07 still appears because it's locked. This is correct — purchased tickets always appear. The trade-off: VBV07 prevents BK304 from appearing (travel infeasible), leaving Dana with a single-session day.

**Verify:**

- [x] Dana's Jul 17: P=[VBV07] only (despite hard buddy Frankie not having VBV07)
- [x] No non-convergence warning (locked sessions skip validation)
- [x] No constraint violation flagged for VBV07

- [x] **Tested:** A7.4
- [x] **Tested:** Phase A7: Convergence, Pruning & Non-Convergence (all sub-sections)

---

## Phase A8: Window Ranking Verification

> **Prerequisite:** Restore all preferences to original Phase A2 state.
> Regenerate clean with all 6 members.

**Date mode:** Consecutive 5 days. The algorithm slides a 5-day window across all
19 Olympic days (Jul 12–30) and scores each window. 15 windows total (offsets 0–14).

**Formula recap:**

```
windowScore = baseScore - fairnessPenalty
baseScore   = sum of all members' per-member totals (sum of primary scores per day in window)
fairnessPenalty = stdev(perMemberTotals) × memberCount × 0.5
```

All 6 members have sessions only on **Jul 16–19**. Days outside that range contribute 0.

### Step 1 — Per-member daily primary scores (from Phase A3)

| Member  | Jul 16   | Jul 17   | Jul 18    | Jul 19    | Total    |
| ------- | -------- | -------- | --------- | --------- | -------- |
| Alex    | 4.0      | 4.5      | 3.9       | 2.5       | 14.9     |
| Blake   | 5.0      | 4.25     | 5.0       | 1.75      | 16.0     |
| Casey   | 4.0      | 3.05     | 3.05      | 2.6       | 12.7     |
| Dana    | 4.0      | 4.0      | 3.4       | 2.0       | 13.4     |
| Ellis   | 3.4      | 3.4      | 3.4       | 3.0       | 13.2     |
| Frankie | 2.0      | 4.0      | 3.4       | 2.0       | 11.4     |
| **Day** | **22.4** | **23.2** | **22.15** | **13.85** | **81.6** |

### Step 2 — Per-member daily backup scores (from Phase A3)

| Member  | Jul 16 B1/B2 | Jul 17 B1/B2 | Jul 18 B1/B2 | Jul 19 B1/B2 |
| ------- | ------------ | ------------ | ------------ | ------------ |
| Alex    | —/—          | —/—          | —/—          | —/—          |
| Blake   | 3.5/—        | 2.45/1.7     | 3.2/—        | —/—          |
| Casey   | —/—          | 2.4/—        | 2.4/—        | —/—          |
| Dana    | —/—          | —/—          | —/—          | —/—          |
| Ellis   | 0.7/—        | 1.0/—        | 0.7/—        | —/—          |
| Frankie | 0.4/—        | 2.7/—        | 0.4/—        | 0.7/—        |

### Step 3 — Window score calculations

Only 8 of 15 windows have non-zero scores (the rest fall entirely outside Jul 16–19).

#### #1 — Jul 15–19 (score: **77.1**, displayed)

Covers all 4 session days. Per-member totals = full totals from table above.

| Member  | Total | Deviation |
| ------- | ----- | --------- |
| Alex    | 14.9  | +1.3      |
| Blake   | 16.0  | +2.4      |
| Casey   | 12.7  | −0.9      |
| Dana    | 13.4  | −0.2      |
| Ellis   | 13.2  | −0.4      |
| Frankie | 11.4  | −2.2      |

- baseScore = 81.6, mean = 13.6
- stdev = √(13.3/6) = **1.4889**
- fairnessPenalty = 1.4889 × 6 × 0.5 = **4.4667**
- **windowScore = 81.6 − 4.4667 = 77.13**

#### #2 — Jul 16–20 (score: **77.1**, displayed)

Same 4 session days (Jul 20 has no sessions). Identical per-member totals, stdev, and resilience.

- **windowScore = 77.13** (same as Jul 15–19)
- Tie-break: same stdev → same resilience → **later start date** → ranks #2

#### #3 — Jul 14–18 (score: **62.8**, displayed)

Covers Jul 16–18 (3 session days). Missing Jul 19.

| Member  | Total | Deviation |
| ------- | ----- | --------- |
| Alex    | 12.4  | +1.11     |
| Blake   | 14.25 | +2.96     |
| Casey   | 10.1  | −1.19     |
| Dana    | 11.4  | +0.11     |
| Ellis   | 10.2  | −1.09     |
| Frankie | 9.4   | −1.89     |

- baseScore = 67.75, mean = 11.292
- stdev = √(16.182/6) = **1.6423**
- fairnessPenalty = 1.6423 × 6 × 0.5 = **4.9267**
- **windowScore = 67.75 − 4.9267 = 62.82**

#### #4 — Jul 17–21 (score: **56.7**)

Covers Jul 17–19. Missing Jul 16.

| Member  | Total |
| ------- | ----- |
| Alex    | 10.9  |
| Blake   | 11.0  |
| Casey   | 8.7   |
| Dana    | 9.4   |
| Ellis   | 9.8   |
| Frankie | 9.4   |

- baseScore = 59.2, mean = 9.867
- stdev = √(4.153/6) = **0.8320**
- fairnessPenalty = 0.8320 × 6 × 0.5 = **2.496**
- **windowScore = 59.2 − 2.496 = 56.70**

#### #5 — Jul 13–17 (score: **42.3**)

Covers Jul 16–17. Missing Jul 18–19.

- baseScore = 45.6, stdev = **1.0951**
- fairnessPenalty = **3.285**
- **windowScore = 45.6 − 3.285 = 42.31**

#### #6 — Jul 18–22 (score: **34.4**)

Covers Jul 18–19. Missing Jul 16–17.

- baseScore = 36.0, stdev = **0.5362**
- fairnessPenalty = **1.609**
- **windowScore = 36.0 − 1.609 = 34.39**

#### #7 — Jul 12–16 (score: **19.7**)

Covers Jul 16 only.

- baseScore = 22.4, stdev = **0.9068**
- fairnessPenalty = **2.720**
- **windowScore = 22.4 − 2.720 = 19.68**

#### #8 — Jul 19–23 (score: **12.6**)

Covers Jul 19 only.

- baseScore = 13.85, stdev = **0.4286**
- fairnessPenalty = **1.286**
- **windowScore = 13.85 − 1.286 = 12.56**

#### #9–15 — Jul 20–24 through Jul 26–30 (score: **0.0**)

No sessions fall within these windows. All scores are zero.

### Step 4 — Final ranking (all 15 windows)

| Rank | Window    | Score (display) | Stdev  | Resilience |
| ---- | --------- | --------------- | ------ | ---------- |
| 1    | Jul 15–19 | **77.13**       | 1.4889 | 0.1237     |
| 2    | Jul 16–20 | **77.13**       | 1.4889 | 0.1237     |
| 3    | Jul 14–18 | **62.82**       | 1.6423 | 0.1552     |
| 4    | Jul 17–21 | **56.7**        | 0.8320 | 0.1343     |
| 5    | Jul 13–17 | **42.31**       | 1.0951 | 0.1599     |
| 6    | Jul 18–22 | **34.39**       | 0.5362 | 0.0875     |
| 7    | Jul 12–16 | **19.68**       | 0.9068 | 0.0922     |
| 8    | Jul 19–23 | **12.56**       | 0.4286 | 0.0292     |
| 9–15 | (Jul 20+) | **0.0**         | 0      | 0          |

> Scores display with up to 2 decimal places (`.toFixed(2)` with trailing zero stripped).
> Examples: 77.13 → "77.13", 77.10 → "77.1", 77.00 → "77.0". Jul 15–19 and Jul 16–20
> both show "77.13" — they are identical because Jul 15 and Jul 20 have no sessions.
> The #1 vs #2 tie-break is **earlier start date**, so Jul 15–19 wins.

### Verify in Group Schedule

- [x] **Top 3 windows displayed:** Jul 15–19 (77.13), Jul 16–20 (77.13), Jul 14–18 (62.82)
- [x] Top window (Jul 15–19) is auto-selected and highlighted on calendar
- [x] Clicking a window highlights those 5 days with light blue background
- [x] Jul 15–19 and Jul 16–20 show the same score — #1 is the earlier start date
- [x] Score tooltip: "Scores reflect how well each window matches the group's combined session preferences..."
- [x] All 15 windows are ranked (only top 3 shown in sidebar)

- [x] **Tested:** Phase A8: Window Ranking Verification

---

### A8.2 — Purchase Constrains Valid Windows (5 → 5 windows, different top 3)

> **Prerequisite:** A8 baseline verified. No purchases exist.

**Setup:**

1. **Alex:** Save a timeslot (any future date/time range)
2. **Alex:** Record a purchase for **ATH09** (Athletics, Jul 19, Expo Park)
   - Assignee: **Alex** (self)
   - Price: $100.00
3. **Alex:** Regenerate schedules

ATH09 is already in Alex's Jul 19 Primary (score 2.5). Locking it doesn't change any
combo scores — the algorithm output is identical to Phase A3. The only effect is that
**windows must now contain Jul 19**.

**Valid windows (5):** Jul 15–19, Jul 16–20, Jul 17–21, Jul 18–22, Jul 19–23

| Rank | Window    | Score     |
| ---- | --------- | --------- |
| 1    | Jul 15–19 | **77.13** |
| 2    | Jul 16–20 | **77.13** |
| 3    | Jul 17–21 | **56.7**  |
| 4    | Jul 18–22 | 34.39     |
| 5    | Jul 19–23 | 12.56     |

**Key change from A8 baseline:** Jul 14–18 (previously #3 at 62.82) is eliminated because
it doesn't contain Jul 19. Jul 17–21 moves up to #3.

**Verify:**

- [x] Top 3 windows: Jul 15–19 (77.13), Jul 16–20 (77.13), Jul 17–21 (56.7)
- [x] Jul 14–18 is NOT in the list (doesn't cover the purchased Jul 19 session)
- [x] All combo scores unchanged from Phase A3

- [x] **Tested:** A8.2

---

### A8.3 — Second Purchase Narrows to 2 Windows

> **Prerequisite:** A8.2 completed (ATH09 purchased for Alex).

**Setup:**

1. **Dana:** Save a timeslot (any future date/time range)
2. **Dana:** Record a purchase for **VBV04** (Beach Volleyball, Jul 16, Long Beach)
   - Assignee: **Dana** (self)
   - Price: $100.00
3. **Alex:** Regenerate schedules

VBV04 is already in Dana's Jul 16 Primary [VBV04, VBV05] (combo score 4.0).
Locking VBV04 doesn't change any combo scores — it was already the top choice.

**Required days: {Jul 16, Jul 19}** — every valid window must contain both dates.

**Valid windows (2):** Only Jul 15–19 and Jul 16–20 span both Jul 16 and Jul 19.

| Rank | Window    | Score     |
| ---- | --------- | --------- |
| 1    | Jul 15–19 | **77.13** |
| 2    | Jul 16–20 | **77.13** |

**Verify:**

- [x] Only 2 windows displayed (not 3)
- [x] Jul 15–19 (77.13) and Jul 16–20 (77.13) are the only options
- [x] Jul 17–21 is gone (doesn't contain Jul 16)
- [x] All combo scores unchanged from Phase A3

- [x] **Tested:** A8.3

---

### A8.4 — Change to 4 Consecutive Days → Exactly 1 Window

> **Prerequisite:** A8.3 completed (purchases on Jul 16 and Jul 19).

**Setup:**

1. **Alex:** Change group date config from **5 consecutive** to **4 consecutive** days
   (no regeneration needed — window rankings recompute automatically from existing combos)

With 4-day windows, the only window containing both Jul 16 and Jul 19 is **Jul 16–19**
(covers exactly Jul 16, 17, 18, 19). Jul 15–18 misses Jul 19. Jul 17–20 misses Jul 16.

**Valid windows (1):**

| Rank | Window    | Score     |
| ---- | --------- | --------- |
| 1    | Jul 16–19 | **77.13** |

The score is identical to the 5-day windows because Jul 15 and Jul 20 had zero sessions —
the extra day in a 5-day window contributed nothing.

**Verify:**

- [x] Exactly 1 window displayed: Jul 16–19 (77.13)
- [x] Section title says "Top 4-Day Windows"
- [x] Calendar highlights Jul 16–19

- [x] **Tested:** A8.4

---

### A8.5 — Change to 3 Consecutive Days → No Feasible Windows

> **Prerequisite:** A8.4 completed (purchases on Jul 16 and Jul 19, 4-day config).

**Setup:**

1. **Alex:** Change group date config from **4 consecutive** to **3 consecutive** days

A 3-day window covers a 2-day spread (e.g., Jul 16–18 or Jul 17–19). No 3-day window
can contain both Jul 16 and Jul 19 (3 days apart). All windows are filtered out.

**Valid windows: 0**

**Verify:**

- [x] Window section shows: "No feasible 3-day windows. Purchased sessions span more days than the window size allows."
- [x] No window highlight on calendar
- [x] Section title still says "Top 3-Day Windows"

- [x] **Tested:** A8.5

---

### A8.6 — Restore 5 Consecutive Days

> Cleanup step: Restore group config for subsequent test phases.

1. **Alex:** Change group date config back to **5 consecutive** days
2. Verify 2 windows reappear: Jul 15–19 (77.13), Jul 16–20 (77.13)
3. Delete all purchases (Alex's ATH09, Dana's VBV04) via the purchase tracker
4. Regenerate schedules to restore clean Phase A3 state

**Verify:**

- [x] After restoring 5-day config: 2 windows displayed (purchases still constrain)
- [x] After deleting purchases and regenerating: all 15 windows available, top 3 restored to Jul 15–19 (77.13), Jul 16–20 (77.13), Jul 14–18 (62.82)

- [x] **Tested:** A8.6
- [x] **Tested:** Phase A8: Window Ranking + Purchase Constraints (all sub-sections)

---

## Phase A9: Locked Session Injection (Session Not in Preferences)

> **Prerequisite:** Restore all preferences to Phase A2 state. Delete all purchases.
> Regenerate clean with all 6 members (confirm Phase A3 results).

This tests that a purchased session NOT in the member's sport rankings
gets injected into their candidates with `interest = "high"`.

**Setup:**

1. **Alex:** Save a timeslot (any future date/time range)
2. **Alex:** Record a purchase for session ATH05 (Athletics, Jul 17)
   - Assignee: **Dana** (not Alex — Dana is the one who gets the locked session)
   - Price: $100.00
3. ATH05 is an Athletics session. Dana does NOT have Athletics in sport rankings.
4. Regenerate

**Expected for Dana on Jul 17:**

- ATH05 becomes locked for Dana (assignee via `ticketPurchaseAssignee`)
- ATH05 is NOT in Dana's `session_preference` rows → **injected** with `interest = "high"`
- Scoring: Athletics not in Dana's `sportRankings` [BV, 3x3]. `rank = sportRankings.length` = 2. `totalSports = 2`. Multiplier = `2.0 - ((2-1)/(2-1))` = **1.0**. Score = 1.0 × 1.0 = **1.0**.
- No other purchases exist (A8 prerequisite deleted them). VBV07 is NOT locked.
- Locked: [ATH05]. Unlocked (after hard buddy filter vs Ellis): VBV07 ✓, VBV08 ✓, BK304 ✗ (filtered).
- Combos must include locked ATH05:
  - [ATH05, VBV07]: ATH05 (Expo, 09:00–14:00) overlaps VBV07 (LB, 09:00–12:00). NOT feasible.
  - [ATH05, VBV08]: ATH05 ends 14:00, VBV08 starts 14:00. Expo→LB 33.33 → 150 min gap. Gap=0. NOT feasible.
  - [ATH05]: locked-only fallback.
- **P=[ATH05] score=1.0.** No B1, no B2.

**Sanity check:** Alex bought Athletics tickets for Dana, who never ranked Athletics. The locked ATH05 takes over Dana's Jul 17 — it overlaps with VBV07 and is infeasible with VBV08, forcing out both BV sessions. Dana goes from P=[VBV07, VBV08] score=4.0 down to P=[ATH05] score=1.0. A dramatic downgrade caused by someone else's purchase.

**Dana's other days (Jul 16, 18, 19):** Unaffected — no locked sessions on those days. Normal BV schedule.

**Verify:**

- [x] Dana Jul 17: P=[ATH05] only, score=1.0 (NOT the original BV sessions)
- [x] Dana Jul 16, 18, 19: unchanged from Phase A3
- [x] ATH05 shows purchased/locked indicator in Dana's session detail
- [x] ATH05 appears despite Athletics not being in Dana's sport rankings

- [x] **Tested:** A9

### A9.1 — Another Member's Purchase Does NOT Appear On Your Schedule

This verifies that the ATH05 purchase for Dana does NOT affect other members' schedules.

1. **Verify for Casey:** ATH05 IS in Casey's preferences (Medium interest). Casey's schedule for ATH05 is based on Casey's own interest level and constraints — NOT affected by the fact that Alex purchased it for Dana.
2. **Verify for Frankie:** ATH05 is NOT in Frankie's preferences → ATH05 does NOT appear on Frankie's schedule. Another member's purchase has zero effect on members who didn't express interest.
3. **Verify for Alex (the buyer):** ATH05 IS in Alex's preferences and appears on Alex's schedule based on Alex's own interest. Alex is the buyer but NOT an assignee — Alex does NOT have ATH05 as a locked session (only Dana does).

- [x] **Tested:** A9.1
- [x] **Tested:** Phase A9: Locked Session Injection (all sub-sections)

---

## Phase A10: Excluded Sessions Deep Verification

> **Prerequisite:** Restore all preferences to Phase A2 state. Delete all purchases.
> Mark VBV08 as sold out (Dana needs a timeslot first). Regenerate.
> This puts us in the same state as Phase A5.2 — VBV08 sold out and excluded.

### A10.1 — Excluded Session Visibility (Who Sees What)

After regeneration with VBV08 sold out:

**Dana and Ellis (had VBV08 in preferences):**

- [x] VBV08 shows with "Sold Out" badge
- [x] No "Pending Schedule Regeneration" tag (`wasSoldOut=true` from stored snapshot matches `isSoldOut=true`)
- [x] "Undo Sold Out" button visible (requires timeslot — disabled with tooltip if no timeslot)

**Alex, Blake, Casey, Frankie (never had VBV08 in preferences):**

- [x] VBV08 ALSO shows in their Excluded Sessions with "Sold Out" badge (sold-out is group-wide, tracked via `soldOutCodesAtGeneration`)
- [x] No "Pending Schedule Regeneration" tag (`wasSoldOut=true` from `soldOutCodesAtGeneration` matches `isSoldOut=true`)
- [x] "Undo Sold Out" button visible (any member can unmark, but requires timeslot)

- [x] **Tested:** A10.1

### A10.2 — Excluded Session State Divergence (Unmark Without Regenerating)

1. After A5.2 regeneration, someone unmarks VBV08 as sold out (WITHOUT regenerating)

**For Dana and Ellis (VBV08 was in their stored snapshot with soldOut=true):**

- [x] VBV08 still appears in excluded list (it's in their stored snapshot)
- [x] "Sold Out" badge is GONE (`isSoldOut=false` now)
- [x] "Pending Schedule Regeneration" tag APPEARS (`wasSoldOut=true` ≠ `isSoldOut=false` — status changed since generation)
- [x] Tooltip: "There were changes to this session's status. These changes will be reflected in the next schedule generation."
- [x] "Re-mark as Sold Out" button visible (to undo the undo)
- [x] "Undo Sold Out" button gone

**For Alex, Blake, Casey, Frankie (VBV08 was NOT in their stored snapshot):**

- [x] VBV08 still appears in excluded list — kept by group-level `soldOutCodesAtGeneration` which records VBV08 was sold out at generation time
- [x] "Sold Out" badge is GONE (`isSoldOut=false`)
- [x] "Pending Schedule Regeneration" tag APPEARS (`wasSoldOut=true` from `soldOutCodesAtGeneration`, `isSoldOut=false` — status changed)
- [x] Same "Re-mark as Sold Out" button visible

**All members see the same pending tag** — sold-out is group-wide, so all members should know the status changed since generation.

> **Design note on OOB-while-sold-out:** If a session is both sold out and OOB, then
> only the OOB is unmarked (sold out stays), Ellis sees a pending tag (`wasOOB≠isOOB`)
> even though the OOB was a no-op while sold out. The amber overview notification also
> fires for all users. This is intentional — suppressing the tag/notification for
> "redundant" OOB changes would create too many ordering edge cases (e.g., OOB marked
> first then sold out, or sold out unmarked later making OOB relevant again). The
> notification always fires on any status change; the user can judge whether regeneration
> is worth it.

- [x] **Tested:** A10.2

### A10.3 — Sold-Out Session Lifecycle (On Schedule → Excluded)

A session on a member's current schedule stays there even after being marked sold out.
It only moves to Excluded Sessions after regeneration removes it from the schedule.
No purchases exist at this point (prerequisite deleted them).

**Step 1: Mark VBV07 as sold out (VBV07 is on Dana's, Ellis's, and Casey's schedules)**

For Dana (VBV07 is on her schedule, no purchase):

- [x] VBV07 does NOT move to Excluded Sessions — it stays on the schedule
- [x] VBV07 shows the ✕ sold-out icon on its session row in the Purchase Tracker
- [x] The session remains clickable and functional

For Ellis and Casey (VBV07 is on their schedules, no purchases):

- [x] Same — VBV07 stays on schedule with sold-out icon, NOT in excluded list

For Alex (VBV07 is NOT on his schedule):

- [x] VBV07 does NOT appear in Excluded Sessions either (it wasn't excluded from the last generation — the excluded list only shows sessions from `storedExcludedCodes` + `soldOutCodesAtGeneration`, and VBV07 was not sold out at last generation)

**Step 2: Regenerate**

No purchases → VBV07 is NOT locked for anyone → excluded for all members who had it.

For Dana, Ellis, Casey (had VBV07 in preferences, no purchase):

- [x] VBV07 removed from their schedules
- [x] VBV07 NOW appears in their Excluded Sessions with "Sold Out" badge, no pending tag

For Alex (never had VBV07 in preferences):

- [x] VBV07 appears in Excluded Sessions with "Sold Out" badge (via `soldOutCodesAtGeneration`), no pending tag

- [x] **Tested:** A10.3

### A10.4 — Which Actions Trigger vs Don't Trigger Purchase Notifications

**Actions that SET `purchaseDataChangedAt` (trigger amber notification):**

- [ ] markAsPurchased (record a purchase)
- [ ] deletePurchase
- [ ] removePurchaseAssignee
- [ ] markAsSoldOut
- [ ] unmarkSoldOut
- [ ] markAsOutOfBudget
- [ ] unmarkOutOfBudget
- [ ] deleteOffScheduleSessionData

**Actions that do NOT set `purchaseDataChangedAt` (no notification):**

- [ ] reportSessionPrice (informational only, no scheduling impact)
- [ ] updatePurchaseAssigneePrice (price change, no scheduling impact)
- [ ] savePurchasePlanEntry / batchSavePurchasePlan (plans are informational)
- [ ] saveTimeslot (timeslot is informational)

**Verify by performing each action and checking:**

- [x] After reportSessionPrice or purchase plan entry: no amber notification appears, generate button unchanged
- [x] After markAsSoldOut or markAsOOB: amber notification appears within seconds for all members

- [x] **Tested:** A10.4

### A10.5 — Timeslot Requirement Matrix

| Action                | Requires Timeslot? | Notes                                                                              |
| --------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| Mark as Sold Out      | **Yes**            | Button disabled with tooltip if no timeslot                                        |
| Undo Sold Out         | **Yes**            | Button disabled with tooltip if no timeslot                                        |
| Mark as Out of Budget | No                 | Always enabled                                                                     |
| Undo Out of Budget    | No                 | Always enabled                                                                     |
| Record Purchase       | **Yes**            | Button disabled with tooltip if no timeslot. Also disabled if session is sold out. |
| Report Price          | No                 | Always enabled                                                                     |

- [x] Verify "Mark as Sold Out" disabled for a member without timeslot
- [x] Verify tooltip: "Enter your purchase timeslot on the Overview page to use this action."
- [x] Verify "Undo Sold Out" disabled for a member without timeslot (same tooltip)
- [x] Verify "Mark as Out of Budget" enabled even without timeslot
- [x] Verify "Record Purchases" disabled when session is sold out (tooltip: "This session has been marked as sold out.")

- [x] **Tested:** A10.5

### A10.6 — Off-Schedule Session & Excluded Session Gating

Sessions in the excluded sessions list must NOT appear in or be added to the off-schedule sessions section.

1. **Verify server-side filtering:** After regeneration with sold-out/OOB exclusions, off-schedule sessions list does NOT contain any sessions that are sold out or out of budget
2. **Verify lookup gating for excluded sessions:**
   - [x] Search for an excluded session code (e.g., VBV08 after A5.2) in off-schedule search
   - [x] Error message: "[CODE] is in the excluded sessions list. You can manage it from the Excluded Sessions section below."
   - [x] Session is NOT added to off-schedule list
3. **Verify OOB is per-member (not group-wide):**
   - [x] User A marks a session as OOB → it appears in User A's excluded list after regeneration
   - [x] User B (who has NOT marked it OOB) searches for that session in off-schedule → session is added successfully
   - [x] User A searches for the same session → blocked by excluded codes check

- [x] **Tested:** A10.6

### A10.7 — Reported Price Edit/Delete & Inline Busy State

**Prerequisite:** Dana has a timeslot (from A5.1).

**On-schedule session (TrackerSessionCard):**

1. **Dana:** Open Purchase Tracker, expand any on-schedule session (e.g., VBV07)
2. **Dana:** Click "Report Prices", submit a price range (min: $50, max: $100, comment: "Test price")
3. **Verify:** Reported price appears under collapsible "Reported Prices" section with Dana's name
4. **Verify:** Edit (pencil) and delete (trash) icons appear only next to Dana's own reported prices
5. **Dana:** Click edit (pencil) on the reported price
   - [x] Edit price modal opens pre-filled with $50–$100 and "Test price"
   - [x] Update to min: $60, max: $120, comment: "Updated price"
   - [x] Reported price row updates immediately (optimistic)
6. **Dana:** Click delete (trash) on the reported price
   - [x] While deletion is in progress: all other action buttons on ALL session cards are disabled (global busy state)
   - [x] Reported price row disappears after deletion completes
   - [x] Other session cards re-enable after deletion completes

**Off-schedule session (OffScheduleSessionCard):**

7. **Dana:** In off-schedule section, look up a session not on anyone's schedule (e.g., SWM01 if it was sold out and excluded)
   - If SWM01 is excluded, use any session code not in combos or excluded lists
8. **Dana:** Report a price on the off-schedule session (min: $40, max: $80)
9. **Verify:** Reported price appears with edit/delete buttons
10. **Dana:** Click delete (trash) on the reported price
    - [x] While deletion is in progress: action buttons on OTHER off-schedule cards and on-schedule cards are disabled (global busy)
    - [x] Price row disappears, buttons re-enable
11. **Dana:** Record a purchase on an off-schedule session, then click edit (pencil) on the purchase price
    - [x] While inline price edit is active: all other action buttons are disabled across all cards (global busy)
    - [x] Save or cancel re-enables everything

- [x] **Tested:** A10.7

- [x] **Tested:** Phase A10: Excluded Sessions Deep Verification (all sub-sections)

---

# GROUP C — Twelve Members (Max Capacity)

**Purpose:** Test group capacity limits, large-group algorithm behavior, and the
13th-member rejection. Uses simple preferences to keep setup tractable.

## Phase C1: Setup

### Accounts

Create 12 user accounts with the pattern:

| User           | Username    | Avatar Color |
| -------------- | ----------- | ------------ |
| User 1 (Owner) | `captest01` | Blue         |
| User 2         | `captest02` | Green        |
| User 3         | `captest03` | Pink         |
| User 4         | `captest04` | Orange       |
| User 5         | `captest05` | Purple       |
| User 6         | `captest06` | Teal         |
| User 7         | `captest07` | Yellow       |
| User 8         | `captest08` | Blue         |
| User 9         | `captest09` | Green        |
| User 10        | `captest10` | Pink         |
| User 11        | `captest11` | Orange       |
| User 12        | `captest12` | Purple       |

### Group Configuration

| Field            | Value            |
| ---------------- | ---------------- |
| Group Name       | Full House       |
| Date Mode        | Consecutive Days |
| Consecutive Days | 3                |

### Join Flow

1. User 1 creates group and shares invite code
2. Users 2–12 join and get approved one by one
3. **Verify:** Member count shows 12/12 after all approved
4. **Verify:** Approve button disabled for any new pending members (group full)

### Phase C1.1 — 13th Member Rejection

1. Create **User 13** (username: `captest13`)
2. User 13 enters invite code
3. **Expected:** "This group is full. Groups are limited to 12 members."
4. **Verify:** User 13 does NOT appear in pending members

- [x] **Tested:** C1.1 (13th member rejection)
- [x] **Tested:** Phase C1: Setup (all sub-sections)

## Phase C2: Simple Preferences (All 12 Members)

To keep setup manageable, give all 12 members similar preferences:

### All Members — Same Configuration

**Buddies:** minBuddies=0, no buddy tags

**Sport Rankings:** Beach Volleyball (#1), Athletics (#2)

- Multipliers: BV=2.0, Ath=1.0

**Session Interests (all 12 members enter the same sessions):**

| Session | Sport            | Zone            | Date   | Time        | Interest |
| ------- | ---------------- | --------------- | ------ | ----------- | -------- |
| VBV04   | Beach Volleyball | Long Beach      | Jul 16 | 09:00–12:00 | High     |
| VBV05   | Beach Volleyball | Long Beach      | Jul 16 | 14:00–18:00 | High     |
| VBV07   | Beach Volleyball | Long Beach      | Jul 17 | 09:00–12:00 | High     |
| VBV08   | Beach Volleyball | Long Beach      | Jul 17 | 14:00–18:00 | Medium   |
| VBV10   | Beach Volleyball | Long Beach      | Jul 18 | 09:00–12:00 | High     |
| VBV11   | Beach Volleyball | Long Beach      | Jul 18 | 14:00–18:00 | Medium   |
| ATH03   | Athletics        | Exposition Park | Jul 16 | 09:00–12:00 | Medium   |
| ATH05   | Athletics        | Exposition Park | Jul 17 | 09:00–14:00 | Low      |

### Sanity Check — What to Expect

All 12 members have identical preferences and no constraints. Every member should
get the exact same schedule. Beach Volleyball (rank #1) dominates the Primary combos.
Athletics (rank #2, Low interest) only appears as a backup where it doesn't conflict
with BV sessions. The Group Schedule should show all 12 names on every session.

### Expected Output — What Every Member Sees

**Jul 16 (day score: 4.0):**

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | VBV04, VBV05 | 4.0   |
| Backup 1 | ATH03        | 0.7   |
| Backup 2 | —            | —     |

VBV04+ATH03 overlap (both start 09:00). ATH03 can't pair with VBV05 (Expo→LB gap = 0, need 150 min). ATH03 stands alone as B1 with low score (Athletics rank #2, Medium interest = 1.0 × 0.7 = 0.7).

**Jul 17 (day score: 3.4):**

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | VBV07, VBV08 | 3.4   |
| Backup 1 | ATH05        | 0.4   |
| Backup 2 | —            | —     |

VBV07+ATH05 overlap. ATH05+VBV08 infeasible (0 min gap, need 150). ATH05 alone as B1 (Athletics rank #2, Low interest = 1.0 × 0.4 = 0.4).

**Jul 18 (day score: 3.4):**

| Rank     | Sessions     | Score |
| -------- | ------------ | ----- |
| Primary  | VBV10, VBV11 | 3.4   |
| Backup 1 | —            | —     |
| Backup 2 | —            | —     |

No Athletics sessions entered for Jul 18 → no backups available.

**Session detail for any session:** All 12 members listed as "Interested" with same rank (P or B1).

**Group Schedule:** Clicking any member filter shows the same sessions. "All" mode = "Any" mode (everyone has the same schedule).

**Verify:**

- [x] All 12 members have identical schedules (check at least 3 different members)
- [x] Jul 16: P=[VBV04, VBV05] score=4.0, B1=[ATH03] score=0.7
- [x] Jul 17: P=[VBV07, VBV08] score=3.4, B1=[ATH05] score=0.4
- [x] Jul 18: P=[VBV10, VBV11] score=3.4, no B1
- [x] Session detail shows all 12 members as "Interested"
- [x] Group Schedule: all 12 names visible on every session
- [x] No convergence issues (no buddy constraints)

- [x] **Tested:** Phase C2: Simple Preferences (All 12 Members)

## Phase C3: MinBuddies Stress Test

1. **User 1:** Update buddies → set minBuddies=11 (all other members)
2. Regenerate

**What User 1 should see:** Identical schedule to Phase C2. Every session has all 12 members interested (count=12, 12−1=11 ≥ 11). The constraint is met everywhere.

- [x] Verify User 1's schedule is unchanged from Phase C2
- [x] **Tested:** C3 (minBuddies=11 satisfied)

### C3.1 — MinBuddies Exceeds Possible

1. **User 12:** Update preferences → remove VBV04, VBV05, VBV08, VBV11 interests (keep only VBV07, VBV10, ATH03, ATH05)
2. **User 1:** Keep minBuddies=11
3. Regenerate

**What User 1 should see after regeneration:**

User 12 removed VBV04, VBV05, VBV08, VBV11 from their preferences (kept only VBV07, VBV10, ATH03, ATH05). This drops the interest count for those 4 sessions from 12 to 11. For User 1 with minBuddies=11: 11−1=10 < 11 → all four filtered out.

Sessions that survive for User 1 (still have 12 interested): VBV07, VBV10, ATH03, ATH05.

**Jul 16 (day score: 0.7):**

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | ATH03    | 0.7   |
| Backup 1 | —        | —     |
| Backup 2 | —        | —     |

Both VBV04 AND VBV05 filtered (User 12 removed both). Only ATH03 survives (Athletics rank #2, Medium interest). A single low-scoring session.

**Jul 17 (day score: 2.0):**

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | VBV07    | 2.0   |
| Backup 1 | ATH05    | 0.4   |
| Backup 2 | —        | —     |

VBV08 filtered. VBV07 (12 interested) survives as Primary. ATH05 (12 interested) survives as B1. They overlap in time so they're separate combos.

**Jul 18 (day score: 2.0):**

| Rank     | Sessions | Score |
| -------- | -------- | ----- |
| Primary  | VBV10    | 2.0   |
| Backup 1 | —        | —     |
| Backup 2 | —        | —     |

VBV11 filtered. Only VBV10 survives. No Athletics session entered for Jul 18 → no backup.

**Sanity check:** User 12 only removed 4 sessions but User 1's schedule collapsed dramatically — from 2-session Primaries on every day to mostly single sessions. Jul 16 is particularly bad: the user's #1 sport (Beach Volleyball) is completely gone, leaving only a mediocre Athletics session scoring 0.7. This is a realistic demonstration of how minBuddies=11 in a 12-person group is extremely brittle — a single member's preference change wipes out sessions for anyone with that constraint. Users 2–11 are completely unaffected (their minBuddies=0).

- [x] Verify User 1 Jul 16: P=[ATH03] score=0.7, no B1 (both VBV04 and VBV05 filtered)
- [x] Verify User 1 Jul 17: P=[VBV07] score=2.0, B1=[ATH05] score=0.4
- [x] Verify User 1 Jul 18: P=[VBV10] score=2.0, no B1
- [x] Verify Users 2–11 still have full schedules (their minBuddies=0)
- [x] **Tested:** C3.1
- [x] **Tested:** Phase C3: MinBuddies Stress Test (all sub-sections)

## Phase C4: Member Removal at Capacity

1. **User 1:** Remove User 12
2. **Verify:** Group now has 11 members
3. **Create User 13** and join with invite code
4. **User 1:** Approve User 13
5. **Verify:** Group back to 12 members
6. **Create User 14** and attempt to join
7. **Verify:** "This group is full" error

- [x] **Tested:** Phase C4: Member Removal at Capacity

## Phase C5: User Group Limit Test

This tests the per-user limit of 10 groups:

1. User 13 creates 9 additional groups (now in 10 groups including "Full House")
2. User 13 attempts to create an 11th group
3. **Verify:** "You can be in at most 10 groups"
4. User 13 attempts to join another existing group
5. **Verify:** "You can be in at most 10 groups"

- [x] **Tested:** Phase C5: User Group Limit Test

---

# Cross-Group Scenarios

These scenarios use the groups created above to test interactions.

## Scenario X1: Dirty State Guard (In-App Navigation)

1. **In Group A, as Casey:** Go to Preferences → Step 1 (Sport Rankings)
2. Add a new sport (e.g., Boxing) but DO NOT save
3. Click on Overview tab in sidebar
4. **Verify:** Modal appears: "You have unsaved changes in Sport Rankings. Are you sure you want to leave? Your changes will be lost."
5. Click "Stay" → remain on preferences page
6. Click Overview tab again → modal again → click "Discard & Leave"
7. **Verify:** Navigated to overview, sport rankings unchanged (Boxing not added)

- [x] **Tested:** Scenario X1: Dirty State Guard (In-App Navigation)

## Scenario X2: Browser Navigation Guard

1. **In Group A, as Blake:** Go to Preferences → Step 0 (Buddies)
2. Change minBuddies value but DO NOT save
3. Press browser back button
4. **Verify:** In-app modal appears (Navigation API intercept for "traverse" navigations)
5. Click "Stay" → remain on page, changes preserved
6. Try to close the browser tab
7. **Verify:** Native `beforeunload` prompt appears ("Changes you made may not be saved")

- [x] **Tested:** Scenario X2: Browser Navigation Guard

## Scenario X3: Concurrent Approve/Deny (Two Browser Tabs)

> This tests race condition guards. Requires two browser tabs logged in as Alex.

1. Create a new user, have them join Group A with invite code (pending state)
2. Open Group A overview in **Tab 1** and **Tab 2** (both logged in as Alex)
3. Both tabs show the pending member
4. In Tab 1: click "Approve"
5. Quickly in Tab 2: click "Deny" (before Tab 2 refreshes)
6. **Expected:** One operation succeeds. The other's UPDATE matches 0 rows (WHERE includes `status = 'pending_approval'` guard — the status already changed). The second tab returns success (idempotent no-op).
7. **Verify:** Refresh both tabs — member is in the state from whichever operation committed first

- [x] **Tested:** Scenario X3: Concurrent Approve/Deny (Two Browser Tabs)

## Scenario X4: Generation During Preference Edit

> This is more practically testable than transfer/leave races.

1. **Casey:** Open Preferences page, start editing Step 1 (add a sport, don't save)
2. **Alex (in another tab):** Start generating schedules
3. Generation runs (may take seconds)
4. **Casey:** Save their preferences during or after generation
5. **Expected:** If Casey saves DURING generation, their `statusChangedAt` > `scheduleGeneratedAt` (generation timestamp was captured BEFORE algorithm started). The notification system correctly detects this as a post-generation preference update.
6. **Verify:** After generation completes, notification shows "Casey Gymnast has updated their preferences"

- [x] **Tested:** Scenario X4: Generation During Preference Edit

## Scenario X5: Inactivity Timeout

> Requires waiting 30 minutes. Can be tested by temporarily shortening the timeout constant during development, or by testing at end of session.

1. Login as any user
2. Leave browser idle for 30+ minutes (no mouse/keyboard/scroll/touch)
3. Move mouse or perform any action
4. **Verify:** `InactivityGuard` component fires logout; user redirected to `/login`
5. Attempting to navigate to any `/(main)/*` route → redirected to `/login`

- [x] **Tested:** Scenario X5: Inactivity Timeout

## Scenario X6: Sold-Out + Out-of-Budget on Same Session

Tests the interaction when one member marks a session as sold out (group-wide)
and another member independently marks it as out of budget (per-member). The
two exclusion types coexist and can be unmarked independently.

### Setup

1. **Alex** creates group "Exclusion Test" (specific dates: Jul 16–Jul 17)
2. **Blake** joins via invite code, Alex approves

**Both users enter identical preferences:**

- Buddies: minBuddies=0, no tags
- Sport Rankings: Beach Volleyball (#1)
- Session Interests:

| Session | Sport            | Zone       | Date   | Time        | Interest |
| ------- | ---------------- | ---------- | ------ | ----------- | -------- |
| VBV04   | Beach Volleyball | Long Beach | Jul 16 | 09:00–12:00 | High     |
| VBV05   | Beach Volleyball | Long Beach | Jul 16 | 14:00–18:00 | High     |
| VBV07   | Beach Volleyball | Long Beach | Jul 17 | 09:00–12:00 | High     |
| VBV08   | Beach Volleyball | Long Beach | Jul 17 | 14:00–18:00 | High     |

3. **Alex** generates schedules
4. **Verify:** Both users see P=[VBV04, VBV05] on Jul 16, P=[VBV07, VBV08] on Jul 17
5. **Alex** saves a purchase timeslot (needed for sold-out actions)

### X6.1 — Mark Both Exclusion Types

1. **Alex:** Mark VBV08 as Sold Out
2. **Blake:** Mark VBV08 as Out of Budget
3. **Verify:**
   - [ ] Amber notification appears for both members
4. **Alex:** Regenerate

**Expected after regeneration:**

Both users: Jul 17 drops to P=[VBV07] only (VBV08 excluded).

5. **Verify for Alex:** VBV08 in excluded sessions with "Sold Out" badge
6. **Verify for Blake:** VBV08 in excluded sessions with both "Sold Out" and "Out of Budget" badges

- [x] **Tested:** X6.1

### X6.2 — Unmark Sold Out (OOB Persists for One Member)

1. **Alex:** Unmark VBV08 as Sold Out
2. **Verify for Blake:**
   - [x] VBV08 still in excluded sessions (OOB still applies)
   - [x] "Sold Out" badge gone, "Out of Budget" badge remains
   - [x] "Pending Schedule Regeneration" tag appears (sold-out status changed since generation)
3. **Verify for Alex:**
   - [x] VBV08 still in excluded sessions (was sold out at generation time)
   - [x] "Pending Schedule Regeneration" tag appears
4. **Alex:** Regenerate
5. **Verify for Blake:**
   - [x] VBV08 in excluded sessions with "Out of Budget" badge only
   - [x] No "Pending Schedule Regeneration" tag
6. **Verify for Alex:**
   - [x] VBV08 NOT in excluded sessions (no longer sold out, Alex didn't mark OOB)
   - [x] VBV08 back on Alex's schedule: Jul 17 P=[VBV07, VBV08]
7. **Verify for Blake:**
   - [x] Jul 17 still P=[VBV07] only (VBV08 excluded by OOB)

- [x] **Tested:** X6.2

### X6.3 — Unmark OOB (Full Restore)

1. **Blake:** Unmark VBV08 as Out of Budget
2. **Alex:** Regenerate
3. **Verify:**
   - [x] VBV08 back on both users' schedules: Jul 17 P=[VBV07, VBV08]
   - [x] No exclusions remain for either user

- [x] **Tested:** X6.3
- [x] **Tested:** Scenario X6: Sold-Out + Out-of-Budget on Same Session

---

# Authentication, Profile & Account Deletion Scenarios

**Purpose:** Verify signup, login, password reset, profile management, account
deletion, and edge cases like deleted-user login and owner deletion blocks.

> **Prerequisite:** These scenarios are independent of Groups A/B/C. Use
> throwaway accounts where noted. Some scenarios reference Group A users for
> account deletion testing.

## Scenario AUTH1: Signup — Validation & Happy Path

1. Navigate to `/signup`
2. Leave all fields empty
3. **Verify:** "Create Account" button is disabled (client-side validation prevents submission)
4. Type an invalid email (e.g., `notanemail`) → **Verify:** Inline hint appears: "Email must be valid."
5. Type a short password (`abc`) → **Verify:** Inline hint: "Password must be at least 8 characters long."
6. Type a username with spaces (`bad name`) → **Verify:** Inline hint: "Username can only contain letters, numbers, hyphens and underscores."
7. **Verify:** Button remains disabled while any field is invalid
8. Fill valid data:

| Field        | Value                    |
| ------------ | ------------------------ |
| First Name   | Test                     |
| Last Name    | Signup                   |
| Username     | `testsignup`             |
| Email        | (any valid unused email) |
| Password     | `TestPass123`            |
| Avatar Color | Green                    |

9. **Verify:** Button becomes enabled
10. Submit
11. **Verify:** Redirected to `/` (home page), navbar shows "Test Signup", avatar is green

- [x] **Tested:** Scenario AUTH1: Signup — Validation & Happy Path

## Scenario AUTH2: Signup — Duplicate Username

1. Navigate to `/signup`
2. Fill valid data but use username `testsignup` (from AUTH1)
3. Use a **different** email from AUTH1
4. Submit
5. **Verify:** Error: "This username is already taken."

- [x] **Tested:** Scenario AUTH2: Signup — Duplicate Username

## Scenario AUTH3: Signup — Duplicate Email

1. Navigate to `/signup`
2. Fill valid data but use the **same email** as AUTH1
3. Use a different username and a different password
4. Submit
5. **Verify:** Error: "This email is already associated with an account. Please log in."

- [x] **Tested:** Scenario AUTH3: Signup — Duplicate Email

## Scenario AUTH4: Login — Validation & Errors

1. Navigate to `/login`
2. Leave fields empty
3. **Verify:** "Log In" button is disabled (client-side validation prevents submission)
4. Type an invalid email (e.g., `notanemail`) → **Verify:** Button remains disabled
5. Enter a valid email and any password → **Verify:** Button becomes enabled
6. Enter a valid email and **wrong** password, submit
7. **Verify:** Error: "Invalid email or password."
8. Enter a **non-existent** email with any password, submit
9. **Verify:** Same generic error: "Invalid email or password." (does not reveal whether email exists)

- [x] **Tested:** Scenario AUTH4: Login — Validation & Errors

## Scenario AUTH5: Login — Happy Path

1. Navigate to `/login`
2. Enter the email and password from AUTH1
3. Submit
4. **Verify:** Redirected to `/`, home page loads, navbar shows "Test Signup"

- [x] **Tested:** Scenario AUTH5: Login — Happy Path

## Scenario AUTH6: Login — Deleted User (Redirect Loop Fix)

> Tests the fix for the bug where a user deleted from the local DB but still
> existing in Supabase Auth caused an infinite redirect loop.
>
> **Requires direct database access** (not a pure browser test). Run a SQL
> DELETE against the `users` table for the target user. Do NOT delete from
> the Supabase Auth dashboard.

1. Run SQL: `DELETE FROM users WHERE username = 'testsignup';`
2. Navigate to `/login`
3. Enter the email and password from AUTH1
4. **Verify:** Error: "Invalid email or password." (no redirect loop, no blank screen)
5. **Verify:** User remains on `/login` page, page is responsive

- [x] **Tested:** Scenario AUTH6: Login — Deleted User (Redirect Loop Fix)

## Scenario AUTH7: Forgot Password — Request Reset

1. Navigate to `/login`, click "Forgot Password?"
2. **Verify:** Navigated to `/forgot-password`
3. Leave email empty → **Verify:** "Send Reset Link" button is disabled
4. Type an invalid email (e.g., `notanemail`) → **Verify:** Inline hint: "Email must be valid." Button remains disabled.
5. Enter a valid email (does not need to exist) → **Verify:** Button becomes enabled
6. Submit
7. **Verify:** Message: "If an account exists with this email, you will receive a password reset link." (same message regardless of whether email exists — does not leak account info)
8. **Verify:** User remains on `/forgot-password` (no redirect)

- [x] **Tested:** Scenario AUTH7: Forgot Password — Request Reset

## Scenario AUTH8: Reset Password — Full Flow

> Requires access to the email inbox for a real account.

1. From `/forgot-password`, submit a real account email
2. Open the reset link from email
3. **Verify:** Landed on `/reset-password` (callback route exchanged code for session and set `password_reset` cookie)
4. Type a short password (< 8 chars) → **Verify:** Inline hint: "Password must be at least 8 characters long." Button disabled.
5. Type a valid password in "New Password", type a different value in "Confirm Password"
6. **Verify:** Inline hint: "Passwords do not match." Button disabled.
7. Enter matching valid passwords → **Verify:** "Update Password" button becomes enabled
8. Submit
9. **Verify:** Redirected to `/login` (user is signed out after password reset)
10. Login with the **new** password
11. **Verify:** Successful login, redirected to `/`

- [x] **Tested:** Scenario AUTH8: Reset Password — Full Flow

## Scenario AUTH9: Reset Password — Expired / Missing Cookie

> The `/reset-password` page checks for a `password_reset` cookie on load.
> If missing, it redirects to `/forgot-password` before the form renders.

1. Navigate directly to `/reset-password` in the browser (without using a reset link)
2. **Verify:** Immediately redirected to `/forgot-password` (no form shown)
3. **Verify:** User can request a new reset link from this page

- [x] **Tested:** Scenario AUTH9: Reset Password — Expired / Missing Cookie

---

## Scenario PROF1: Profile — Update Fields

1. Login and navigate to `/profile`
2. **Verify:** Email field is disabled/read-only (no "Update" button)
3. Click "Update" next to Username
4. **Verify:** Field becomes editable with "Save" and "Cancel" buttons
5. Clear the field completely → **Verify:** "Save" button is disabled (empty value blocked)
6. Type a too-short username (e.g., `ab`) → **Verify:** Inline hint: "Username must be at least 3 characters long." Save button disabled.
7. Enter a username already taken by another user → **Verify:** Save button is enabled (client can't check uniqueness)
8. Click Save → **Verify:** Error below field: "This username is already taken."
9. Enter a valid new username (e.g., `updateduser`)
10. Click Save → **Verify:** Field reverts to read-only mode showing the new value
11. Refresh the page → **Verify:** Username persists, navbar shows new `@updateduser`
12. Repeat for First Name and Last Name — click "Update", change value, save, verify changes persist after refresh

- [x] **Tested:** Scenario PROF1: Profile — Update Fields

## Scenario PROF2: Profile — Change Password

1. On `/profile`, scroll to Change Password section
2. Enter incorrect current password, valid new password + matching confirmation
3. Submit
4. **Verify:** Field error on Current Password: "Current password is incorrect."
5. Clear fields. Enter correct current password, then type mismatched new/confirm passwords
6. **Verify:** Inline hint below Confirm: "Passwords do not match." "Update Password" button is disabled.
7. Type a short new password (< 8 chars) → **Verify:** Inline hint: "Password must be at least 8 characters long." Button disabled.
8. Enter correct current password, matching valid new passwords → **Verify:** Button becomes enabled
9. Submit
10. **Verify:** Success message (green box): "Password updated successfully."
11. Log out, log back in with the **new** password
12. **Verify:** Successful login, redirected to `/`

- [x] **Tested:** Scenario PROF2: Profile — Change Password

## Scenario PROF3: Profile — Change Avatar Color

1. On `/profile`, click a different avatar color (e.g., Orange)
2. **Verify:** Avatar preview in the picker updates immediately to the new color
3. **Verify:** Color buttons are disabled briefly while saving (transition pending)
4. Refresh the page
5. **Verify:** New color persists in avatar picker and navbar avatar

- [x] **Tested:** Scenario PROF3: Profile — Change Avatar Color

---

## Scenario DEL1: Account Deletion — Blocked for Group Owner

> Uses User 1 (Alex Owner) from Group A, who owns "Olympic Friends".

1. Login as User 1 (alexowner)
2. Navigate to `/profile`
3. Click "Delete Account" button in the red-bordered section
4. **Verify:** Modal appears with title "Delete Account", text "Are you sure you want to delete your account?", and a password field labeled "Enter your password to confirm"
5. **Verify:** "Delete Account" button in modal is disabled (password field is empty)
6. Enter correct password → button becomes enabled
7. Click "Delete Account"
8. **Verify:** Error in modal: "You must transfer ownership or delete all groups you own before deleting your account."
9. **Verify:** Modal stays open, user can click Cancel or X to close
10. Close modal → **Verify:** User remains on `/profile`, account is NOT deleted

- [x] **Tested:** Scenario DEL1: Account Deletion — Blocked for Group Owner

## Scenario DEL2: Account Deletion — Successful (Non-Owner Member)

> Uses a member from Group A who does NOT own any groups. This tests that
> departure tracking fires correctly for each group, just like leaving a group.
> The side effects should be identical to using "Leave Group".

1. Login as User 3 (Casey Gymnast — member of Group A, not owner)
2. Navigate to `/profile`
3. **Verify:** "Delete Account" section appears with red border, warning text, and button
4. Click "Delete Account"
5. **Verify:** Modal appears with title "Delete Account", warning about permanent deletion, and password field
6. Enter **wrong** password, click "Delete Account"
7. **Verify:** Error in modal: "Incorrect password." Modal stays open.
8. Enter **correct** password, click "Delete Account"
9. **Verify:** Button shows "Deleting..." while processing
10. **Verify:** Redirected to `/login`
11. Try logging in with Casey's credentials
12. **Verify:** Error: "Invalid email or password."

**Group side-effects to verify (login as User 1):** 13. Open Group A overview 14. **Verify:** Casey Gymnast no longer appears in the member list 15. **Verify:** Member count decreased by 1 16. If Group A was in `schedule_review` phase (schedules had been generated): - **Verify:** Phase regressed to "Entering Preferences" - **Verify:** All previously generated schedules are gone (combos/window rankings deleted) - **Verify:** Red departed notification shows "Casey Gymnast recently left the group. You will need to regenerate schedules." (`wasPartOfSchedule: true`) - **Verify:** User 1 (Alex) sees affected-buddy notification (Alex had Casey as a soft buddy) - **Verify:** Remaining members with status "preferences_set" retain that status — statusChangedAt is NOT bumped (no false "updated preferences" notifications) 17. If Group A was in `preferences` phase (no schedules generated): - **Verify:** Phase remains "Entering Preferences" - **Verify:** Blue (info) departed notification shows "Casey Gymnast recently left the group." — no "regenerate schedules" suffix (`wasPartOfSchedule: false`) - **Verify:** User 1 (Alex) sees affected-buddy notification (Casey was their soft buddy) 18. In either phase: - **Verify:** Casey's buddy constraints are removed (no one lists Casey as a buddy anymore) - **Verify:** Casey's session preferences are deleted

- [x] **Tested:** Scenario DEL2: Account Deletion — Successful (Non-Owner Member)

## Scenario DEL3: Account Deletion — User in Multiple Groups

> Tests that departure tracking fires for EACH group membership.

1. Create a new user (`multigroupuser`)
2. Have them join Group A and Group B (or any two groups, as a non-owner member)
3. Approve their join requests
4. Navigate to `/profile` and delete the account (enter correct password)
5. **Verify:** Redirected to `/login`
6. **Verify (Group A):** `multigroupuser` removed from member list, appropriate departure side-effects
7. **Verify (Group B):** `multigroupuser` removed from member list, appropriate departure side-effects

- [x] **Tested:** Scenario DEL3: Account Deletion — User in Multiple Groups

## Scenario DEL4: Account Deletion — Owner Transfers Then Deletes

> Full flow: transfer ownership, then delete account.
> Use a fresh account (not one deleted in a prior scenario).

1. Create a new user (e.g., `ownerdeltest`) and a second user (e.g., `newowner`)
2. `ownerdeltest` creates a new group; `newowner` joins and is approved
3. `ownerdeltest` transfers ownership to `newowner` via Group Settings
4. **Verify:** `ownerdeltest` is now a regular member, `newowner` is the owner
5. As `ownerdeltest`: navigate to `/profile` and delete account (enter correct password)
6. **Verify:** Deletion succeeds — redirected to `/login`
7. Login as `newowner` → **Verify:** The group still exists with `newowner` as owner
8. **Verify:** `ownerdeltest` no longer appears in the member list

- [x] **Tested:** Scenario DEL4: Account Deletion — Owner Transfers Then Deletes

## Scenario DEL5: Delete Group — Full Cascade

> Tests that deleting a group removes all dependent data (members, combos,
> purchases, window rankings, etc.) via CASCADE deletes. Uses a fresh group
> to avoid interfering with Groups A/B/C.

**Setup:**

1. Create two new users (e.g., `delgrpowner` and `delgrpmember`)
2. `delgrpowner` creates a new group "Delete Test Group" (consecutive 3 days)
3. `delgrpmember` joins via invite code, `delgrpowner` approves
4. Both users enter preferences (any sport, any sessions)
5. `delgrpowner` generates schedules
6. `delgrpowner` saves a purchase timeslot and records a purchase for any session
   - Assignees: both `delgrpowner` and `delgrpmember`
7. `delgrpmember` marks a session as sold out
8. **Verify:** Group has schedules, purchases, sold-out markers, combos, window rankings

**Delete:**

9. `delgrpowner` opens Group Settings → Danger Zone
10. **Verify:** "Delete" button visible (owner only)
11. Click "Delete"
12. **Verify:** Modal appears with warning "This action is **permanent** and cannot be undone."
13. **Verify:** "Delete" button in modal is disabled until group name is typed
14. Type wrong name → button stays disabled
15. Type correct group name → button becomes enabled
16. Click "Delete"
17. **Verify:**
    - [x] Redirected to `/` (home page)
    - [x] "Delete Test Group" does NOT appear in `delgrpowner`'s group list
    - [x] Login as `delgrpmember` → "Delete Test Group" does NOT appear in their group list
    - [x] `delgrpmember` navigating to the old group URL returns an error or redirect (group not found)

- [x] **Tested:** Scenario DEL5: Delete Group — Full Cascade

---

# Test Execution Checklist

## Recommended Order

1. **Auth scenarios** AUTH1–AUTH5 — signup and login happy paths (creates accounts needed later)
2. **Group B** (solo) — fastest to set up, verifies core algorithm scoring and travel
3. **Group A** Phases A1–A3 — setup, preferences, initial generation with detailed verification
4. **Group A** Phase A4 — notifications, schedule warning flow, regeneration
5. **Group A** Phase A5 — purchase tracking, sold-out, OOB, locked sessions
6. **Group A** Phase A6 — member departures with full side-effect verification
7. **Group A** Phases A7–A8 — convergence/pruning edge cases, window rankings
8. **Group A** Phases A9–A10 — locked session injection, excluded sessions deep verification
9. **Group C** Phases C1–C5 — capacity limits, 12-member scale, minBuddies stress test
10. **Cross-group scenarios** X1–X6 — dirty state guards, browser guards, concurrency, exclusion interaction
11. **Profile scenarios** PROF1–PROF3 — field updates, password change, avatar color
12. **Account deletion** DEL1–DEL5 — owner block, successful deletion, multi-group, transfer+delete, delete group
13. **Auth edge cases** AUTH6–AUTH9 — deleted-user login, forgot/reset password flows

## Key Algorithm Checks (Must-Verify)

- [ ] Group B Jul 22: P=[SWM01, SWM02], B1=[SWM01, DIV12], B2=[DIV11, SWM02]
- [ ] Group B Jul 23: P=[SWM03, SWM04], **no B1, no B2** (both sessions in P, no alternative combos)
- [ ] Group B Jul 22: DIV12+SWM02 NOT in same combo (75 min gap < 150 min required)
- [ ] Group A Jul 17 Alex: GAR08 filtered out by hard buddy constraint (Blake doesn't have GAR08)
- [ ] Group A Jul 17 Dana: BK304 filtered out by hard buddy constraint (Ellis doesn't have BK304)
- [ ] Group A Jul 17 Blake: ATH05+DIV03 NOT in same combo (90 min gap < 120 min Expo→Pasadena)
- [ ] Group A Jul 17 Frankie: DIV02+BK304 feasible (exactly 120 min gap = 120 min Pasadena→Valley)
- [ ] Group A Jul 17 Ellis: DIV02+VBV08 NOT feasible (Pasadena→LB needs 180 min, only 120 available)
- [ ] Group A: Sold-out session excluded for non-purchasers, kept for purchasers (locked)
- [ ] Group A: OOB session excluded per-member only (other members unaffected)
- [ ] Group A: Locked session overrides OOB exclusion (purchase beats budget mark)
- [ ] Group A: Two locked sessions on same day with overlapping times → both appear (travel ignored for locked-only combo)
- [ ] Group A: Purchased session NOT in member's sport rankings → injected with interest=high
- [ ] Group A: Another member's purchase does NOT appear on your schedule
- [ ] Group A: Excluded sessions show both "at generation" and "current" status in Purchase Tracker
- [ ] Group A: Sessions on schedule never appear in Excluded Sessions list
- [ ] Group C: All 12 members get identical schedules with identical preferences
- [ ] Group C: 13th member rejected at capacity
- [ ] Group C: minBuddies=11 with 12 identical members → all sessions pass (count-1=11 ≥ 11)
- [ ] Group C: One member drops a session → minBuddies=11 causes that session to be filtered for requester
- [ ] Group B: Directional travel: BOX15→BK319 feasible (DTLA→Valley 120≥120) but BK319→TTE23 NOT feasible (Valley→DTLA 120<150)
- [ ] Group A: Removing last purchase assignee auto-deletes the purchase record
- [ ] Group A: Buyer departure CASCADE-deletes all their purchases (including other members' ticket assignments)
- [ ] Group A: Sold-out + OOB on same session coexist; unmarking one preserves the other

## Key Auth & Account Checks (Must-Verify)

- [ ] AUTH1: Signup with valid data → redirected to home, navbar shows user info
- [ ] AUTH2: Duplicate username → "This username is already taken."
- [ ] AUTH3: Duplicate email → "This email is already associated with an account."
- [ ] AUTH4: Invalid login → generic "Invalid email or password." (no info leak)
- [ ] AUTH6: Deleted-user login → "Invalid email or password." (no redirect loop/blank screen)
- [ ] AUTH8: Full password reset flow → can login with new password
- [ ] AUTH9: Direct navigation to `/reset-password` without cookie → redirected to `/forgot-password`
- [ ] PROF1: Username uniqueness enforced on profile update
- [ ] PROF2: Wrong current password → field error, correct flow → success
- [ ] DEL1: Owner cannot delete account → ownership error displayed
- [ ] DEL2: Non-owner deletion → account gone, login fails, group departure side-effects fire
- [ ] DEL3: Multi-group user deletion → departure tracking fires for every group
- [ ] DEL4: Transfer ownership then delete → group survives with new owner
- [ ] DEL5: Delete group → all data cascade-deleted, group gone for all members

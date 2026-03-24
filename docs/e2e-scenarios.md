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

- [ ] **Tested:** Phase B1: Setup

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

- [ ] **Tested:** Phase B2: Preferences

## Phase B3: Generate Schedules

### Expected Algorithm Output — Jul 22

**Candidate sessions:** SWM01, SWM02, DIV11, DIV12 (all on Jul 22)

**Session scores** (no soft buddies → bonus = 1.0):

| Session | Sport Mult | Interest Adj | Score |
| ------- | ---------- | ------------ | ----- |
| SWM01   | 2.0        | 1.0 (high)   | 2.0   |
| SWM02   | 2.0        | 1.0 (high)   | 2.0   |
| DIV11   | 1.0        | 0.7 (medium) | 0.7   |
| DIV12   | 1.0        | 1.0 (high)   | 1.0   |

**Travel feasibility for size-2+ combos:**

| Combo                 | Gap Calculation                                                                  | Feasible? |
| --------------------- | -------------------------------------------------------------------------------- | --------- |
| [SWM01, DIV11]        | SWM01 09:30–11:30, DIV11 10:00–12:00 → overlap                                   | No        |
| [SWM01, SWM02]        | Same zone (Inglewood), gap = 18:00 - 11:30 = 390 min ≥ 90                        | Yes       |
| [SWM01, DIV12]        | Inglewood→Pasadena: 36.25 min → 150 min gap. Gap = 15:30 - 11:30 = 240 ≥ 150     | Yes       |
| [DIV11, DIV12]        | Same zone (Pasadena), gap = 15:30 - 12:00 = 210 ≥ 90                             | Yes       |
| [DIV11, SWM02]        | Pasadena→Inglewood: 43.55 min → 150 min gap. Gap = 18:00 - 12:00 = 360 ≥ 150     | Yes       |
| [DIV12, SWM02]        | Pasadena→Inglewood: 43.55 min → 150 min gap. Gap = 18:00 - 16:45 = 75 min        | **No**    |
| [SWM01, SWM02, DIV11] | SWM01 overlaps DIV11                                                             | No        |
| [SWM01, SWM02, DIV12] | SWM01→DIV12: Inglewood→Pasadena 150 min gap, actual = 240 ✓. DIV12→SWM02: 75 min | **No**    |
| [SWM01, DIV11, DIV12] | SWM01 overlaps DIV11                                                             | No        |
| [SWM01, DIV12, SWM02] | Same as SWM01+SWM02+DIV12                                                        | No        |
| [SWM01, DIV11, SWM02] | SWM01 overlaps DIV11                                                             | No        |
| [DIV11, DIV12, SWM02] | DIV12→SWM02: 75 min gap (need 150)                                               | No        |

**Feasible combos sorted by score:**

| Rank | Combo          | Score | Sessions | SportMultSum |
| ---- | -------------- | ----- | -------- | ------------ |
| 1    | [SWM01, SWM02] | 4.0   | 2        | 4.0          |
| 2    | [SWM01, DIV12] | 3.0   | 2        | 3.0          |
| 3    | [DIV11, SWM02] | 2.7   | 2        | 3.0          |
| 4    | [DIV11, DIV12] | 1.7   | 2        | 2.0          |
| 5    | [SWM01]        | 2.0   | 1        | 2.0          |
| 6    | [SWM02]        | 2.0   | 1        | 2.0          |
| 7    | [DIV12]        | 1.0   | 1        | 1.0          |
| 8    | [DIV11]        | 0.7   | 1        | 1.0          |

**Rank assignment:**

- **Primary:** [SWM01, SWM02] — score 4.0
- **Backup1:** [SWM01, DIV12] — has DIV12 not in Primary ✓ — score 3.0
- **Backup2:** [DIV11, SWM02] — has DIV11 not in Primary ✓, has SWM02 not in B1 (SWM02 not in B1's sessions [SWM01, DIV12]) ✓ — score 2.7

### Expected Algorithm Output — Jul 23

**Candidate sessions:** SWM03, SWM04

**Scores:**

| Session | Score           |
| ------- | --------------- |
| SWM03   | 2.0 × 0.7 = 1.4 |
| SWM04   | 2.0 × 1.0 = 2.0 |

**Combos:**

- [SWM03, SWM04]: Same zone, gap = 18:00 - 11:30 = 390 ≥ 90. Score = 3.4
- [SWM04]: Score = 2.0
- [SWM03]: Score = 1.4

**Rank assignment:**

- **Primary:** [SWM03, SWM04] — score 3.4
- **Backup1:** None — [SWM04] only contains SWM04 which IS in Primary. [SWM03] only contains SWM03 which IS in Primary. No combo has a session outside Primary.
- **Backup2:** None.

### Window Ranking

Specific date mode → single window Jul 22–23. Score computation:

| Day    | Primary Score |
| ------ | ------------- |
| Jul 22 | 4.0           |
| Jul 23 | 3.4           |

baseScore = 4.0 + 3.4 = 7.4
stdev = stdev([7.4]) = 0 (only 1 member)
fairnessPenalty = 0 × 1 × 0.5 = 0
**windowScore = 7.4**

Resilience:

- Jul 22: primary=4.0, b1=3.0, b2=2.7. coverage = min((3.0+2.7)/(2×4.0), 1) = min(0.7125, 1) = 0.7125
- Jul 23: primary=3.4, b1=0 (no backup1), b2=0. coverage = min((0+0)/(2×3.4), 1) = 0
- resilience = avg(0.7125, 0) = 0.3563

### Verification Checklist — Phase B3

- [ ] Phase changes to "Reviewing Schedules"
- [ ] My Schedule shows Jul 22: P=[SWM01, SWM02], B1=[SWM01, DIV12], B2=[DIV11, SWM02]
- [ ] My Schedule shows Jul 23: P=[SWM03, SWM04], no B1, no B2 (both sessions are in Primary, so no alternative combos exist)
- [ ] Calendar view: sessions positioned correctly by time
- [ ] List view: Jul 22 listed first (higher primary score 4.0 vs 3.4)
- [ ] Session detail modal: shows correct session info, no "attending" or "interested" members (solo)
- [ ] No non-convergence warnings (should converge in 1 iteration)
- [ ] Window ranking shows single window Jul 22–23 with score ≈ 7.4

- [ ] **Tested:** Phase B3: Generate Schedules

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

### B4.2 — Mark Sold Out + Regenerate

1. Mark SWM01 as Sold Out
2. **Verify:** purchaseDataChangedAt notification appears
3. Regenerate schedules
4. **Expected Jul 22 after regeneration:**
   - SWM01 is sold out, User 1 has NO purchase for SWM01 → **excluded from candidates**
   - SWM02 is purchased (locked) → always included
   - Remaining candidates: SWM02 (locked), DIV11 (unlocked), DIV12 (unlocked)
   - Locked: [SWM02]. Remaining slots = 3 − 1 = 2. Unlocked: [DIV11, DIV12].
   - Combos (locked prepended to all unlocked subsets):

   | Combo                 | Travel Check                                                                             | Feasible | Score |
   | --------------------- | ---------------------------------------------------------------------------------------- | -------- | ----- |
   | [SWM02, DIV11, DIV12] | DIV12(end 16:45) → SWM02(start 18:00): Pasadena→Inglewood 43.55 → 150 min needed, gap=75 | **No**   | —     |
   | [SWM02, DIV11]        | DIV11(end 12:00) → SWM02(start 18:00): gap=360 ≥ 150                                     | Yes      | 2.7   |
   | [SWM02, DIV12]        | DIV12(end 16:45) → SWM02(start 18:00): gap=75 < 150                                      | **No**   | —     |
   | [SWM02] (locked-only) | single session                                                                           | Yes      | 2.0   |
   - P=[DIV11, SWM02] score=2.7. [SWM02] only has SWM02 (in P) → no B1. No B2.

5. **Verify Jul 22:** P=[DIV11, SWM02] score=2.7, no B1, no B2
6. **Verify:** SWM01 appears in Excluded Sessions list with "Sold Out" status
7. **Verify Jul 23:** unchanged (SWM03, SWM04 unaffected)

### B4.3 — Mark Out of Budget + Regenerate

1. Mark DIV11 as Out of Budget
2. Regenerate
3. **Expected Jul 22:**
   - Excluded: SWM01 (sold out), DIV11 (OOB)
   - Remaining: SWM02 (locked), DIV12
   - [SWM02, DIV12]: Gap = 75 < 150. Not feasible.
   - [SWM02] alone: Score = 2.0
   - Locked-only fallback: [SWM02]
   - **P = [SWM02] score=2.0, no B1, no B2**
4. **Verify:** Only SWM02 on Jul 22 schedule
5. **Verify:** Excluded list shows SWM01 (sold out) and DIV11 (out of budget)

### B4.4 — Unmark and Restore

1. Unmark DIV11 Out of Budget
2. Unmark SWM01 Sold Out
3. Regenerate
4. **Verify:** Schedule returns to original state (Phase B3 results)

- [ ] **Tested:** Phase B4: Purchase Tracking

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

**User 1 creates group:**

| Field            | Value            |
| ---------------- | ---------------- |
| Group Name       | Olympic Friends  |
| Date Mode        | Consecutive Days |
| Consecutive Days | 5                |

**Users 2–6 join:** User 1 shares invite code. User 1 approves all.

**Verify:**

- All 6 members shown on overview with status "Joined"
- Phase = "Entering Preferences"

- [ ] **Tested:** Phase A1: Account Setup

## Phase A2: Enter Preferences

### User 1 — Alex (Owner)

**Buddies:**

| Setting        | Value            |
| -------------- | ---------------- |
| Min Buddies    | 0                |
| User 2 (Blake) | Required (hard)  |
| User 3 (Casey) | Preferred (soft) |

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

- [ ] **Tested:** Phase A2: Enter Preferences

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

## Phase A3: Generate Schedules — Detailed Algorithm Verification (Jul 17)

### Step 1: Session Interest Counts (Jul 17)

| Session | Interested Members | Count |
| ------- | ------------------ | ----- |
| ATH05   | U1, U2, U3         | 3     |
| ATH06   | U1, U2             | 2     |
| GAR08   | U1, U3             | 2     |
| DIV02   | U2, U5, U6         | 3     |
| DIV03   | U2, U6             | 2     |
| VBV07   | U3, U4, U5         | 3     |
| VBV08   | U4, U5             | 2     |
| BK304   | U4, U6             | 2     |

### Step 2: Filtering (Jul 17)

**User 1 (hard buddy: User 2):**
User 2's candidate sessions on Jul 17: ATH05, ATH06, DIV02, DIV03.

- ATH05: User 2 has it → KEEP
- ATH06: User 2 has it → KEEP
- GAR08: User 2 does NOT have it → **FILTERED OUT**

After filtering: **ATH05, ATH06**

**User 4 (hard buddy: User 5, minBuddies: 1):**
User 5's candidate sessions on Jul 17: VBV07, VBV08, DIV02.

- VBV07: User 5 has it → KEEP
- VBV08: User 5 has it → KEEP
- BK304: User 5 does NOT have it → **FILTERED OUT**

MinBuddies check (minBuddies=1):

- VBV07: count=3, 3−1=2 ≥ 1 → KEEP
- VBV08: count=2, 2−1=1 ≥ 1 → KEEP

After filtering: **VBV07, VBV08**

**Users 2, 3, 5, 6:** No hard buddies, minBuddies=0 → no filtering.

### Step 3: Combo Generation & Scoring (Jul 17)

#### User 1 — Jul 17

Filtered sessions: ATH05, ATH06 (both Exposition Park Zone)
Soft buddy: User 3. User 3 has ATH05 → 1 soft buddy interested.

| Session | SportMult | InterestAdj | SoftBuddyBonus           | Score   |
| ------- | --------- | ----------- | ------------------------ | ------- |
| ATH05   | 2.0       | 1.0         | 1.25 (U3 has it)         | **2.5** |
| ATH06   | 2.0       | 1.0         | 1.0 (U3 doesn't have it) | **2.0** |

Travel: Same zone, gap = 16:30 − 14:00 = 150 min ≥ 90 ✓

| Combo          | Score | Sc  | SmSum |
| -------------- | ----- | --- | ----- |
| [ATH05, ATH06] | 4.5   | 2   | 4.0   |
| [ATH05]        | 2.5   | 1   | 2.0   |
| [ATH06]        | 2.0   | 1   | 2.0   |

**Result:** P=[ATH05, ATH06] score=4.5. No B1 or B2 (no sessions outside P available).

- [ ] **Tested:** Phase A3: Generate Schedules — Detailed Algorithm Verification (Jul 17)

---

#### User 2 — Jul 17

Sessions: ATH05, ATH06, DIV02, DIV03.
Soft buddy: User 1. User 1 (after filtering) has ATH05, ATH06.

| Session | SportMult | InterestAdj | SoftBuddyBonus   | Score    |
| ------- | --------- | ----------- | ---------------- | -------- |
| ATH05   | 2.0       | 1.0 (high)  | 1.25 (U1 has it) | **2.5**  |
| ATH06   | 2.0       | 0.7 (med)   | 1.25 (U1 has it) | **1.75** |
| DIV02   | 1.0       | 0.7 (med)   | 1.0 (U1 doesn't) | **0.7**  |
| DIV03   | 1.0       | 1.0 (high)  | 1.0 (U1 doesn't) | **1.0**  |

**Key travel checks:**

| Pair        | Zones                                   | Gap                | Required                            | Feasible |
| ----------- | --------------------------------------- | ------------------ | ----------------------------------- | -------- |
| ATH05→DIV02 | Expo(end 14:00) → Pasadena(start 10:00) | −240 min (overlap) | —                                   | **No**   |
| ATH05→DIV03 | Expo(end 14:00) → Pasadena(start 15:30) | 90 min             | 120 min (Expo→Pasadena: 27.33, <30) | **No**   |
| ATH05→ATH06 | same zone                               | 150 min            | 90 min                              | Yes      |
| DIV02→DIV03 | same zone                               | 210 min            | 90 min                              | Yes      |
| DIV02→ATH06 | Pasadena→Expo (25.02, <30)              | 270 min            | 120 min                             | Yes      |
| DIV03→ATH06 | Pasadena(end 16:45) → Expo(start 16:30) | −15 min (overlap)  | —                                   | **No**   |

**Feasible combos sorted** (by score desc, then sessionCount desc, sportMultiplierSum desc, alphabetical):

| #   | Combo          | Score | Sc  | SmSum |
| --- | -------------- | ----- | --- | ----- |
| 1   | [ATH05, ATH06] | 4.25  | 2   | 4.0   |
| 2   | [ATH05]        | 2.5   | 1   | 2.0   |
| 3   | [DIV02, ATH06] | 2.45  | 2   | 3.0   |
| 4   | [ATH06]        | 1.75  | 1   | 2.0   |
| 5   | [DIV02, DIV03] | 1.7   | 2   | 2.0   |
| 6   | [DIV03]        | 1.0   | 1   | 1.0   |
| 7   | [DIV02]        | 0.7   | 1   | 1.0   |

**Rank assignment:**

- **P = [ATH05, ATH06]** score 4.25
- B1 search: [ATH05] — only ATH05 (in P), skip. [DIV02, ATH06] — DIV02 not in P ✓.
- **B1 = [DIV02, ATH06]** score 2.45
- B2 search (excluding B1): [ATH06] — ATH06 in P, skip. [DIV02, DIV03] — DIV02 not in P ✓, DIV03 not in B1 ✓.
- **B2 = [DIV02, DIV03]** score 1.7

---

#### User 3 — Jul 17

Sessions: GAR08, ATH05, VBV07. No buddy constraints.

| Session | SportMult | InterestAdj | Score    |
| ------- | --------- | ----------- | -------- |
| GAR08   | 2.0       | 1.0 (high)  | **2.0**  |
| ATH05   | 1.5       | 0.7 (med)   | **1.05** |
| VBV07   | 1.0       | 0.4 (low)   | **0.4**  |

**Travel checks:**

| Pair                                              | Gap     | Required                      | Feasible |
| ------------------------------------------------- | ------- | ----------------------------- | -------- |
| ATH05(Expo, end 14:00) → VBV07(LB, start 09:00)   | overlap | —                             | **No**   |
| ATH05(Expo, end 14:00) → GAR08(DTLA, start 17:15) | 195 min | 90 min (Expo→DTLA: 9.9, <15)  | Yes      |
| VBV07(LB, end 12:00) → GAR08(DTLA, start 17:15)   | 315 min | 150 min (LB→DTLA: 37.13, <45) | Yes      |

**Feasible combos sorted:**

| #   | Combo          | Score | Sc  | SmSum |
| --- | -------------- | ----- | --- | ----- |
| 1   | [ATH05, GAR08] | 3.05  | 2   | 3.5   |
| 2   | [VBV07, GAR08] | 2.4   | 2   | 3.0   |
| 3   | [GAR08]        | 2.0   | 1   | 2.0   |
| 4   | [ATH05]        | 1.05  | 1   | 1.5   |
| 5   | [VBV07]        | 0.4   | 1   | 1.0   |

**Result:** P=[ATH05, GAR08] score=3.05. B1=[VBV07, GAR08] (VBV07 not in P ✓) score=2.4. No B2.

---

#### User 4 — Jul 17

Filtered sessions: VBV07, VBV08 (both Long Beach). No soft buddies.

| Session | SportMult | InterestAdj | Score   |
| ------- | --------- | ----------- | ------- |
| VBV07   | 2.0       | 1.0 (high)  | **2.0** |
| VBV08   | 2.0       | 1.0 (high)  | **2.0** |

Travel: Same zone, gap = 14:00 − 12:00 = 120 min ≥ 90 ✓

| Combo          | Score |
| -------------- | ----- |
| [VBV07, VBV08] | 4.0   |
| [VBV07]        | 2.0   |
| [VBV08]        | 2.0   |

**Result:** P=[VBV07, VBV08] score=4.0. No B1, no B2 (no sessions outside P).

---

#### User 5 — Jul 17

Sessions: VBV07, VBV08, DIV02. No buddy constraints.

| Session | SportMult | InterestAdj | Score   |
| ------- | --------- | ----------- | ------- |
| VBV07   | 2.0       | 1.0 (high)  | **2.0** |
| VBV08   | 2.0       | 0.7 (med)   | **1.4** |
| DIV02   | 1.0       | 1.0 (high)  | **1.0** |

**Travel checks:**

| Pair                                                | Gap     | Required                          | Feasible |
| --------------------------------------------------- | ------- | --------------------------------- | -------- |
| VBV07(LB, end 12:00) → VBV08(LB, start 14:00)       | 120 min | 90 min (same zone)                | Yes      |
| VBV07(LB, end 12:00) → DIV02(Pasadena, start 10:00) | overlap | —                                 | **No**   |
| DIV02(Pasadena, end 12:00) → VBV08(LB, start 14:00) | 120 min | 180 min (Pasadena→LB: 49.38, <60) | **No**   |

**Feasible combos sorted:**

| #   | Combo          | Score | Sc  | SmSum |
| --- | -------------- | ----- | --- | ----- |
| 1   | [VBV07, VBV08] | 3.4   | 2   | 4.0   |
| 2   | [VBV07]        | 2.0   | 1   | 2.0   |
| 3   | [VBV08]        | 1.4   | 1   | 2.0   |
| 4   | [DIV02]        | 1.0   | 1   | 1.0   |

**Result:** P=[VBV07, VBV08] score=3.4. B1=[DIV02] (not in P ✓) score=1.0. No B2.

---

#### User 6 — Jul 17

Sessions: DIV02, DIV03, BK304. No buddy constraints.

| Session | SportMult | InterestAdj | Score   |
| ------- | --------- | ----------- | ------- |
| DIV02   | 2.0       | 1.0 (high)  | **2.0** |
| DIV03   | 2.0       | 1.0 (high)  | **2.0** |
| BK304   | 1.0       | 0.7 (med)   | **0.7** |

**Travel checks:**

| Pair                                                    | Gap                | Required                              | Feasible                 |
| ------------------------------------------------------- | ------------------ | ------------------------------------- | ------------------------ |
| DIV02(Pasadena, end 12:00) → BK304(Valley, start 14:00) | 120 min            | 120 min (Pasadena→Valley: 24.72, <30) | **Yes** (exactly meets!) |
| BK304(Valley, end 16:00) → DIV03(Pasadena, start 15:30) | −30 min (overlap)  | —                                     | **No**                   |
| DIV02 → DIV03                                           | same zone, 210 min | 90 min                                | Yes                      |

**Feasible combos sorted:**

| #   | Combo          | Score | Sc  | SmSum |
| --- | -------------- | ----- | --- | ----- |
| 1   | [DIV02, DIV03] | 4.0   | 2   | 4.0   |
| 2   | [DIV02, BK304] | 2.7   | 2   | 3.0   |
| 3   | [DIV02]        | 2.0   | 1   | 2.0   |
| 4   | [DIV03]        | 2.0   | 1   | 2.0   |
| 5   | [BK304]        | 0.7   | 1   | 1.0   |

**Result:** P=[DIV02, DIV03] score=4.0. B1=[DIV02, BK304] (BK304 not in P ✓) score=2.7. No B2.

---

### Step 4: Post-Generation Validation (Jul 17)

**User 1 (hard buddy: User 2):**

- ATH05: User 2 has ATH05 in P ✓
- ATH06: User 2 has ATH06 in P and B1 ✓

**User 4 (hard buddy: User 5, minBuddies=1):**

- VBV07: User 5 has VBV07 in P ✓. Attendance: U3(P), U4(P), U5(P) = 3. 3−1=2 ≥ 1 ✓
- VBV08: User 5 has VBV08 in P ✓. Attendance: U4(P), U5(P) = 2. 2−1=1 ≥ 1 ✓

**All other users:** minBuddies=0, no hard buddies → no violations.

**Result: 0 violations → Converged in iteration 1.**

---

### Jul 17 Summary (What to Verify in Browser)

| User   | Primary      | P Score | B1           | B1 Score | B2           | B2 Score |
| ------ | ------------ | ------- | ------------ | -------- | ------------ | -------- |
| User 1 | ATH05, ATH06 | 4.5     | —            | —        | —            | —        |
| User 2 | ATH05, ATH06 | 4.25    | DIV02, ATH06 | 2.45     | DIV02, DIV03 | 1.7      |
| User 3 | ATH05, GAR08 | 3.05    | VBV07, GAR08 | 2.4      | —            | —        |
| User 4 | VBV07, VBV08 | 4.0     | —            | —        | —            | —        |
| User 5 | VBV07, VBV08 | 3.4     | DIV02        | 1.0      | —            | —        |
| User 6 | DIV02, DIV03 | 4.0     | DIV02, BK304 | 2.7      | —            | —        |

### Additional Day Verification Points

For Jul 16, 18, 19 — verify these key behaviors without computing every score:

**Jul 16:**

- User 1 has ATH03, ATH04, GAR04. Hard buddy filter: User 2 has ATH03 and ATH04 but NOT GAR04 → GAR04 filtered out for User 1.
- User 4 hard buddy filter: User 5 has VBV04 and VBV05 but NOT BK301 → BK301 filtered out for User 4.
- Travel check for User 2: ATH03 (Expo, ends 12:00) and DIV01 (Pasadena, starts 10:00) overlap → can't be in same combo.

**Jul 18:**

- User 1 has ATH07, ATH08, GAR09. Hard buddy filter: User 2 has ATH07 and ATH08 but NOT GAR09 → GAR09 filtered out.
- User 5 has VBV10, VBV11, DIV04. DIV04 (Pasadena, ends 12:30) → VBV11 (LB, starts 14:00): gap=90 min, Pasadena→LB needs 180 min → NOT feasible.

**Jul 19:**

- User 5 has VBV13 (LB, 09:00–12:00) and DIV06 (Pasadena, 15:30–16:45). Gap = 15:30 − 12:00 = 210 min. Direction: Long Beach → Pasadena = 49.88 → < 60 → 180 min required. 210 ≥ 180 ✓. These CAN be in the same combo. Verify User 5 gets [VBV13, DIV06] in a combo.
- User 1 has ATH09 and ATH10 (both Expo Park). Gap = 16:00 − 12:00 = 240 ≥ 90 ✓. User 2 (hard buddy) has ATH09 → passes filter. ATH10 is in User 1's prefs; check if User 2 also has ATH10... User 2 does NOT have ATH10 → ATH10 filtered out by hard buddy. User 1 left with only ATH09 on Jul 19.
- User 6 has DIV06 and BK310. DIV06 (Pasadena, 15:30–16:45) and BK310 (Valley, 14:00–16:00): BK310 ends 16:00, DIV06 starts 15:30. Gap = −30 (overlap). NOT in same combo. Each appears separately.

### Convergence & Non-Convergence Verification

- [ ] The algorithm should converge in 1 iteration (no violations)
- [ ] No non-convergence warnings displayed
- [ ] No members in `membersWithNoCombos`
- [ ] Phase transitions to "Reviewing Schedules"

---

## Phase A4: Notification & Regeneration Testing

### A4.1 — User Updates Preferences After Generation

1. **As User 3:** Go to Preferences → Step 2 (Sessions)
2. Add session ATH11 (Jul 20, Expo, 09:30–12:00) with High interest
3. Click "Next" (to advance/save)
4. **Schedule warning modal should appear:** "Schedules have already been generated. If you update preferences now, the owner will need to re-generate schedules for all group members. Are you sure you want to proceed?"
5. **First test Cancel:** Click Cancel → verify all steps revert to saved state (ATH11 removed)
6. Re-add ATH11, click Next again → modal appears → click **Proceed**
7. Save succeeds → `ackScheduleWarning()` called (only on save success)
8. **Verify as User 3:** `statusChangedAt` updated (now > `scheduleGeneratedAt`)
9. **Verify as User 1 (owner):**
   - Blue notification: "Casey Gymnast has updated their preferences. These updates won't be reflected on your schedule until the owner regenerates schedules."
   - Generate button enabled with regeneration-needed state
   - Overview tab shows attention badge
10. **Verify as User 2 (member):**
    - Blue notification about Casey's updated preferences
    - Message variant for non-owners: "...won't be reflected until the owner regenerates schedules"

### A4.2 — New Member Joins After Generation

1. Create **User 7** (username: `guestuser7`, avatar: Yellow)
2. User 7 joins "Olympic Friends" with invite code
3. **User 1 approves** User 7
4. User 7 enters preferences: Sport = Diving (#1), sessions = DIV02 (High), DIV03 (High)
5. **Verify as User 1:**
   - Blue notification: "Guest recently joined. Regenerate schedules to include them."
   - Generate button enabled

### A4.3 — Regenerate with New Member

1. User 1 regenerates
2. **Verify:** User 7 now has a schedule (DIV02 and DIV03 on Jul 17)
3. **Verify:** User 7's presence increases interest counts for DIV02 (now 4: U2, U5, U6, U7) and DIV03 (now 3: U2, U6, U7)
4. All notifications cleared, all departure tracking reset

- [ ] **Tested:** Phase A4: Notification & Regeneration Testing

---

## Phase A5: Purchase Tracking & Locked Session Testing

### A5.1 — Record Purchases

1. **User 4:** Save timeslot (any future date/time range)
2. **User 4:** Record purchase for VBV07 (Jul 17)
   - Assignees: User 4 (self), User 5
   - Price per ticket: $75.00
3. **Verify:** Green checkmark on VBV07 for both User 4 and User 5
4. **Verify as User 5:** VBV07 shows "purchased" in session detail

### A5.2 — Mark Sold Out + Regenerate

1. **User 4:** Mark VBV08 as Sold Out
2. **Verify:** purchaseDataChangedAt notification appears for owner (amber warning)
3. **User 1:** Regenerate
4. **Expected for User 4 on Jul 17:**
   - VBV07 is locked (purchased, from A5.1) → always included
   - VBV08 is sold out, User 4 has NO purchase for VBV08 → **excluded from candidates**
   - BK304 is still in User 4's preferences, but hard buddy filter applies: User 5's candidates now = {VBV07 (not sold out), DIV02 (not sold out)} — User 5 does NOT have BK304 → BK304 filtered out
   - After filtering: only VBV07 (locked)
   - P=[VBV07] score=2.0. No B1, no B2.
5. **Expected for User 5 on Jul 17:**
   - VBV07 is locked (purchased, assigned in A5.1) → always included
   - VBV08 is sold out, User 5 has NO purchase for VBV08 → **excluded from candidates**
   - DIV02 remains (not sold out, not OOB)
   - Locked: [VBV07]. Unlocked: [DIV02]. Combo = [VBV07, DIV02].
   - Travel: VBV07(LB, 09:00–12:00) and DIV02(Pasadena, 10:00–12:00) overlap → NOT feasible
   - Fallback: locked-only combo [VBV07] (unlocked sessions cannot appear without locked)
   - P=[VBV07] score=2.0. No B1, no B2.
6. **Verify per-member excluded sessions after regeneration:**
   - User 4: `excludedSessionCodes` includes `{code: "VBV08", soldOut: true, outOfBudget: false}`
   - User 5: `excludedSessionCodes` includes `{code: "VBV08", soldOut: true, outOfBudget: false}`
   - Users 1, 2, 3, 6: VBV08 was NOT in their preferences → does NOT appear in their excluded list
7. **Verify in Purchase Tracker:** VBV08 appears in "Excluded Sessions" section for User 4 and User 5 with "Sold Out" badge
8. **Verify sold-out blocks purchases:** Attempting to record a purchase for VBV08 should fail with error (server-side sold-out check)

### A5.3 — Out of Budget

1. **User 5:** Mark DIV02 as Out of Budget
2. **Verify:** purchaseDataChangedAt notification updated
3. Regenerate
4. **Expected for User 5 on Jul 17:**
   - VBV07 locked → always included
   - VBV08 sold out → excluded
   - DIV02 marked OOB by User 5, User 5 has NO purchase for DIV02 → **excluded**
   - Only VBV07 remains: P=[VBV07] score=2.0
5. **Verify for User 5:** `excludedSessionCodes` includes both `{code: "VBV08", soldOut: true, outOfBudget: false}` and `{code: "DIV02", soldOut: false, outOfBudget: true}`
6. **Verify for User 2:** DIV02 still in User 2's schedule — OOB is per-member, User 2 did NOT mark it
7. **Verify for User 6:** DIV02 still in User 6's schedule — User 6 did NOT mark it OOB

### A5.4 — Purchase Overrides Exclusion (Locked Beats OOB)

1. **User 5:** Record purchase for DIV02
   - Assignees: User 5 (self)
   - Price: $50.00
2. **Verify:** Purchase recorded. DIV02 now has green checkmark. User 5 is assignee.
3. Regenerate
4. **Expected for User 5 on Jul 17:**
   - DIV02 is now locked (purchased) → included despite OOB marking
     (candidate assembly: `!memberOob.has("DIV02") || memberLocked.has("DIV02")` → kept)
   - VBV07 is locked (from A5.1)
   - VBV08 is sold out → excluded (no purchase)
   - Both locked sessions on Jul 17: VBV07 (LB, 09:00–12:00) and DIV02 (Pasadena, 10:00–12:00)
   - Locked: [VBV07, DIV02]. Remaining slots = 1. No unlocked sessions.
   - Only combo: [VBV07, DIV02]. Travel: overlap (both start ~09:00–10:00). **Infeasible.**
   - But both are locked → locked-only fallback applies → travel feasibility ignored.
   - Scores: VBV07 = 2.0×1.0 = 2.0 (BV rank 1, high). DIV02 = 1.0×1.0 = 1.0 (Div rank 2, high — was in User 5's original preferences with High interest).
   - **P=[VBV07, DIV02] score=3.0.** No B1, no B2.
5. **Verify in browser:**
   - User 5's Jul 17 Primary shows both VBV07 and DIV02 despite being in different zones with overlapping times
   - This is an intentional design: purchased tickets must appear regardless of travel feasibility
   - DIV02 still shows "Out of Budget" badge in Purchase Tracker but is on the schedule
6. **Verify for User 5:** `excludedSessionCodes` should now include only VBV08 (sold out). DIV02 is no longer excluded since it passed candidate assembly (locked override).

- [ ] **Tested:** Phase A5: Purchase Tracking & Locked Session Testing

---

## Phase A6: Member Departure Scenarios

### A6.1 — Remove User 7 (Post-Generation Joiner)

1. **User 1:** Remove User 7 from group (confirmation modal should mention preferences phase impact)
2. **Verify:** Schedule preserved (User 7's joinedAt > scheduleGeneratedAt → was not part of generation)
3. **Verify:** Phase stays unchanged (no combo/windowRanking deletion)
4. **Verify:** User 7's buddy constraints and session preferences deleted (FK cascade)
5. **Verify:** If any member had User 7 as a buddy → that member appears in `affectedBuddyMembers` with User 7's name

### A6.2 — User 5 Departs (Was Part of Generation)

1. First confirm User 5 sees the departure warning: "Leave Group" shows confirmation modal with phase-specific text. Since schedules exist, modal warns: schedules will be deleted and regeneration needed.
2. If User 5 has any purchase data (from Phase A5), the modal shows a red warning: departing deletes their purchases and removes them as assignee from others' purchases.
3. **User 5 (Ellis):** Confirm leave.
4. **Expected side effects (all happen in single transaction):**
   - User 5's buddy constraints deleted (User 4's hard buddy referencing User 5)
   - User 5's session preferences deleted
   - User 5 was part of last generation (joinedAt ≤ scheduleGeneratedAt) → all combos, comboSessions, windowRankings for group deleted
   - Members at status "preferences_set" get `statusChangedAt` bumped (but NOT status change — members at "joined" stay "joined")
   - Phase → "preferences"
   - User 5 tracked in `departedMembers` array: `{userId, name: "Ellis Diver", departedAt}`
   - User 4 had User 5 as hard buddy → User 4 added to `affectedBuddyMembers`: `{User4Id: ["Ellis Diver"]}`
   - User 5's member row deleted (FK cascades delete purchases, assignees, plan entries, timeslot)
   - Sold-out records where User 5 was reporter: `reportedByMemberId` set to null (record persists)
5. **Verify as User 4:**
   - Red notification: "Ellis Diver was automatically removed from your required buddies list because they recently left or were removed from the group."
   - Preferences Review step shows affected buddy warning with "Confirm" button
6. **Verify as User 1 (owner):**
   - Red notification: "Ellis Diver recently left the group. You will need to regenerate schedules."
   - Generate button disabled: tooltip "All affected members must review their buddy preferences first."
7. **Verify as User 2 (non-owner member):**
   - Red notification: "Ellis Diver recently left the group. Wait for the group owner to regenerate schedules."
8. **Verify all schedule tabs:** Warning icon with "Schedules have not been generated yet." (phase is now "preferences")
9. **Verify:** If User 5's purchases from A5.1 existed, they are now gone — green checkmarks removed from affected sessions

### A6.3 — User 4 Reviews Affected Buddies

1. **User 4:** Go to Preferences → Step 3 (Review)
2. Click "Confirm" to acknowledge affected buddy review
3. **Verify:** `affectedBuddyMembers` cleared for User 4
4. **User 4:** Update buddies — remove User 5 as hard buddy, set minBuddies=0
5. Save preferences

### A6.4 — Regenerate After Departure

1. **User 1:** Regenerate (now possible since affected buddies cleared)
2. **Verify:** Schedule generated for 5 remaining members (Users 1-4, 6)
3. **Verify:** User 4 on Jul 17 now has BK304 available (no longer filtered by hard buddy constraint)

### A6.5 — User 5 Rejoins

1. **User 5:** Re-request to join with same invite code
2. **User 1:** Approve
3. **Verify:** `rejoinedAt` set in `departedMembers`
4. **Verify:** Blue "rejoined" notification appears
5. User 5 must set preferences again before regeneration

- [ ] **Tested:** Phase A6: Member Departure Scenarios

---

## Phase A7: Convergence, Pruning & Non-Convergence

> **Prerequisite:** Restore the group to 6 original members (Users 1–6) with original
> preferences from Phase A2. Remove User 7 if still present. Unmark all sold-out and OOB.
> Delete all purchases. Regenerate clean to confirm Phase A3 results.

### A7.1 — Trigger Convergence Pruning via Conflicting Constraints

This scenario creates a constraint violation that the convergence loop must resolve
by pruning sessions across iterations.

**Setup:**

1. **User 2:** Update buddies → set User 1 as Required (hard buddy)
   - User 1 already has User 2 as Required (mutual hard buddies)
2. **User 1:** Update sessions → REMOVE ATH06 interest (keep ATH05, GAR08, plus other days)
3. **User 2:** Keep all original sessions including ATH06

**Why this triggers pruning (Jul 17):**

- User 2 has ATH05 and ATH06. User 1 has ATH05 and GAR08.
- **Iteration 1 filtering:**
  - User 1 hard buddy filter (U2): ATH05 (U2 has it ✓), GAR08 (U2 doesn't have it ✗) → User 1 filtered to [ATH05]
  - User 2 hard buddy filter (U1): ATH05 (U1 has it ✓), ATH06 (U1 doesn't have it ✗) → User 2 filtered to [ATH05]
  - Both get P=[ATH05].
- **Iteration 1 validation:** User 1's P contains ATH05. Does U2 have ATH05 in any combo? Yes (P). ✓. No violations.
- Actually this converges cleanly. Both members just lose their second session. No pruning needed.

**Better approach — trigger a minBuddies violation:**

1. **User 3:** Update buddies → set minBuddies = 3
2. **User 3** has sessions: GAR08, ATH05, VBV07 on Jul 17
   - Iteration 1 interest counts (Jul 17): ATH05=3, GAR08=2, VBV07=3
   - MinBuddies filter for User 3: ATH05: 3−1=2 < 3 ✗, GAR08: 2−1=1 < 3 ✗, VBV07: 3−1=2 < 3 ✗
   - **All sessions filtered out for User 3 on Jul 17!** User 3 gets 0 combos on Jul 17.
3. If User 3 also has sessions on other days that pass (e.g., Jul 16 with GAR04 interest count high enough), User 3 will still get combos on those days.
4. Regenerate.

**Expected:**

- User 3 has 0 combos on Jul 17 (all sessions fail minBuddies=3 check since no session has 4+ interested members)
- If User 3 has combos on other days → they are NOT in `membersWithNoCombos` (that's only for members with 0 combos across ALL days)
- Schedule generated successfully. User 3 simply has no sessions on Jul 17.

**Verify:**

- [ ] User 3's My Schedule shows no sessions for Jul 17
- [ ] User 3's other days still have sessions
- [ ] No non-convergence warning (constraints were resolved by filtering, not by pruning violations)

### A7.2 — membersWithNoCombos (Total Filterout)

To put a member in `membersWithNoCombos`, ALL their sessions across ALL days must be filtered out.

**Setup:**

1. **User 3:** Set minBuddies = 5 (only 5 other members in group → need 5 others per session, meaning ALL 6 members must be interested)
2. No session in User 3's preferences has all 6 members interested
3. Regenerate

**Expected:**

- Every session for User 3 fails minBuddies filter (no session has 6 interested members)
- User 3 ends up in `membersWithNoCombos`
- Phase stays **"preferences"** (NOT "schedule_review")
- Other members' combos are generated but NOT saved (phase doesn't advance)

**Verify:**

- [ ] Phase stays "Entering Preferences"
- [ ] Red notification: "Some members received no sessions on their schedules..."
- [ ] User 3's Review step shows "no combos" warning instructing them to update preferences
- [ ] Generate button shows: "Members without sessions need to update their preferences"
- [ ] All schedule-dependent tabs show warning icon: "Schedules have not been generated yet"

### A7.3 — True Non-Convergence (Pruning Loop Violations)

This tests the case where the convergence loop runs multiple iterations but can't
fully resolve all violations, resulting in `nonConvergenceMembers`.

**Setup:**

1. Restore User 3 to minBuddies=0 (undo A7.2)
2. **User 1:** Set minBuddies = 1, keep User 2 as hard buddy
3. **User 2:** Set minBuddies = 1, set User 1 as hard buddy
4. **User 3:** Set minBuddies = 2
5. Now consider Jul 17: ATH05 has interest from U1, U2, U3 (count=3). After filtering:
   - User 3 with minBuddies=2: ATH05 count=3, 3−1=2 ≥ 2 ✓. GAR08 count=2, 2−1=1 < 2 ✗. VBV07 count=3, 3−1=2 ≥ 2 ✓.
   - So GAR08 filtered for User 3. User 3 gets [ATH05, VBV07] after filtering.

   This still converges cleanly (filtering resolves the constraint). To get TRUE non-convergence, we need a scenario where post-generation validation finds violations even after filtering passed.

   **Key insight:** Non-convergence happens when the minBuddies check PASSES at the candidate level (enough members interested) but FAILS at the primary combo level (not enough members actually have the session in their combos on that day).

   This is hard to construct manually because it depends on multi-member combo interactions.

6. **Alternative verification approach:** Instead of constructing an exact non-convergence case, verify the UI behavior with this test:
   - If the algorithm runs 5 iterations without converging, affected members appear in `nonConvergenceMembers`
   - The amber warning system is the same code path regardless of the specific constraint configuration

**Verify non-convergence UI (if triggered):**

- [ ] Amber warning banner above affected member's My Schedule: "The algorithm was not able to meet all of your requirements..."
- [ ] Amber notification in Overview page Notifications section (visible only to affected members)
- [ ] Non-affected members do NOT see the amber warning
- [ ] Phase is "Reviewing Schedules" (schedule IS saved, just with violations)
- [ ] Generate button shows option to regenerate (affected members can adjust preferences)

### A7.4 — Locked Session Prevents Convergence

Locked sessions are never pruned. If a locked session causes a constraint violation,
it persists through all 5 iterations.

**Setup (builds on A5 state where VBV07 is purchased for U4 and U5):**

1. Ensure VBV07 is purchased (locked for U4 and U5)
2. **User 4:** Set hard buddy = User 6 (Frankie)
3. User 6 does NOT have VBV07 in any preferences (User 6 has DIV02, DIV03, BK304)
4. Regenerate

**Expected for User 4 on Jul 17:**

- VBV07 is locked → included in every combo, bypasses hard buddy filter
- Other sessions (VBV08, BK304) pass hard buddy filter against User 6's sessions? User 6 has BK304 → BK304 passes. User 6 doesn't have VBV08 → VBV08 filtered out.
- After filter: VBV07 (locked, bypasses filter), BK304 (passed filter)
- Post-generation validation: VBV07 is locked → **skips validation**. BK304 checked: does U6 have BK304 in any combo? If yes → passes. If no → violation.
- If BK304 is in User 6's combos on Jul 17 (User 6's P=[DIV02, DIV03], B1=[DIV02, BK304]) → BK304 IS in User 6's B1 ✓. No violation.

So this actually converges. The locked session bypass means VBV07 doesn't cause violations even though the hard buddy doesn't have it.

**Verify:** Locked sessions appearing in Primary are NOT flagged as constraint violations, even when the hard buddy doesn't have the session in any combo. This is the intended behavior: "purchased tickets must appear regardless."

- [ ] **Tested:** Phase A7: Convergence, Pruning & Non-Convergence

---

## Phase A8: Window Ranking Verification

> **Prerequisite:** Restore all preferences to original Phase A2 state.
> Regenerate clean with all 6 members.

**Date mode:** Consecutive 5 days. The algorithm slides a 5-day window across all
19 Olympic days (Jul 12–30) and scores each window.

**Key verification:**

- Windows that include days where members have high-scoring sessions should rank higher
- Since most session interests are on Jul 16–19, windows starting Jul 15–16 should score highest
- The top 3 windows should be displayed in the Group Schedule sidebar

**Window with highest expected score:** Jul 16–20 or Jul 15–19 (contains the bulk of all members' sessions)

**Verify in Group Schedule:**

- [ ] Top windows section shows ranked windows (up to the total number of valid windows)
- [ ] Clicking a window highlights those days on the calendar
- [ ] Active window days have light blue background
- [ ] Windows sorted by: score desc → stdev asc → resilience desc → earlier start date
- [ ] Score tooltip: "Scores reflect how well each window matches the group's combined session preferences..."
- [ ] Windows with days outside members' session dates have lower scores (fewer primary combo scores to sum)

- [ ] **Tested:** Phase A8: Window Ranking Verification

---

## Phase A9: Locked Session Injection (Session Not in Preferences)

This tests that a purchased session NOT in the member's sport rankings
gets injected into their candidates with `interest = "high"`.

**Setup:**

1. **User 4:** Has Beach Volleyball (#1) and 3x3 Basketball (#2) as ranked sports.
2. **User 1 (or another user with timeslot):** Record a purchase for session ATH05 (Athletics, Jul 17)
   - Assignee: User 4 (Dana)
   - Price: $100.00
3. ATH05 is an Athletics session. User 4 does NOT have Athletics in sport rankings.
4. Regenerate

**Expected for User 4 on Jul 17:**

- ATH05 becomes locked for User 4 (they are an assignee via `ticketPurchaseAssignee`)
- ATH05 is NOT in User 4's `session_preference` rows → **injected** into candidates with `interest = "high"`
- Scoring: `calculateSessionScore` looks up Athletics in User 4's `sportRankings`. Not found → `rank = sportRankings.length` = 2. `totalSports = 2`. Multiplier = `2.0 - ((2-1)/(2-1))` = **1.0**. Score = 1.0 × 1.0 (high) = **1.0**.
- If VBV07 is also still locked (from Phase A5): both locked sessions must appear.
  ATH05 (Expo, 09:00–14:00) and VBV07 (LB, 09:00–12:00) overlap.
  Both locked → locked-only combo, travel feasibility ignored.
  **P=[ATH05, VBV07] score = 1.0 + 2.0 = 3.0.** No B1, no B2.

**Verify:**

- [ ] User 4's schedule shows ATH05 despite Athletics not being in their sport rankings
- [ ] ATH05 shows purchased/locked indicator in session detail
- [ ] Both ATH05 and VBV07 appear in same combo despite overlapping times in different zones
- [ ] No travel feasibility warning (locked-only combos don't show travel warnings)

### A9.1 — Another Member's Purchase Does NOT Appear On Your Schedule

This verifies that just because someone bought tickets for a session doesn't mean
it appears on other members' schedules.

1. **User 1:** Record purchase for DIV02 (Diving, Jul 17, Pasadena)
   - Assignee: User 1 (self only)
2. Regenerate
3. **Verify for User 1:** DIV02 is locked → appears on User 1's schedule (injected if not in prefs). User 1 does NOT have DIV02 in preferences but has a purchase → injected with interest=high.
4. **Verify for User 3 (Casey):** DIV02 does NOT appear on User 3's schedule — User 3 never expressed interest in DIV02. Another member's purchase has zero effect on your schedule.
5. **Verify for User 2:** DIV02 IS in User 2's preferences → it appears on User 2's schedule based on User 2's own interest level, not because of User 1's purchase.

- [ ] **Tested:** Phase A9: Locked Session Injection (Session Not in Preferences)

---

## Phase A10: Excluded Sessions Deep Verification

**After any regeneration with sold-out/OOB sessions, verify the Purchase Tracker's
Excluded Sessions section in detail.**

### A10.1 — Excluded Session Data Structure

After Phase A5.2 regeneration (VBV08 sold out):

**User 4 Excluded Sessions in Purchase Tracker:**

- VBV08: `wasSoldOut=true`, `wasOutOfBudget=false` (stored snapshot from generation)
- VBV08: `isSoldOut=true`, `isOutOfBudget=false` (current DB state)
- Can "Unmark Sold Out" → calls `unmarkSoldOut`, VBV08 removed from `soldOutSession` table

**User 5 Excluded Sessions in Purchase Tracker:**

- Same as User 4 for VBV08

**User 1, 2, 3, 6:** VBV08 NOT in excluded list (was not in their preferences)

### A10.2 — Excluded Session State Divergence

1. After generation, unmark VBV08 as sold out (without regenerating)
2. **Verify in Purchase Tracker:** VBV08 still appears in excluded list BUT:
   - `wasSoldOut=true` (at generation time) — badge still shows
   - `isSoldOut=false` (current state) — "Unmark" button gone, "Re-mark" button appears
3. This divergence is expected: the stored snapshot preserves the state at generation time while the current state reflects changes since then.

### A10.3 — Sessions On Schedule Never Appear As Excluded

1. Mark a session that IS in User 4's current schedule (e.g., VBV07) as sold out
2. **Verify:** VBV07 does NOT appear in User 4's Excluded Sessions list
   (sessions already on the member's schedule are filtered out even if currently sold-out)
3. However, on next regeneration VBV07 would stay because User 4 has a purchase (locked)

- [ ] **Tested:** Phase A10: Excluded Sessions Deep Verification

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

- [ ] **Tested:** Phase C1: Setup

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

### Expected Algorithm Output

Since all 12 members have identical preferences and no buddy constraints,
every member should get identical schedules (no soft buddy bonuses since
no one has soft buddies).

**Jul 17 example (all members identical):**

| Session | SportMult | InterestAdj | Score |
| ------- | --------- | ----------- | ----- |
| VBV07   | 2.0       | 1.0 (high)  | 2.0   |
| VBV08   | 2.0       | 0.7 (med)   | 1.4   |
| ATH05   | 1.0       | 0.4 (low)   | 0.4   |

Travel: VBV07 (LB, end 12:00) and ATH05 (Expo, start 09:00): overlap (ATH05 runs 09:00–14:00 during VBV07's 09:00–12:00) → NOT feasible.
VBV07 (LB, end 12:00) → VBV08 (LB, start 14:00): same zone, gap = 120 ≥ 90 → feasible.
ATH05 (Expo, end 14:00) → VBV08 (LB, start 14:00): gap = 0 min, need 150 min (Expo Park → Long Beach: 33.33, < 45) → NOT feasible.

Feasible combos:

1. [VBV07, VBV08]: 3.4
2. [VBV07]: 2.0
3. [VBV08]: 1.4
4. [ATH05]: 0.4

All 12 members: P=[VBV07, VBV08] score=3.4, B1=[ATH05] (not in P) score=0.4, no B2.

**Verify:**

- [ ] All 12 members have identical schedules
- [ ] Group Schedule shows all 12 members attending same sessions
- [ ] No convergence issues (no buddy constraints)

- [ ] **Tested:** Phase C2: Simple Preferences (All 12 Members)

## Phase C3: MinBuddies Stress Test

1. **User 1:** Update buddies → set minBuddies=11 (all other members)
2. Regenerate
3. **Expected:** Since all 12 members are interested in the same sessions, interest count for each session = 12. count−1=11 ≥ 11 ✓. Constraint satisfied.
4. **Verify:** User 1's schedule unchanged (all sessions have enough interest).

### C3.1 — MinBuddies Exceeds Possible

1. **User 12:** Update preferences → remove VBV08 interest (keep only VBV07, VBV10, ATH03, ATH05)
2. **User 1:** Set minBuddies=11
3. Regenerate
4. **Expected for User 1 on Jul 17:** VBV08 now has 11 interested members. count−1=10 < 11 → VBV08 filtered out for User 1. User 1 left with only VBV07 on Jul 17.
5. **Verify:** User 1 Jul 17 Primary = [VBV07] only.

- [ ] **Tested:** Phase C3: MinBuddies Stress Test

## Phase C4: Member Removal at Capacity

1. **User 1:** Remove User 12
2. **Verify:** Group now has 11 members
3. **Create User 13** and join with invite code
4. **User 1:** Approve User 13
5. **Verify:** Group back to 12 members
6. **Create User 14** and attempt to join
7. **Verify:** "This group is full" error

- [ ] **Tested:** Phase C4: Member Removal at Capacity

## Phase C5: User Group Limit Test

This tests the per-user limit of 10 groups:

1. User 13 creates 9 additional groups (now in 10 groups including "Full House")
2. User 13 attempts to create an 11th group
3. **Verify:** "You can be in at most 10 groups"
4. User 13 attempts to join another existing group
5. **Verify:** "You can be in at most 10 groups"

- [ ] **Tested:** Phase C5: User Group Limit Test

---

# Cross-Group Scenarios

These scenarios use the groups created above to test interactions.

## Scenario X1: Dirty State Guard (In-App Navigation)

1. **In Group A, as User 3:** Go to Preferences → Step 1 (Sport Rankings)
2. Add a new sport (e.g., Boxing) but DO NOT save
3. Click on Overview tab in sidebar
4. **Verify:** Modal appears: "You have unsaved changes in Sport Rankings. Are you sure you want to leave? Your changes will be lost."
5. Click "Stay" → remain on preferences page
6. Click Overview tab again → modal again → click "Discard & Leave"
7. **Verify:** Navigated to overview, sport rankings unchanged (Boxing not added)

- [ ] **Tested:** Scenario X1: Dirty State Guard (In-App Navigation)

## Scenario X2: Browser Navigation Guard

1. **In Group A, as User 2:** Go to Preferences → Step 0 (Buddies)
2. Change minBuddies value but DO NOT save
3. Press browser back button
4. **Verify:** In-app modal appears (Navigation API intercept for "traverse" navigations)
5. Click "Stay" → remain on page, changes preserved
6. Try to close the browser tab
7. **Verify:** Native `beforeunload` prompt appears ("Changes you made may not be saved")

- [ ] **Tested:** Scenario X2: Browser Navigation Guard

## Scenario X3: Concurrent Approve/Deny (Two Browser Tabs)

> This tests race condition guards. Requires two browser tabs logged in as User 1.

1. Create a new user, have them join Group A with invite code (pending state)
2. Open Group A overview in **Tab 1** and **Tab 2** (both logged in as User 1)
3. Both tabs show the pending member
4. In Tab 1: click "Approve"
5. Quickly in Tab 2: click "Deny" (before Tab 2 refreshes)
6. **Expected:** One operation succeeds. The other's UPDATE matches 0 rows (WHERE includes `status = 'pending_approval'` guard — the status already changed). The second tab returns success (idempotent no-op).
7. **Verify:** Refresh both tabs — member is in the state from whichever operation committed first

- [ ] **Tested:** Scenario X3: Concurrent Approve/Deny (Two Browser Tabs)

## Scenario X4: Generation During Preference Edit

> This is more practically testable than transfer/leave races.

1. **User 3:** Open Preferences page, start editing Step 1 (add a sport, don't save)
2. **User 1 (in another tab):** Start generating schedules
3. Generation runs (may take seconds)
4. **User 3:** Save their preferences during or after generation
5. **Expected:** If User 3 saves DURING generation, their `statusChangedAt` > `scheduleGeneratedAt` (generation timestamp was captured BEFORE algorithm started). The notification system correctly detects this as a post-generation preference update.
6. **Verify:** After generation completes, notification shows "Casey Gymnast has updated their preferences"

- [ ] **Tested:** Scenario X4: Generation During Preference Edit

## Scenario X5: Inactivity Timeout

> Requires waiting 30 minutes. Can be tested by temporarily shortening the timeout constant during development, or by testing at end of session.

1. Login as any user
2. Leave browser idle for 30+ minutes (no mouse/keyboard/scroll/touch)
3. Move mouse or perform any action
4. **Verify:** `InactivityGuard` component fires logout; user redirected to `/login`
5. Attempting to navigate to any `/(main)/*` route → redirected to `/login`

- [ ] **Tested:** Scenario X5: Inactivity Timeout

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

- [ ] **Tested:** Scenario AUTH9: Reset Password — Expired / Missing Cookie

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

**Group side-effects to verify (login as User 1):** 13. Open Group A overview 14. **Verify:** Casey Gymnast no longer appears in the member list 15. **Verify:** Member count decreased by 1 16. If Group A was in `schedule_review` phase (schedules had been generated): - **Verify:** Phase regressed to "Entering Preferences" - **Verify:** All previously generated schedules are gone (combos/window rankings deleted) - **Verify:** Departed members notification shows "Casey Gymnast" with departure timestamp - **Verify:** User 1 (Alex) sees affected-buddy notification (Alex had Casey as a soft buddy) - **Verify:** Remaining members with status "preferences_set" retain that status (ready to regenerate) 17. If Group A was in `preferences` phase: - **Verify:** Phase remains "Entering Preferences" - **Verify:** User 1 (Alex) sees affected-buddy notification (Casey was their soft buddy) 18. In either phase: - **Verify:** Casey's buddy constraints are removed (no one lists Casey as a buddy anymore) - **Verify:** Casey's session preferences are deleted

- [ ] **Tested:** Scenario DEL2: Account Deletion — Successful (Non-Owner Member)

## Scenario DEL3: Account Deletion — User in Multiple Groups

> Tests that departure tracking fires for EACH group membership.

1. Create a new user (`multigroupuser`)
2. Have them join Group A and Group B (or any two groups, as a non-owner member)
3. Approve their join requests
4. Navigate to `/profile` and delete the account (enter correct password)
5. **Verify:** Redirected to `/login`
6. **Verify (Group A):** `multigroupuser` removed from member list, appropriate departure side-effects
7. **Verify (Group B):** `multigroupuser` removed from member list, appropriate departure side-effects

- [ ] **Tested:** Scenario DEL3: Account Deletion — User in Multiple Groups

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

- [ ] **Tested:** Scenario DEL4: Account Deletion — Owner Transfers Then Deletes

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
10. **Cross-group scenarios** X1–X5 — dirty state guards, browser guards, concurrency
11. **Profile scenarios** PROF1–PROF3 — field updates, password change, avatar color
12. **Account deletion** DEL1–DEL4 — owner block, successful deletion, multi-group, transfer+delete
13. **Auth edge cases** AUTH6–AUTH9 — deleted-user login, forgot/reset password flows

## Key Algorithm Checks (Must-Verify)

- [ ] Group B Jul 22: P=[SWM01, SWM02], B1=[SWM01, DIV12], B2=[DIV11, SWM02]
- [ ] Group B Jul 23: P=[SWM03, SWM04], **no B1, no B2** (both sessions in P, no alternative combos)
- [ ] Group B Jul 22: DIV12+SWM02 NOT in same combo (75 min gap < 150 min required)
- [ ] Group A Jul 17 User 1: GAR08 filtered out by hard buddy constraint (User 2 doesn't have GAR08)
- [ ] Group A Jul 17 User 4: BK304 filtered out by hard buddy constraint (User 5 doesn't have BK304)
- [ ] Group A Jul 17 User 2: ATH05+DIV03 NOT in same combo (90 min gap < 120 min Expo→Pasadena)
- [ ] Group A Jul 17 User 6: DIV02+BK304 feasible (exactly 120 min gap = 120 min Pasadena→Valley)
- [ ] Group A Jul 17 User 5: DIV02+VBV08 NOT feasible (Pasadena→LB needs 180 min, only 120 available)
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

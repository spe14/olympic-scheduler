# Stress Test Scenario — Algorithm Timeout Boundary Testing

**Purpose:** Verify that the schedule generation algorithm completes within the
5-minute timeout under the absolute worst-case load: 12 members (max), 10 ranked
sports (max), every session marked High interest. This produces up to **31
candidate sessions per member per day** and ~5,000 subset evaluations per
member per day.

> **Source of truth:** All session data comes from `scripts/output/la2028_sessions.csv`.
> Expected output was computed by running the actual algorithm in
> `tests/algorithm/stress-test.test.ts`. The test completed in **688 ms**.

---

## Group Configuration

| Field            | Value                |
| ---------------- | -------------------- |
| Group Name       | Stress Test Olympics |
| Owner            | Alex (User 1)        |
| Date Mode        | Consecutive Days     |
| Consecutive Days | 19                   |
| Members          | 12                   |

## Account Setup

Users 1–6 already exist from Group A. Create 6 new accounts (Users 7–12):

| User    | First Name | Last Name | Username        | Avatar Color |
| ------- | ---------- | --------- | --------------- | ------------ |
| User 1  | Alex       | Owner     | `alexowner`     | Blue         |
| User 2  | Blake      | Runner    | `blakerunner`   | Green        |
| User 3  | Casey      | Gymnast   | `caseygymnast`  | Pink         |
| User 4  | Dana       | Beacher   | `danabeacher`   | Orange       |
| User 5  | Ellis      | Diver     | `ellisdiver`    | Purple       |
| User 6  | Frankie    | Allround  | `frankieall`    | Teal         |
| User 7  | Gale       | Sprinter  | `galesprinter`  | Yellow       |
| User 8  | Harper     | Striker   | `harperstriker` | Red          |
| User 9  | Indigo     | Ace       | `indigoace`     | Blue         |
| User 10 | Jordan     | Rally     | `jordanrally`   | Green        |
| User 11 | Kendall    | Dash      | `kendalldash`   | Pink         |
| User 12 | Logan      | Keeper    | `logankeeper`   | Orange       |

Alex creates group, shares invite code. All others join and are approved.

---

## Preferences — All 12 Members Identical

Every member enters the **exact same** preferences. No buddy constraints.

### Buddies (all members)

| Setting     | Value |
| ----------- | ----- |
| Min Buddies | 0     |
| Buddy Tags  | none  |

### Sport Rankings (all members)

| Rank | Sport            | Multiplier (with 10 sports) |
| ---- | ---------------- | --------------------------- |
| 1    | Tennis           | 2.0000                      |
| 2    | Volleyball       | 1.8889                      |
| 3    | Handball         | 1.7778                      |
| 4    | Beach Volleyball | 1.6667                      |
| 5    | Basketball       | 1.5556                      |
| 6    | Table Tennis     | 1.4444                      |
| 7    | Badminton        | 1.3333                      |
| 8    | 3x3 Basketball   | 1.2222                      |
| 9    | Water Polo       | 1.1111                      |
| 10   | Hockey           | 1.0000                      |

Formula: `sportMultiplier = 2.0 − (rank − 1) / 9`

### Session Interests (all members) — 366 sessions, all High

Each member marks interest in **every session** of the 10 ranked sports.
Enter all as **High** interest.

**Tennis** — 41 sessions (Carson Zone):

TEN01 High, TEN02 High, TEN03 High, TEN04 High, TEN05 High,
TEN06 High, TEN07 High, TEN08 High, TEN09 High, TEN10 High,
TEN11 High, TEN12 High, TEN13 High, TEN14 High, TEN15 High,
TEN16 High, TEN17 High, TEN18 High, TEN19 High, TEN20 High,
TEN21 High, TEN22 High, TEN23 High, TEN24 High, TEN25 High,
TEN26 High, TEN27 High, TEN28 High, TEN29 High, TEN30 High,
TEN31 High, TEN32 High, TEN33 High, TEN34 High, TEN35 High,
TEN36 High, TEN37 High, TEN38 High, TEN39 High, TEN40 High,
TEN41 High

**Volleyball** — 52 sessions (Anaheim Zone):

VVO01 High, VVO02 High, VVO03 High, VVO04 High, VVO05 High,
VVO06 High, VVO07 High, VVO08 High, VVO09 High, VVO10 High,
VVO11 High, VVO12 High, VVO13 High, VVO14 High, VVO15 High,
VVO16 High, VVO17 High, VVO18 High, VVO19 High, VVO20 High,
VVO21 High, VVO22 High, VVO23 High, VVO24 High, VVO25 High,
VVO26 High, VVO27 High, VVO28 High, VVO29 High, VVO30 High,
VVO31 High, VVO32 High, VVO33 High, VVO34 High, VVO35 High,
VVO36 High, VVO37 High, VVO38 High, VVO39 High, VVO40 High,
VVO41 High, VVO42 High, VVO43 High, VVO44 High, VVO45 High,
VVO46 High, VVO47 High, VVO48 High, VVO49 High, VVO50 High,
VVO51 High, VVO52 High

**Handball** — 46 sessions (Long Beach Zone):

HBL01 High, HBL02 High, HBL03 High, HBL04 High, HBL05 High,
HBL06 High, HBL07 High, HBL08 High, HBL09 High, HBL10 High,
HBL11 High, HBL12 High, HBL13 High, HBL14 High, HBL15 High,
HBL16 High, HBL17 High, HBL18 High, HBL19 High, HBL20 High,
HBL21 High, HBL22 High, HBL23 High, HBL24 High, HBL25 High,
HBL26 High, HBL27 High, HBL28 High, HBL29 High, HBL30 High,
HBL31 High, HBL32 High, HBL33 High, HBL34 High, HBL35 High,
HBL36 High, HBL37 High, HBL38 High, HBL39 High, HBL40 High,
HBL41 High, HBL42 High, HBL43 High, HBL44 High, HBL45 High,
HBL46 High

**Beach Volleyball** — 39 sessions (Long Beach Zone):

VBV01 High, VBV02 High, VBV03 High, VBV04 High, VBV05 High,
VBV06 High, VBV07 High, VBV08 High, VBV09 High, VBV10 High,
VBV11 High, VBV12 High, VBV13 High, VBV14 High, VBV15 High,
VBV16 High, VBV17 High, VBV18 High, VBV19 High, VBV20 High,
VBV21 High, VBV22 High, VBV23 High, VBV24 High, VBV25 High,
VBV26 High, VBV27 High, VBV28 High, VBV29 High, VBV30 High,
VBV31 High, VBV32 High, VBV33 High, VBV34 High, VBV35 High,
VBV36 High, VBV37 High, VBV38 High, VBV39 High

**Basketball** — 43 sessions (Inglewood Zone):

BKB01 High, BKB02 High, BKB03 High, BKB04 High, BKB05 High,
BKB06 High, BKB07 High, BKB08 High, BKB09 High, BKB10 High,
BKB11 High, BKB12 High, BKB13 High, BKB14 High, BKB15 High,
BKB16 High, BKB17 High, BKB18 High, BKB19 High, BKB20 High,
BKB21 High, BKB22 High, BKB23 High, BKB24 High, BKB25 High,
BKB26 High, BKB27 High, BKB28 High, BKB29 High, BKB30 High,
BKB31 High, BKB32 High, BKB33 High, BKB34 High, BKB35 High,
BKB36 High, BKB37 High, BKB38 High, BKB39 High, BKB40 High,
BKB41 High, BKB42 High, BKB43 High

**Table Tennis** — 37 sessions (DTLA Zone):

TTE01 High, TTE02 High, TTE03 High, TTE04 High, TTE05 High,
TTE06 High, TTE07 High, TTE08 High, TTE09 High, TTE10 High,
TTE11 High, TTE12 High, TTE13 High, TTE14 High, TTE15 High,
TTE16 High, TTE17 High, TTE18 High, TTE19 High, TTE20 High,
TTE21 High, TTE22 High, TTE23 High, TTE24 High, TTE25 High,
TTE26 High, TTE27 High, TTE28 High, TTE29 High, TTE30 High,
TTE31 High, TTE32 High, TTE33 High, TTE34 High, TTE35 High,
TTE36 High, TTE37 High

**Badminton** — 26 sessions (Exposition Park Zone):

BDM01 High, BDM02 High, BDM03 High, BDM04 High, BDM05 High,
BDM06 High, BDM07 High, BDM08 High, BDM09 High, BDM10 High,
BDM11 High, BDM12 High, BDM13 High, BDM14 High, BDM15 High,
BDM16 High, BDM17 High, BDM18 High, BDM19 High, BDM20 High,
BDM21 High, BDM22 High, BDM23 High, BDM24 High, BDM25 High,
BDM26 High

**3x3 Basketball** — 20 sessions (Valley Zone):

BK301 High, BK302 High, BK303 High, BK304 High, BK305 High,
BK306 High, BK307 High, BK308 High, BK309 High, BK310 High,
BK311 High, BK312 High, BK313 High, BK314 High, BK315 High,
BK316 High, BK317 High, BK318 High, BK319 High, BK320 High

**Water Polo** — 28 sessions (Long Beach Zone):

WPO01 High, WPO02 High, WPO03 High, WPO04 High, WPO05 High,
WPO06 High, WPO07 High, WPO08 High, WPO09 High, WPO10 High,
WPO11 High, WPO12 High, WPO13 High, WPO14 High, WPO15 High,
WPO16 High, WPO17 High, WPO18 High, WPO19 High, WPO20 High,
WPO21 High, WPO22 High, WPO23 High, WPO24 High, WPO25 High,
WPO26 High, WPO27 High, WPO28 High

**Hockey** — 34 sessions (Carson Zone):

HOC01 High, HOC02 High, HOC03 High, HOC04 High, HOC05 High,
HOC06 High, HOC07 High, HOC08 High, HOC09 High, HOC10 High,
HOC11 High, HOC12 High, HOC13 High, HOC14 High, HOC15 High,
HOC16 High, HOC17 High, HOC18 High, HOC19 High, HOC20 High,
HOC21 High, HOC22 High, HOC23 High, HOC24 High, HOC25 High,
HOC26 High, HOC27 High, HOC28 High, HOC29 High, HOC30 High,
HOC31 High, HOC32 High, HOC33 High, HOC34 High

---

## Sessions Per Day (After Entry)

No filtering occurs (no buddy constraints, minBuddies = 0). Every member has
these session counts on each day:

| Day    | Sessions | Day    | Sessions | Day    | Sessions |
| ------ | -------- | ------ | -------- | ------ | -------- |
| Jul 12 | 11       | Jul 18 | 27       | Jul 24 | 25       |
| Jul 13 | 11       | Jul 19 | **31**   | Jul 25 | 19       |
| Jul 15 | 24       | Jul 20 | **31**   | Jul 26 | 14       |
| Jul 16 | 27       | Jul 21 | 30       | Jul 27 | 14       |
| Jul 17 | 27       | Jul 22 | 26       | Jul 28 | 11       |
|        |          | Jul 23 | 27       | Jul 29 | 9        |
|        |          |        |          | Jul 30 | 2        |

Peak days are **Jul 19 and Jul 20** with 31 sessions each (4,991 subsets per
member per day).

---

## Expected Output — All 12 Members Identical

Since all members have identical preferences and no buddy constraints, every
member sees the **exact same** schedule. Verify any one member's schedule and
confirm all others match.

### Algorithm Behavior

| Metric                 | Expected    |
| ---------------------- | ----------- |
| Converged              | Yes         |
| Iterations             | 1           |
| Violations             | 0           |
| Timed out              | No          |
| Members with no combos | 0           |
| Execution time         | < 5 seconds |

### Schedule — Every Member, Every Day

| Day    | Primary             | P Score | Backup 1            | B1 Score | Backup 2            | B2 Score |
| ------ | ------------------- | ------- | ------------------- | -------- | ------------------- | -------- |
| Jul 12 | HBL01, HBL02, HBL03 | 5.3333  | BKB03, HBL01, HBL02 | 5.1111   | BKB02, BKB03, HBL01 | 4.8889   |
| Jul 13 | HBL04, HBL05, HBL06 | 5.3333  | BKB06, HBL04, HBL05 | 5.1111   | BKB05, BKB06, HBL04 | 4.8889   |
| Jul 15 | VVO01, VVO02, VVO03 | 5.6667  | VVO01, VVO02, VVO04 | 5.6667   | VVO01, VVO03, VVO04 | 5.6667   |
| Jul 16 | VVO05, VVO06, VVO07 | 5.6667  | VVO05, VVO06, VVO08 | 5.6667   | VVO05, VVO07, VVO08 | 5.6667   |
| Jul 17 | VVO09, VVO10, VVO11 | 5.6667  | VVO09, VVO10, VVO12 | 5.6667   | VVO09, VVO11, VVO12 | 5.6667   |
| Jul 18 | VVO13, VVO14, VVO15 | 5.6667  | VVO13, VVO14, VVO16 | 5.6667   | VVO13, VVO15, VVO16 | 5.6667   |
| Jul 19 | TEN04, VVO17, VVO18 | 5.7778  | TEN05, VVO17, VVO18 | 5.7778   | VVO17, VVO18, VVO19 | 5.6667   |
| Jul 20 | TEN10, VVO21, VVO22 | 5.7778  | VVO21, VVO22, VVO23 | 5.6667   | VVO21, VVO22, VVO24 | 5.6667   |
| Jul 21 | TEN15, VVO25, VVO26 | 5.7778  | VVO25, VVO26, VVO27 | 5.6667   | VVO25, VVO26, VVO28 | 5.6667   |
| Jul 22 | TEN20, VVO29, VVO30 | 5.7778  | VVO29, VVO30, VVO31 | 5.6667   | VVO29, VVO30, VVO32 | 5.6667   |
| Jul 23 | TEN25, VVO33, VVO34 | 5.7778  | HBL31, TEN25, VVO34 | 5.6667   | VVO33, VVO34, VVO35 | 5.6667   |
| Jul 24 | TEN30, VVO37, VVO38 | 5.7778  | HBL35, TEN30, VVO38 | 5.6667   | VVO37, VVO38, VVO39 | 5.6667   |
| Jul 25 | TEN35, VVO41, VVO42 | 5.7778  | VVO41, VVO42, VVO43 | 5.6667   | VVO41, VVO42, VVO44 | 5.6667   |
| Jul 26 | HBL41, HBL42, TEN37 | 5.5556  | VBV34, HBL41, TEN37 | 5.4444   | BKB37, VVO45, VVO46 | 5.3333   |
| Jul 27 | HBL43, HBL44, TEN39 | 5.5556  | VBV36, HBL43, TEN39 | 5.4444   | BKB39, VVO47, VVO48 | 5.3333   |
| Jul 28 | HBL45, HBL46, TEN41 | 5.5556  | HBL45, HBL46, VVO49 | 5.4444   | VBV38, HBL45, VVO49 | 5.3333   |
| Jul 29 | TTE37, VVO50, VVO51 | 5.2222  | HOC34, VVO50, VVO51 | 4.7778   | BKB42, HOC34, VVO50 | 4.4444   |
| Jul 30 | VVO52               | 1.8889  | BKB43               | 1.5556   | —                   | —        |

### Why These Combos Win

**Jul 12–13 (no Tennis, no Volleyball):** Handball (rank 3, Long Beach) is the
highest-scoring sport with sessions on these days. 3 Handball sessions fit in
one day (gaps of 90 min, same zone). B1/B2 mix in Basketball (Inglewood) which
can pair with Handball after a Long Beach→Inglewood gap.

**Jul 15–18 (no Tennis):** Volleyball (rank 2, Anaheim) is the top sport.
4 sessions per day with exact 90-min gaps between them (09:00–11:30, 13:00–15:30,
17:00–19:30, 21:00–23:30). Pick any 3 of 4 → score 5.6667.
All combos tied because same sport, same zone, same interest.

**Jul 19–25 (Tennis available):** Tennis (rank 1, 2.0) + 2 Volleyball (rank 2,
1.8889 each) = 5.7778. Tennis has overlapping sessions (multiple courts), so
only 1 Tennis session fits per combo. The evening Tennis session pairs with
morning + afternoon Volleyball. B1 uses a different Tennis session or drops
to 3 Volleyball.

**Jul 26–28 (fewer Volleyball):** Volleyball drops to 2/day. Handball (rank 3)
fills the third slot. Tennis evening + 2 Handball morning/afternoon = 5.5556.

**Jul 29 (slim pickings):** No Tennis, Handball, or Beach Volleyball. Table
Tennis (rank 6) + 2 Volleyball = 5.2222.

**Jul 30 (final day):** Only 2 sessions total — VVO52 and BKB43.

### Window Ranking

With Consecutive Days = 19, there is exactly **one** possible window:

| Window                      | Score     |
| --------------------------- | --------- |
| Jul 12, 2028 – Jul 30, 2028 | 1170.6667 |

Score = 12 members × sum of all daily primary scores. No fairness penalty
(stdev = 0 since all members score identically).

The Group Schedule sidebar should show: **"Jul 12 – Jul 30"** with score
**1170.67** (rounded).

---

## Verification Checklist

### Timing & Convergence

- [ ] Schedule generation completes (no timeout spinner lasting > 30 seconds)
- [ ] No "timed out" warning displayed
- [ ] No non-convergence/amber warning displayed

### Schedule Correctness (check any one member)

- [ ] Jul 12: P=[HBL01, HBL02, HBL03] score≈5.33
- [ ] Jul 15: P=[VVO01, VVO02, VVO03] score≈5.67
- [ ] Jul 19: P=[TEN04, VVO17, VVO18] score≈5.78 (peak day — 31 sessions)
- [ ] Jul 20: P=[TEN10, VVO21, VVO22] score≈5.78 (peak day — 31 sessions)
- [ ] Jul 26: P=[HBL41, HBL42, TEN37] score≈5.56
- [ ] Jul 29: P=[TTE37, VVO50, VVO51] score≈5.22
- [ ] Jul 30: P=[VVO52] score≈1.89 (single session day)
- [ ] Every member has a primary combo on all 18 active days
- [ ] Jul 14 has no combos (no sessions exist on that date)

### All Members Identical

- [ ] Pick any 2 members → their schedules are identical on every day
- [ ] All member day scores match across the group

### Group Schedule

- [ ] Window shows "Jul 12 – Jul 30"
- [ ] Window score ≈ 1170.67

---

## Programmatic Verification

Run the test to verify all expected output programmatically:

```bash
npx vitest run tests/algorithm/stress-test.test.ts
```

The test reads the real CSV data, constructs 12 identical members with the
10 sports above, runs the algorithm, and asserts:

- Completes in < 60 seconds
- Converges in 1 iteration
- No timeout
- No members with no combos
- All 12 members produce identical combos

Results are written to `tests/algorithm/stress-test-output.txt`.

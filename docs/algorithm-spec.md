# LA 2028 Olympics Group Scheduler - Phase 1: Schedule Optimization

## Overview

Phase 1 generates an **optimal** group schedule that maximizes everyone's experience while respecting travel constraints, buddy requirements, and willingness to pay. The output is a set of prioritized session combinations that the group can use to coordinate their Olympics attendance.

---

## Algorithm Flow Overview

1. **Group Creation & Preference Input**
   - Group owner creates group (optionally sets date config at creation or defers)
   - Members request to join, owner approves — members begin entering preferences immediately
   - Step 1: Set budget and buddy constraints
   - Step 2: Select and rank sports (up to 10)
   - Step 3: Select sessions from those sports

2. **Schedule Generation** (owner triggers after ALL members complete preferences; date config required)
   - Step 4: Filter sessions by interest
   - Step 5: Apply buddy + travel constraints, generate combos
   - Step 6: Score combos, assign primary + backups
   - Step 7: Compute viable configurations

3. **Review & Resolution**
   - Step 8: Schedule review (satisfaction check)
   - Step 9: Conflict resolution

4. **Completion**
   - All members confirm → group moves to completed
   - Window rankings computed from finalized combo scores
   - Group selects a window

---

## Inputs

### User Data

For each user in the group:

| Field     | Description       | Example |
| --------- | ----------------- | ------- |
| `user_id` | Unique identifier | "alice" |

#### Step 1: Budget and Buddy Preferences

Users first set their budget and buddy preferences that apply across all sessions:

| Field          | Description                                               | Example           |
| -------------- | --------------------------------------------------------- | ----------------- |
| `budget`       | Total amount willing to spend across all sessions         | $500              |
| `hard_buddies` | MUST attend with these people (strict constraint)         | ["bob"]           |
| `soft_buddies` | PREFER to attend with these people (flexible, adds bonus) | ["carol", "dave"] |
| `min_buddies`  | Minimum others who must also attend each session          | 1                 |

**Constraint vs Preference:**

- `hard_buddies`: Constraint — session is invalid if ANY of these people aren't attending. Multiple hard buddies are allowed but increasingly restrictive.
- `soft_buddies`: Preference — adds bonus points if attending together, but not required
- `min_buddies`: Constraint — must have at least N other group members at each session

**Warning displayed on buddy preference page:** "Adding multiple hard buddies is very restrictive — you can only attend sessions where ALL your hard buddies are also interested. Consider using soft buddies for a more flexible schedule."

#### Step 2: Sport Selection and Ranking

Users select up to **10 sports** they want to attend and rank them in order of preference:

| Field            | Description                                 | Example                                                     |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------- |
| `sport_rankings` | Ordered list of sports (1 = most preferred) | ["Gymnastics", "Swimming", "Track", "Diving", "Basketball"] |

**Ordered Ranking:** Sports are ranked 1st through Nth (where N ≤ 10). This ranking determines the sport multiplier used in scoring.

```
Example - Alice's Sport Rankings:
  1. Gymnastics
  2. Swimming
  3. Track
  4. Diving
  5. Basketball
```

#### Step 3: Session-Level Preferences

After selecting sports, users see a calendar view showing only sessions from their selected sports. For each session they want to attend, they set both interest level AND willingness:

| Field                 | Description                     | Required           |
| --------------------- | ------------------------------- | ------------------ |
| `session_interest`    | Interest level for this session | Yes (if attending) |
| `session_willingness` | Price bucket for this session   | Yes (if attending) |

**Session Interest Levels:**

| Level  | Description                | Session Adjustment |
| ------ | -------------------------- | ------------------ |
| High   | Strongly want to attend    | 1.0x               |
| Medium | Would enjoy attending      | 0.7x               |
| Low    | Would attend if convenient | 0.4x               |
| None   | Not interested (default)   | Excluded           |

**Willingness Price Buckets:**

| Bucket | Description               |
| ------ | ------------------------- |
| <$50   | Budget-friendly only      |
| <$100  | Low price tolerance       |
| <$150  | Moderate price tolerance  |
| <$200  | Above average willingness |
| <$250  | Higher willingness        |
| <$300  | High willingness          |
| <$400  | Premium events            |
| <$500  | High-end events           |
| <$1000 | Top-tier events           |
| $1000+ | No limit                  |

**Important:** Sessions default to "None" (not interested). Users must explicitly opt-in to each session they want to attend by selecting both an interest level and a willingness bucket.

```
Example - Alice's Session Preferences for Track:
  - 100m Final: High interest, <$400 willingness
  - 200m Semi: Medium interest, <$150 willingness
  - Shot Put Final: Low interest, <$100 willingness
  - Marathon: None (not attending)
```

### Session Data

For each Olympic session:

| Field          | Description         | Example                 |
| -------------- | ------------------- | ----------------------- |
| `session_code` | Unique identifier   | "GYM-WFINAL-0803"       |
| `sport`        | Sport name          | "Gymnastics"            |
| `session_type` | Category of session | "Final", "Semi", "Heat" |
| `session_date` | Date of session     | "2028-08-03"            |
| `start_time`   | Start time          | "19:00"                 |
| `end_time`     | End time            | "21:30"                 |
| `zone`         | Venue zone          | "DTLA Zone"             |

### Travel Matrix

Zone-to-zone driving times (in minutes) used to determine required gaps between sessions:

```
                    DTLA    Long Beach    Inglewood    ...
DTLA                0       37            25
Long Beach          40      0             34
Inglewood           27      36            0
```

The driving time matrix is used to categorize zone proximity and determine required gaps. See Travel Gap Rules in Algorithm Steps for the gap lookup table.

---

## Scoring System

### Session Score (Individual User)

A user's score for a single session is calculated as:

```
session_score = sport_multiplier × session_adjustment × soft_buddy_bonus
```

#### Sport Multiplier

The sport multiplier is derived from the user's ordered sport ranking. It scales dynamically based on how many sports the user selected:

```
sport_multiplier = max - ((rank - 1) / (n - 1)) × (max - min)

where:
  max = 2.0 (top rank multiplier)
  min = 1.0 (bottom rank multiplier)
  n = number of sports selected
  rank = sport's position (1 to n)
```

**Edge case:** If user selects only 1 sport, multiplier = 2.0

**Example multipliers by number of sports selected:**

| Sports Selected | Rank 1 | Rank 2 | Rank 3 | Rank 4 | Rank 5 |
| --------------- | ------ | ------ | ------ | ------ | ------ |
| 2               | 2.0x   | 1.0x   | —      | —      | —      |
| 3               | 2.0x   | 1.5x   | 1.0x   | —      | —      |
| 5               | 2.0x   | 1.75x  | 1.5x   | 1.25x  | 1.0x   |

**Full table for 10 sports:**

| Rank | Multiplier |
| ---- | ---------- |
| 1    | 2.0x       |
| 2    | 1.89x      |
| 3    | 1.78x      |
| 4    | 1.67x      |
| 5    | 1.56x      |
| 6    | 1.44x      |
| 7    | 1.33x      |
| 8    | 1.22x      |
| 9    | 1.11x      |
| 10   | 1.0x       |

#### Session Adjustment

Based on the user's interest level for the specific session:

| Interest Level | Adjustment                  |
| -------------- | --------------------------- |
| High           | 1.0x                        |
| Medium         | 0.7x                        |
| Low            | 0.4x                        |
| None           | Excluded from consideration |

#### Soft Buddy Bonus

When soft buddies have indicated interest in the same session, a bonus multiplier is applied with diminishing returns:

```
soft_buddy_bonus = 1.0 + 0.25 (first buddy) + 0.10 × (additional buddies)
```

| Soft Buddies With Interest | Bonus Multiplier            |
| -------------------------- | --------------------------- |
| 0                          | 1.0x                        |
| 1                          | 1.25x                       |
| 2                          | 1.35x                       |
| 3                          | 1.45x                       |
| 4                          | 1.55x                       |
| 5                          | 1.65x                       |
| 6+                         | 1.65x + 0.10 per additional |

**Important:** The soft buddy bonus is based on which soft buddies have **indicated interest** in the session (interest level ≠ None), not who is confirmed to attend. This is because at combo generation time, we don't yet know everyone's final schedule — we only know their interests.

**Note:** No cap is applied. The diminishing returns formula naturally limits the impact, and large buddy bonuses on low-ranked sports still won't overtake high-ranked sports due to the sport multiplier differential.

#### Scoring Example

```
Setup:
  Alice ranks 5 sports: 1. Gymnastics, 2. Swimming, 3. Track, 4. Diving, 5. Basketball
  Alice selects Women's Gymnastics All-Around Final as High interest
  Alice has 2 soft buddies (Bob and Carol) who also indicated interest in this session

Calculation:
  sport_multiplier = 2.0 (Gymnastics is rank 1 of 5)
  session_adjustment = 1.0 (High interest)
  soft_buddy_bonus = 1.0 + 0.25 + 0.10 = 1.35 (2 soft buddies interested)

  session_score = 2.0 × 1.0 × 1.35 = 2.7
```

```
Comparison - Lower ranked sport with more buddies:
  Alice selects Basketball game as High interest
  Alice has 4 soft buddies who indicated interest in this session

Calculation:
  sport_multiplier = 1.0 (Basketball is rank 5 of 5)
  session_adjustment = 1.0 (High interest)
  soft_buddy_bonus = 1.0 + 0.25 + 0.10 + 0.10 + 0.10 = 1.55 (4 soft buddies interested)

  session_score = 1.0 × 1.0 × 1.55 = 1.55

Result: Gymnastics (2.7) still beats Basketball (1.55) despite fewer buddies,
because sport ranking provides strong baseline differentiation.
```

#### Scoring Formula Validation

The scoring formula is designed so that:

1. Sport ranking provides strong baseline differentiation
2. Interest level (High/Medium/Low) significantly affects score within a sport
3. Buddy preferences provide a bonus but don't override interest level within the same sport

**Scenario 1: Same sport, different interest levels**

Can a Low Interest session beat a High Interest session within the same sport?

```
Session A (High Interest, no buddies):
  sport_multiplier = 2.0
  session_adjustment = 1.0 (High)
  soft_buddy_bonus = 1.0
  Score: 2.0 × 1.0 × 1.0 = 2.0

Session B (Low Interest, maximum buddies):
  sport_multiplier = 2.0 (same sport)
  session_adjustment = 0.4 (Low)
  soft_buddy_bonus = ??? (need > 2.5 to beat Session A)

  For B to beat A: 2.0 × 0.4 × bonus > 2.0
  Required bonus: > 2.5
  This requires: 1.0 + 0.25 + 0.10×(n-1) > 2.5 → n > 13.5 buddies

Result: Within the same sport, Low Interest CANNOT beat High Interest
unless you have 14+ soft buddies (unrealistic for typical groups).
```

**Scenario 2: Different sports, different interest levels**

Can a Low Interest session from a high-ranked sport beat a High Interest session from a low-ranked sport?

```
Session A (High Interest, lowest ranked sport, no buddies):
  sport_multiplier = 1.0 (rank 10 of 10)
  session_adjustment = 1.0 (High)
  soft_buddy_bonus = 1.0
  Score: 1.0 × 1.0 × 1.0 = 1.0

Session B (Low Interest, highest ranked sport, 2 buddies):
  sport_multiplier = 2.0 (rank 1 of 10)
  session_adjustment = 0.4 (Low)
  soft_buddy_bonus = 1.35 (2 buddies)
  Score: 2.0 × 0.4 × 1.35 = 1.08

Result: Low Interest CAN beat High Interest when:
- The Low Interest session is from a much higher-ranked sport
- AND there are more buddies interested

This is intentional — if you ranked Gymnastics #1 and Basketball #10,
a Low Interest Gymnastics session with friends might reasonably beat
a High Interest Basketball session alone.
```

**Scenario 3: Buddy bonus impact within same sport and interest**

How much do buddies matter for same sport, same interest level?

```
Session A (High Interest, rank 1 sport, no buddies):
  Score: 2.0 × 1.0 × 1.0 = 2.0

Session B (High Interest, rank 1 sport, 3 buddies):
  Score: 2.0 × 1.0 × 1.45 = 2.9

Session C (High Interest, rank 1 sport, 6 buddies):
  Score: 2.0 × 1.0 × 1.75 = 3.5

Result: Buddies provide meaningful differentiation (up to 75% boost with 6 buddies)
but with diminishing returns. This encourages attending with friends without
making solo attendance unviable.
```

### Day Combo Score (Individual User)

Sum of session scores for all sessions in the combo:

```
day_combo_score = Σ session_scores
```

**Tie-Breaking:** If two combos have identical scores, prefer the combo with:

1. More sessions (fuller day is better)
2. If still tied, higher total sport multiplier (prioritize higher-ranked sports)
3. If still tied, alphabetical order by first session code (deterministic fallback)

### Window Score (Individual User)

Sum of primary day combo scores across all days in the window:

```
user_window_score = Σ day_combo_scores (for each day in window)
```

**Tie-Breaking:** If two windows have identical user scores:

1. More total sessions across the window (fuller schedule is better)
2. If still tied, earlier start date

### Group Window Score

The group score for a window balances total satisfaction with fairness:

```
group_score = total_satisfaction - (fairness_penalty × fairness_weight)

where:
  total_satisfaction = Σ user_window_scores
  fairness_penalty = standard_deviation(user_window_scores) × num_users
  fairness_weight = 0.25 (fixed)
```

**Why Standard Deviation?** We use standard deviation rather than variance because variance (the square of differences) produces penalties that can dominate the total score, leading to negative final scores for unequal distributions. Standard deviation provides a more proportionate penalty.

**Tie-Breaking:** If two windows have identical group scores:

1. Lower standard deviation (more fair distribution)
2. If still tied, earlier start date

```
Example:
  Window A: Alice=50, Bob=50, Carol=50, Dave=50 → total=200, stdev=0
  Window B: Alice=60, Bob=60, Carol=60, Dave=20 → total=200, stdev=20

  With fairness_weight=0.25:
    Window A penalty: 0 × 4 × 0.25 = 0
    Window A score: 200 - 0 = 200

    Window B penalty: 20 × 4 × 0.25 = 20
    Window B score: 200 - 20 = 180

  Window A wins despite equal total, because it's fairer.
```

### What Makes a Schedule "Optimal"?

A schedule is considered optimal when it maximizes the group window score, which means:

1. **High total satisfaction** - Users attend sessions they care about
2. **Fair distribution** - No single user is sacrificed for others (weighted by fairness setting)
3. **Buddy constraints satisfied** - Hard buddies attend together, soft buddies add bonuses
4. **Travel feasibility** - All day combos respect venue travel times

---

## Algorithm Steps

_Note: Steps 1-3 are user preference input (buddy constraints, sport ranking, session selection). The algorithm steps below run after ALL members have completed their preference input and the group owner triggers schedule generation._

### Step 4: Filter Sessions by User Interest

For each user, filter the full session list to only sessions they've explicitly selected (interest level ≠ None) and that are not excluded.

```
Input: All sessions, User's session preferences
Output: User's candidate sessions

Filter criteria:
  - session_preference row exists for this user + session
  - interest ≠ None
  - excluded = false

Example:
  Alice selected sessions in: Gymnastics, Swimming, Track
  Alice's candidates: 12 sessions she explicitly marked as High/Medium/Low interest (excluding any with excluded = true)
```

### Step 5: Apply Buddy Constraints, Travel Constraints, and Generate Combinations

For each user, for each day (all 19 Olympic days), generate all valid session combinations that respect buddy constraints AND travel constraints.

#### Hard Buddy Filtering

If User A has hard buddies, filter out sessions where ANY hard buddy has no interest:

- Check each of User A's candidate sessions
- For each hard buddy: if the hard buddy has no interest in a session (interest = None), that session is excluded from User A's candidates
- With multiple hard buddies, the candidate set is the INTERSECTION of all hard buddies' interests

```
Example:
  Alice has hard_buddies = [Bob]

  Alice's candidates (from Step 4):
    - Gymnastics Final: High
    - Swimming Semi: Medium
    - Diving Prelim: Low

  Bob's candidates (from Step 4):
    - Gymnastics Final: High
    - Diving Prelim: Medium
    - Water Polo: High

  Alice's candidates after hard buddy filter:
    - Gymnastics Final: ✓ (Bob is interested)
    - Swimming Semi: ✗ EXCLUDED (Bob not interested)
    - Diving Prelim: ✓ (Bob is interested)
```

**Note:** Hard buddy is one-directional. If Alice has hard_buddies=[Bob], Alice's sessions are filtered based on Bob's interests. But Bob can still attend sessions Alice isn't interested in. If both want to stay together, both should set hard_buddies pointing to each other.

#### Min Buddies Filtering

If User A has `min_buddies = N`, filter out sessions where fewer than N other users have interest:

- Check each of User A's candidate sessions
- Count how many OTHER users have interest in that session
- If count < min_buddies, that session is excluded from User A's candidates

```
Example:
  Carol has min_buddies = 2

  Carol's candidates (from Step 4):
    - Gymnastics Final: High
    - Diving Prelim: Medium
    - Archery Semi: Low

  Other users' interest:
    - Gymnastics Final: Alice (High), Bob (High), Eve (Medium) → 3 others interested
    - Diving Prelim: Bob (Medium) → 1 other interested
    - Archery Semi: None → 0 others interested

  Carol's candidates after min_buddies filter:
    - Gymnastics Final: ✓ (3 others ≥ 2)
    - Diving Prelim: ✗ EXCLUDED (1 other < 2)
    - Archery Semi: ✗ EXCLUDED (0 others < 2)
```

**Note:** This filtering is based on INTEREST, not willingness. Willingness-based min_buddies conflicts are handled in Step 9 (conflict resolution), where users can adjust willingness or override their constraint.

#### Travel Gap Rules

Required gaps between sessions are based on zone proximity, determined by driving time between zones. Gaps are set to accommodate both drivers and transit users during Olympic conditions, with buffer time for venue exit, security, and entry.

| Proximity      | Driving Time | Required Gap |
| -------------- | ------------ | ------------ |
| Same zone      | 0 min        | 1.0 hr       |
| Very close     | <15 min      | 1.5 hr       |
| Close          | 15-30 min    | 2.0 hr       |
| Medium         | 30-45 min    | 2.5 hr       |
| Far            | 45-60 min    | 3.0 hr       |
| Very far       | 60-90 min    | 3.5 hr       |
| Trestles Beach | Any          | 4.0 hr       |

**Note on Trestles Beach:** The surf venue is geographically isolated with transit times of 3-6 hours from most zones. Sessions at Trestles Beach should be planned as dedicated day trips rather than combined with other venues.

#### Combination Rules

- Maximum 3 sessions per day per user
- Sessions cannot overlap in time
- Gap between sessions must meet travel requirement based on zones
- Each combination is scored using the scoring system above

```
Input: User's candidate sessions for a day, Travel matrix
Output: List of valid combinations, ranked by score

Example - Alice's July 18:
  Combo 1: [Gymnastics 10am, Swimming 3pm, Track 7pm] - Score: 5.2
  Combo 2: [Gymnastics 10am, Swimming 3pm] - Score: 4.1
  Combo 3: [Gymnastics 10am, Track 7pm] - Score: 3.8
  ...
```

#### Generating Combinations

```python
def generate_day_combos(user_sessions_for_day, travel_matrix, user_prefs, users_with_interest, max_sessions=3):
    """
    Generate all valid session combinations for a user for a single day.

    Args:
        user_sessions_for_day: Sessions the user is interested in for this day (already filtered: interest ≠ None AND excluded = false)
        travel_matrix: Zone-to-zone travel times
        user_prefs: User's preferences (sport rankings, session interests, soft buddies)
        users_with_interest: Dict mapping session_code -> list of users with active interest (interest ≠ None AND excluded = false)
        max_sessions: Maximum sessions per day (default 3)
    """
    combos = []

    # Generate all subsets of size 1 to max_sessions
    for size in range(1, max_sessions + 1):
        for subset in combinations(user_sessions_for_day, size):
            if is_travel_feasible(subset, travel_matrix):
                score = sum(
                    calculate_session_score(session, user_prefs, users_with_interest)
                    for session in subset
                )
                combos.append((subset, score))

    # Sort by score descending
    return sorted(combos, key=lambda x: x[1], reverse=True)

def calculate_session_score(session, user_prefs, users_with_interest):
    sport_multiplier = get_sport_multiplier(session.sport, user_prefs.sport_rankings)
    session_adjustment = get_session_adjustment(session, user_prefs.session_interests)
    soft_buddy_bonus = get_soft_buddy_bonus(session, user_prefs.soft_buddies, users_with_interest)

    return sport_multiplier * session_adjustment * soft_buddy_bonus

def get_sport_multiplier(sport, sport_rankings):
    n = len(sport_rankings)
    if n == 1:
        return 2.0
    rank = sport_rankings.index(sport) + 1  # 1-indexed
    return 2.0 - ((rank - 1) / (n - 1)) * 1.0

def get_session_adjustment(session, session_interests):
    interest = session_interests.get(session.session_code, "None")
    return {"High": 1.0, "Medium": 0.7, "Low": 0.4, "None": 0}[interest]

def get_soft_buddy_bonus(session, soft_buddies, users_with_interest):
    """
    Calculate soft buddy bonus based on how many soft buddies have ACTIVE interest in the session.
    Note: This is based on active interest (interest ≠ None AND excluded = false), not confirmed
    attendance, since we don't know final schedules at combo generation time.
    Excluded users do not count toward soft buddy bonuses.
    """
    buddies_interested = len([b for b in soft_buddies if b in users_with_interest[session.session_code]])
    if buddies_interested == 0:
        return 1.0
    return 1.0 + 0.25 + (0.10 * (buddies_interested - 1))

def is_travel_feasible(sessions, travel_matrix):
    # Sort by start time
    ordered = sorted(sessions, key=lambda s: s.start_time)

    for i in range(len(ordered) - 1):
        current = ordered[i]
        next_session = ordered[i + 1]

        # Check overlap
        if current.end_time > next_session.start_time:
            return False

        # Check travel gap
        gap_available = next_session.start_time - current.end_time
        gap_required = get_required_gap(current.zone, next_session.zone, travel_matrix)

        if gap_available < gap_required:
            return False

    return True

def get_required_gap(zone1, zone2, travel_matrix):
    """
    Get required gap between sessions based on zone proximity.
    Uses driving time to categorize proximity, returns gap in minutes.
    """
    if zone1 == zone2:
        return 60  # 1.0 hour for same zone

    # Special case for Trestles Beach
    if 'Trestles' in zone1 or 'Trestles' in zone2:
        return 240  # 4.0 hours

    driving_time = travel_matrix.driving[zone1][zone2]

    if driving_time < 15:
        return 90   # 1.5 hours - very close
    elif driving_time < 30:
        return 120  # 2.0 hours - close
    elif driving_time < 45:
        return 150  # 2.5 hours - medium
    elif driving_time < 60:
        return 180  # 3.0 hours - far
    else:
        return 210  # 3.5 hours - very far
```

### Step 6: Score Combos and Assign Primary + Backups Per Day

For each user, for each day, designate:

- **Primary combo**: Highest-scoring valid combination
- **Backup combos**: Next 2 best alternatives

Backups are pre-computed for Phase 2 execution. When the buyer is purchasing tickets during their limited timeslot, they need immediate fallback options if the primary combo fails:

- A session in the primary combo is sold out
- A session price exceeds the user's willingness
- A buddy constraint cannot be satisfied

**Why 2 backups:** Balances Phase 2 coverage with conflict resolution workload. Each unique session across primary and backup combos needs viable configurations computed and conflicts resolved. Since backups typically share many sessions with the primary (they're variations, not completely different plans), 2 backups provides good coverage without excessive overhead.

```
Alice's July 18:
  Primary:  [Gymnastics 10am, Swimming 3pm, Track 7pm] - Score: 5.2
  Backup 1: [Gymnastics 10am, Swimming 3pm] - Score: 4.1
  Backup 2: [Gymnastics 10am, Track 7pm] - Score: 3.8
```

### Step 7: Compute Viable Configurations Per Session

For each session that appears in ANY member's combos (primary, backup1, or backup2), determine which members can attend together at various price points. Viable configs are scoped to combo sessions only — this keeps conflict resolution focused on sessions users can actually see on their calendar. For Phase 2, viable configs can be recomputed on-demand for any session if a buyer pivots to a session outside the pre-computed set.

#### Price Tiers

Define price tiers based on users' willingness buckets:

```
Session: GYM-WFINAL-0803
Users interested: Alice (<$500), Bob (<$250), Carol (<$150), Eve (<$400)

Price Tiers:
  ≤$150:    Willing = {Alice, Bob, Carol, Eve}
  $151-250: Willing = {Alice, Bob, Eve}
  $251-400: Willing = {Alice, Eve}
  $401-500: Willing = {Alice}
  >$500:    Willing = {}
```

#### Apply Buddy Constraints

For each price tier, filter to users whose buddy constraints are satisfied:

```
Constraints:
  - Eve has hard_buddy = Alice
  - Carol has min_buddies = 1

Price ≤$150:
  Willing: {Alice, Bob, Carol, Eve}
  Check Eve: Alice in set? YES ✓
  Check Carol: Others in set? YES (3 others) ✓
  Viable: {Alice, Bob, Carol, Eve}

Price $151-250:
  Willing: {Alice, Bob, Eve}
  Check Eve: Alice in set? YES ✓
  Carol not willing, constraint N/A
  Viable: {Alice, Bob, Eve}

Price $251-400:
  Willing: {Alice, Eve}
  Check Eve: Alice in set? YES ✓
  Viable: {Alice, Eve}
```

#### Output Format

```
Session: GYM-WFINAL-0803

Viable Configurations:
  Price ≤$150:    {Alice, Bob, Carol, Eve} - 4 tickets
  Price $151-250: {Alice, Bob, Eve} - 3 tickets
  Price $251-400: {Alice, Eve} - 2 tickets
  Price $401-500: {Alice} - 1 ticket
  Price >$500:    {} - 0 tickets (skip session)
```

### Step 8: Schedule Review (Satisfaction Check)

Before entering conflict resolution, each member reviews their generated schedule and confirms whether they're satisfied. Member status transitions from `schedule_review_pending` to `schedule_review_confirmed`.

**What members review:**

- Their primary + backup combos for each day (all 19 Olympic days)
- Which sessions they got from their preferred sports
- Buddy overlap (are they attending sessions with their desired companions?)

**Note:** Budget impact is NOT shown during schedule review because window rankings haven't been computed yet (they require the `completed` phase). Budget impact is available after window selection in the `completed` phase. Budget impact is based on willingness upper bounds (not actual ticket prices, which are unknown), so it represents a worst-case estimate. This is intentional — the goal is to show users their optimal schedule first, then let them assess budget feasibility with the understanding that actual costs may be lower.

**Satisfaction Prompt:**

```
"Review your generated schedule. Are you satisfied with the sessions assigned to you?"

[Yes, proceed to conflict resolution]
[No, I want to adjust my preferences]
```

**If NO:**

- Member re-enters preferences (status → `joined`, `preference_step` → `buddies_budget`)
- All other members' statuses → `preferences_set`
- Group phase → `preferences`
- The group owner must trigger schedule regeneration after the member re-submits
- Frontend warning: "This will reset generated schedules for all members. Discuss with your group before proceeding."

**If YES:**

- Member status → `schedule_review_confirmed`
- When ALL members reach `schedule_review_confirmed` → all members bulk move to `conflict_resolution_pending`, group → `conflict_resolution`

**Revoking satisfaction:**

- A member can revoke their satisfaction (→ `schedule_review_pending`) as long as the group is still in the `schedule_review` phase (i.e., not all members have confirmed yet)

**Why this step exists:**
If a member is fundamentally unhappy with their schedule (e.g., barely got any sessions from their top sport, no overlap with friends), it's better to address this BEFORE getting into the detailed work of conflict resolution. Re-entering preferences and regenerating is cleaner than trying to fix a bad schedule through conflict resolution.

---

### Step 9: Flag Conflicts for User Resolution

Conflicts are **detected and stored during schedule generation** (computed alongside Steps 4-7 when the owner triggers generation), but are **displayed to members during the conflict resolution phase** after all members have confirmed satisfaction in schedule review. This separation allows members to first assess their overall schedule before diving into specific buddy constraint issues.

_Note: Although conflict detection is documented here as Step 9, the actual computation happens during the generation process (when the owner triggers `POST /generate`). The conflict rows are written to the database at that time but not surfaced to users until the group enters the `conflict_resolution` phase._

A conflict exists when a member's buddy constraint fails at their willingness price tier.

#### Conflict Types

**Type 1: Min Buddies Constraint Failure**

A user is willing to pay at a price tier, but their `min_buddies` constraint isn't satisfied because not enough others are willing.

```
Session: Diving
  Price $101-150: {Bob, Carol}

  ⚠️ CONFLICT: Carol's min_buddies not satisfied
  - Carol is willing at this price (<$150)
  - Carol has min_buddies=2
  - Only Bob is also attending (1 buddy, needs 2)

  Possible resolutions:
  • Carol lowers willingness to ≤$100
  • Carol overrides min_buddies for this session
  • Carol removes Diving from schedule
  • Dave raises willingness to ≥$101
  • Other: Users discuss and adjust as needed
```

**Type 2: Hard Buddy Cascade**

A user's hard buddy is excluded at a price tier, which means the user also cannot attend even though they're willing to pay.

```
Session: Swimming
  Price $151-200: {Bob, Carol}

  ⚠️ CONFLICT: Eve cannot attend (hard_buddy excluded)
  - Eve is willing at this price (<$200)
  - Eve has hard_buddy=Alice
  - Alice is NOT willing at this price (Alice's willingness is <$150)
  - Eve cannot attend without Alice

  Possible resolutions:
  • Eve lowers willingness to ≤$150
  • Eve overrides hard_buddy for this session
  • Eve removes Swimming from schedule
  • Alice raises willingness to ≥$151
  • Other: Users discuss and adjust as needed (e.g., both adjust to meet in the middle)
```

**Type 3: Complete Exclusion**

A user is excluded from a session entirely because their buddy constraint fails at ALL price tiers where they're willing.

```
Session: Track
  Users interested: Alice (<$100), Bob (<$200), Carol (<$200), Eve (<$150)
  Eve has hard_buddy=Alice

  Price ≤$100:    {Alice, Bob, Carol, Eve} - Eve's constraint satisfied ✓
  Price $101-150: {Bob, Carol, Eve} - Alice excluded, Eve's constraint FAILS
  Price $151-200: {Bob, Carol} - Alice excluded, Eve excluded (can't attend without Alice)

  ⚠️ CONFLICT: Eve completely excluded at $101+
  - Eve is willing up to <$150
  - But Alice is only willing up to <$100
  - If price exceeds $100, Alice is out → Eve is out

  Possible resolutions:
  • Eve lowers willingness to ≤$100
  • Eve overrides hard_buddy for this session
  • Eve removes Track from schedule
  • Alice raises willingness to ≥$101
  • Alice removes Track from schedule
  • Other: Users discuss and adjust as needed
```

#### Conflict Resolution Process

After schedules are generated, users review their individual calendars and any flagged conflicts. A conflict occurs when a user's buddy constraint (hard_buddy or min_buddies) fails at their current willingness price tier. All conflicts must be resolved before proceeding to window ranking.

**What is a Conflict?**

A conflict exists when:

- User's buddy constraint fails at THEIR willingness tier
- Example: Eve has hard_buddy=Alice, willingness <$200. Alice's willingness is <$100. At $101-200, Alice is not willing, so Eve's constraint fails → CONFLICT for Eve

**Resolution Options (no algorithm re-run):**

Users must resolve each conflict using one of these approaches:

1. **Adjust willingness** — Move to a price tier where buddy constraint IS satisfied
2. **Remove session** — Exclude it from your current schedule (your interest and willingness data is preserved and the session will be reconsidered if the algorithm is re-run)
3. **Override buddy constraint for this session** — Keep the session, ignore your buddy constraint for this session only

There is no implicit "accept" option. Users must explicitly resolve each conflict.

**Session-Level Override:**

When a user overrides their buddy constraint for a specific session:

- The override applies to THAT SESSION ONLY
- Other sessions still respect the original constraint
- Overrides are cleared if the algorithm is re-run

**Collaborative Resolution:**

Conflict resolution is collaborative. The conflict display shows ALL possible resolutions as **guidance**, not clickable actions. Conflicts are shown to both the affected member and the causing member (when applicable), so both parties can see the situation and coordinate. Users discuss with affected parties, then perform the agreed-upon changes using the existing UI controls (adjust willingness, remove session, override constraint).

```
⚠️ Conflict: Swimming
Your hard_buddy constraint fails at $101-200

Possible resolutions:
• You lower willingness to ≤$100
• You override hard_buddy for this session
• You remove Swimming from schedule
• Alice raises willingness to ≥$101
• Other: Discuss with Alice and adjust as needed

Use the preference controls to make changes after discussing with your group.
```

**Confirmation Warning:**

Before applying any change, display:

- "This change affects [list of users]. Have you discussed this with them?"
- User must confirm or cancel

**Re-check After Each Change:**

After any resolution:

1. System recalculates viable configurations for affected sessions
2. System re-checks ALL conflicts across ALL users
3. New conflicts may be flagged (e.g., if removing a session breaks someone else's min_buddies)
4. If a new conflict is created for a user who already confirmed, their confirmation is revoked

**Confirmation Phase:**

When a member has reviewed and resolved all their conflicts, they click **"Confirm Schedule"**:

- Prompt: "All your conflicts are resolved. Confirm your schedule?"
- Member status → `conflict_resolution_confirmed`

**Revoking confirmation:**

- A member can revoke their confirmation (→ `conflict_resolution_pending`) as long as the group is still in the `conflict_resolution` phase (i.e., not all members have confirmed yet)
- If a cascade creates a new conflict for a confirmed member, their confirmation is automatically revoked

**Completion:**

- Schedules are finalized once ALL members have reached `conflict_resolution_confirmed`
- Group phase automatically transitions to `completed`
- Window rankings are then computed from finalized combo scores (see Window Ranking below)

**Re-entering Preferences:**

If a member is unsatisfied with their schedule during conflict resolution and wants to change their preferences (interest levels, sport rankings, buddy constraints), they can re-enter the preference wizard:

- Member status → `joined`
- All other members' statuses → `preferences_set`
- Group phase → `preferences`
- Frontend warning: "This will reset generated schedules for all members. Discuss with your group before proceeding."
- The group owner must trigger schedule regeneration after the member re-submits
- All overrides and excluded flags are cleared (previously excluded sessions are reconsidered on re-generation)
- All members must re-review and re-confirm after regeneration

**Example Flow:**

```
1. Schedules generated, conflicts flagged
   - Eve: 2 conflicts (Gymnastics, Swimming)
   - Alice: 0 conflicts

2. Eve reviews Gymnastics conflict:
   - Can't attend at $101+ (hard_buddy Alice not willing)
   - Options shown include: Eve lowers willingness, Eve overrides, Alice raises willingness
   - Group discusses, agrees Eve will lower willingness to <$100
   - Eve submits change
   - System re-checks → conflict resolved ✓

3. Eve reviews Swimming conflict:
   - Can't attend at $151+ (min_buddies fails)
   - Group discusses, agrees Eve will override min_buddies for Swimming
   - Eve submits override
   - System re-checks → conflict resolved ✓

4. Eve clicks "Confirm Schedule"
   - "All conflicts resolved. Confirm?"
   - Eve confirms ✓

5. Alice clicks "Confirm Schedule"
   - "Your schedule is conflict-free. Confirm?"
   - Alice confirms ✓

6. All members confirmed → Group phase → completed, window rankings computed
```

#### When Sessions Are Removed

When a user removes a session from their schedule during conflict resolution, the session is **soft-excluded** rather than permanently deleted. The `session_preference` row is preserved with `excluded = true`, keeping the user's interest and willingness data intact for potential re-generation.

1. **Session soft-excluded:** The `excluded` flag is set to `true` on the user's `session_preference` row
2. **Session dropped from combos:** The session is removed from the user's primary and backup combos
3. **Scores recalculated:** The removing user's combo scores are updated, and other users' combo scores are recalculated if their soft buddy bonuses are affected
4. **De-duplicate backups:** If a backup combo becomes identical to the primary or another backup after removal, it is removed to avoid redundancy
5. **User removed from viable configs:** The user is removed from ALL price tiers for that session (treated as not interested)
6. **Re-check conflicts:** System recalculates viable configs and re-checks all conflicts. May flag new conflicts for other users whose buddy constraints now fail.

```
Example:
  Alice removes Swimming from her July 18 schedule

  Before removal:
    Primary:  [Gymnastics 10am, Swimming 3pm, Track 7pm]
    Backup 1: [Gymnastics 10am, Swimming 3pm]
    Backup 2: [Gymnastics 10am, Track 7pm]

    Swimming viable configs:
      ≤$150: {Alice, Bob, Carol, Eve}

  After removal:
    Alice's session_preference for Swimming: excluded = true
      (interest and willingness preserved)

    Primary:  [Gymnastics 10am, Track 7pm]
    Backup 1: [Gymnastics 10am]
    Backup 2: (removed — was identical to new Primary)

    Swimming viable configs recalculated:
      ≤$150: {Bob, Carol, Eve}  (Alice excluded)

  System re-checks conflicts:
    → Eve has hard_buddy=Alice for Swimming
    → Alice excluded from all tiers → Eve's constraint fails at ALL tiers
    → New conflict flagged for Eve
```

**On re-generation:** The `excluded` flag is reset to `false` for all sessions, so previously removed sessions are reconsidered with fresh combo generation. If group dynamics have changed (e.g., more people are now interested in Swimming), the session may appear in Alice's new combos.

**Permanent removal:** If a user wants to permanently remove interest in a session (not just exclude it from the current schedule), they re-enter the preference wizard and deselect the session in Step 3. This deletes the `session_preference` row entirely.

**Note:** Removing a session only affects the user's own combos. Other users who have the session keep it. However, the user is removed from viable configurations, which may create new conflicts for others. Excluded sessions do not count toward other users' soft buddy bonuses or min_buddies checks.

### Date Configuration

Date configuration (N-days or specific date range) is set during **group creation** (or deferred and set later) and can be changed at any time by the owner, including during the `completed` phase. Date config must be set before the owner triggers schedule generation. The generation confirmation dialog encourages the owner to confirm the group has agreed on dates before proceeding.

**Input Options:**

| Mode          | Description                | Example          |
| ------------- | -------------------------- | ---------------- |
| `consecutive` | Number of consecutive days | 5 days           |
| `specific`    | Exact date range           | July 18-22, 2028 |

**Notes:**

- Changing date config does NOT require re-running the algorithm
- If `specific` mode is used, there is only one possible window (the specified dates), so window ranking produces a single result
- Date config can be adjusted in the `completed` phase to explore different windows

---

### Window Ranking

Window rankings are computed after all members have confirmed their schedules (group phase = `completed`). Combos for all days were already computed in Steps 5-6, so this step simply evaluates which N consecutive days provide the best group experience.

#### Window Scoring

For each possible N-day window:

1. Sum the primary combo scores for all users across all days
2. Apply fairness penalty (fixed weight of 0.25)

```python
FAIRNESS_WEIGHT = 0.25  # Fixed, not user-configurable

def score_window(window_days, user_combos, users):
    # Base score: sum of all users' combo scores
    base_score = 0
    user_scores = {}

    for user in users:
        user_total = 0
        for day in window_days:
            user_total += user_combos[user][day].primary.score
        user_scores[user] = user_total
        base_score += user_total

    # Fairness penalty: penalize high standard deviation in user scores
    stdev = calculate_standard_deviation(user_scores.values())
    fairness_penalty = stdev * len(users) * FAIRNESS_WEIGHT

    return base_score - fairness_penalty
```

**Why fairness_weight = 0.25:**
At this weight, the algorithm prefers equal distribution when one user would otherwise have a significantly worse experience. For example, a window where everyone scores 20 points will beat a window where three people score 28-30 but one person scores only 5, even though the latter has a higher total.

#### Output

```
=== RANKED 5-DAY WINDOWS ===

1. July 18-22 (Score: 48.5) ← Selected
   Alice: 12.3 pts | Bob: 11.8 pts | Carol: 11.2 pts | Eve: 13.2 pts

2. July 19-23 (Score: 45.2)
   Alice: 11.5 pts | Bob: 10.9 pts | Carol: 10.8 pts | Eve: 12.0 pts

3. July 25-29 (Score: 41.8)
   Alice: 10.2 pts | Bob: 10.5 pts | Carol: 10.1 pts | Eve: 11.0 pts
```

**Window Selection:**

- The top-ranked window is selected by default
- Users can switch to a different window without re-running the algorithm (combos are already computed for all days)
- Switching windows simply changes which days the group is planning to attend

Note: Users can change the N-day value and see different window rankings without re-running the algorithm.

### Group Schedule Output

Combine all the above into a comprehensive schedule.

---

## User Interface

### Individual Calendar View

Each user sees their own schedule in a calendar view.

**Display:**

- Sessions shown as blocks at their corresponding timeframes
- Each session block displays:
  - Sport name
  - Event name (if space permits)
  - Venue/Zone (if space permits)
  - Combo tags: [P] [B1] [B2] indicating which combos include this session
  - Conflict indicator (⚠️) if applicable
- Sessions appear ONCE (no duplication), with combo tags showing membership

**Filtering:**

- Filter dropdown: All (default), Primary, Backup 1, Backup 2
- Filtering shows only sessions in the selected combo

**Click to Expand:**
Clicking any session opens a modal with:

- Full session details (sport, event, venue, zone, date, time)
- Combo tags (which combos include this session)
- Your willingness for this session
- Price tier configurations (who can attend at each tier)
- Conflicts (if any) with resolution options
- Other users attending this session

**Example:**

```
JULY 18                                    Filter: [All ▼]

10:00 ┌─────────────────────────────────────────────┐
      │ Gymnastics Women's Final    [P] [B1] [B2]  │
      │ DTLA Zone                                   │
      └─────────────────────────────────────────────┘

15:00 ┌─────────────────────────────────────────────┐
      │ Swimming 100m Final  ⚠️     [P] [B1]       │
      │ Long Beach Zone                             │
      └─────────────────────────────────────────────┘

19:00 ┌─────────────────────────────────────────────┐
      │ Track 200m Semi             [P] [B2]       │
      │ Exposition Park Zone                        │
      └─────────────────────────────────────────────┘
```

### Group Calendar View

Shows all sessions across all members. Available from the `schedule_review` phase onward.

**Display:**

- All sessions from all users (no combo tags — too complex with multiple users)
- Each session block displays:
  - Sport name
  - Event name (if space permits)
  - Venue/Zone
  - Users attending, split by: Primary: [names], Backup: [names]
  - Conflict indicator (⚠️) if applicable

**Filtering:**

- Filter by user: All (default), or select specific user(s)
- Filtering shows only sessions the selected user(s) are attending (primary OR backup)

**Click to Expand:**
Clicking any session opens a modal with:

- Full session details
- All users attending (with their willingness tiers)
- Price tier configurations (read-only)
- No conflict resolution (that happens in individual view)

**Window Information:**

- Selected window displayed (e.g., "July 18-22")
- Window rankings shown (users can switch windows without re-running algorithm)
- Confirmation status for each user

**Asterisk Notation:** If a user has the session in BOTH their primary and a backup combo, their name appears with an asterisk (\*) in the Primary list only. This avoids duplication while indicating they have the session in multiple combos.

**Example:**

```
┌─────────────────────────────────────────────────────────────┐
│ GROUP SCHEDULE                                              │
├─────────────────────────────────────────────────────────────┤
│  Selected Window: July 18-22                                │
│                                                             │
│  Window Rankings:              Confirmation Status:         │
│  1. July 18-22 ← Selected      ✓ Alice (confirmed)         │
│  2. July 19-23                 ✓ Bob (confirmed)           │
│  3. July 25-29                 ✓ Carol (confirmed)         │
│                                ✓ Eve (confirmed)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  JULY 18                            Filter by user: [All ▼] │
│                                                             │
│  10:00 ┌────────────────────────────────────────────────┐   │
│        │ Gymnastics Women's Final                       │   │
│        │ DTLA Zone                                      │   │
│        │ Primary: Alice*, Bob*, Carol*, Eve*            │   │
│        │ Backup: -                                      │   │
│        │ (* = also in backup combo)                     │   │
│        └────────────────────────────────────────────────┘   │
│                                                             │
│  15:00 ┌────────────────────────────────────────────────┐   │
│        │ Swimming 100m Final                            │   │
│        │ Long Beach Zone                                │   │
│        │ Primary: Alice*, Bob                           │   │
│        │ Backup: Carol, Eve                             │   │
│        └────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Output Format

### Per User Summary

Each user sees their schedule with the following sections:

#### Schedule Calendar

Shows primary combo + 2 backup combos for each day, with session details (time, venue, zone, willingness).

```
=== ALICE'S SCHEDULE ===

Window: July 18-22 (Primary)

JULY 18:
  Primary Combo (Score: 5.2):
    09:00-12:00  Gymnastics Women's Final    DTLA Zone         Willing: <$500
    15:00-17:30  Swimming 100m Final         Long Beach Zone   Willing: <$200
    19:30-22:00  Track 200m Semi             Exposition Park   Willing: <$150

  Backup 1 (Score: 4.1):
    09:00-12:00  Gymnastics Women's Final    DTLA Zone         Willing: <$500
    15:00-17:30  Swimming 100m Final         Long Beach Zone   Willing: <$200

  Backup 2 (Score: 3.8):
    09:00-12:00  Gymnastics Women's Final    DTLA Zone         Willing: <$500
    19:30-22:00  Track 200m Semi             Exposition Park   Willing: <$150

JULY 19:
  Primary Combo (Score: 4.8):
    ...
```

#### Budget Impact Summary

Shows how the member's schedule **for the selected N-day window** compares to their stated budget. Budget impact is available after window rankings are computed and a window is selected (during the `completed` phase).

**Components:**

- **Your Budget:** The total budget the user entered during preference input
- **Total if all sessions at willingness:** Sum of willingness prices for all sessions in primary combos **within the selected window** (worst-case scenario — actual prices may be lower)
- **Status:** Under budget ✓, Over budget ⚠️, or Significantly over ⛔
- **Skip suggestions (if over budget):** Sessions ordered by lowest score first, showing which sessions the user would likely skip to meet budget (lowest priority sessions first)
- **Remaining total:** What the budget would be after skipping suggested sessions

```
=== BUDGET IMPACT ===

Your Budget: $500

Total if all primary combos at willingness prices: $725

Status: ⚠️ OVER BUDGET by $225

If prices hit your willingness, you may need to skip (lowest score first):
  1. Water Polo Prelim (July 20) - <$100 willingness, Score: 0.8
  2. Diving Semi (July 22) - <$150 willingness, Score: 1.2

Remaining sessions would total: $475 ✓

Note: Actual prices may be lower than your willingness. This is a worst-case estimate.
```

#### Buddy Status

Shows how well the user's schedule aligns with their buddy preferences. Helps users see at a glance whether they'll be attending with the people they want to attend with.

**Components:**

- **Hard Buddy:** Confirmation that hard buddy is attending ALL the same sessions in primary combos, or warning if any sessions don't have hard buddy
- **Soft Buddies:** For each soft buddy, shows the number and percentage of overlapping sessions — higher overlap means more time together

```
=== BUDDY STATUS ===

Hard Buddy:
  Bob: Attending same sessions in primary combos ✓

Soft Buddies:
  Carol: 8 of 12 sessions overlap (67%)
  Dave: 5 of 12 sessions overlap (42%)
```

**Possible hard buddy statuses:**

- ✓ "Attending same sessions in primary combos" — all good
- ⚠️ "Not attending [Session Name] — see conflicts" — hard buddy constraint violated, needs resolution

### Per Session Summary

```
=== SESSION: GYM-WFINAL-0803 ===

Gymnastics Women's All-Around Final
July 18, 2028 | 09:00-12:00 | DTLA Zone

Interested Users:
  Alice - Willingness: <$500, Interest: High, Score: 2.7
  Bob   - Willingness: <$250, Interest: High, Score: 2.1
  Carol - Willingness: <$150, Interest: Medium, Score: 1.2
  Eve   - Willingness: <$400, Interest: High, Score: 2.4

Viable Configurations by Price:
  ≤$150:    Alice, Bob, Carol, Eve (4 tickets)
  $151-250: Alice, Bob, Eve (3 tickets)
  $251-400: Alice, Eve (2 tickets)
  $401-500: Alice (1 ticket)
  >$500:    Skip session

Buddy Dependencies:
  - Eve requires Alice (hard_buddy)
  - Carol requires 1+ others (min_buddies=1)
```

### Group Calendar View

```
=== GROUP CALENDAR: July 18-22 ===

             ALICE          BOB            CAROL          EVE
July 18
  Morning    Gymnastics     Gymnastics     Gymnastics     Gymnastics
  Afternoon  Swimming       Swimming       -              Swimming
  Evening    Track          Basketball     Volleyball     Track

July 19
  Morning    -              Diving         Diving         -
  Afternoon  Swimming       Swimming       Swimming       Swimming
  Evening    Track          Track          -              Track

...
```

---

## Complexity Analysis

### Computational Bounds

| Step            | Complexity             | Notes                |
| --------------- | ---------------------- | -------------------- |
| Filter sessions | O(S × U)               | S=sessions, U=users  |
| Generate combos | O(S³) per user per day | Max 3-session combos |
| Viable configs  | O(U × P) per session   | P=price tiers        |
| Rank windows    | O(W × U × D)           | W=windows, D=days    |

For typical inputs (4-6 users, 10 sports each, 19 days):

- ~1 million operations total
- Completes in <1 second on modern hardware

### Pruning Strategies

1. **Limit combos per user**: Keep only top 10 by score
2. **Constraint propagation**: Pre-filter based on buddy constraints
3. **Early termination**: Stop window search if score can't beat current best

---

## Edge Cases

### No Valid Combo for a Day

If a user has no travel-feasible combinations for a day:

- That day is marked as a "rest day" with score = 0
- The user's calendar shows "Rest Day" for that date
- This is normal and expected for some days (user may not have sessions of interest)

### No Valid Combos Across ALL Days

If a user has zero valid combos for the entire Olympics period:

- Flag as error: "No valid schedule could be generated. Please review your preferences."
- Likely causes: too restrictive buddy constraints, no overlapping interests with hard buddy, all sessions fail travel constraints
- User must adjust preferences and re-run

### Buddy Constraint Impossible

If any of a user's hard buddies have no overlapping sessions:

- Flag as warning during input validation
- Suggest relaxing the constraint or adjusting session selection

### Budget Significantly Over

If a user's total willingness across all primary combos greatly exceeds their budget:

- Show warning with specific sessions at risk
- List sessions in order they'd likely skip (lowest score first)
- Do NOT filter sessions out - user may decide to increase budget or prices may be lower

### Budget Comfortably Under

If a user's total willingness < budget:

- No issue, they can afford everything they want
- Display as "Budget: Comfortable ✓"

### Budget Below Single Session

If a user's budget < their single highest-priority session willingness:

- Flag as warning: "Your budget ($200) is below your willingness for Gymnastics Finals (<$500)"
- Suggest: Increase budget, lower willingness, or accept you may not attend that session

### User Selects Only 1 Sport

- Sport multiplier defaults to 2.0x
- Algorithm functions normally with limited session pool

### User Selects No Sessions

- User cannot participate in optimization
- Flag as warning: "You haven't selected any sessions. Select at least one session to be included in the group schedule."

### Hard Buddy Has No Overlapping Interests

If User A has hard buddies including User B, but User B has no interest in any of User A's selected sessions:

- All of User A's sessions are excluded during hard buddy filtering (they can't attend any without their buddy)
- Flag as warning during validation: "You and [Bob] have no overlapping session interests. Either adjust your selections or remove the hard buddy constraint."
- Suggest: Review sessions together, or change hard buddy to soft buddy if attendance together is preferred but not required
- This can only be detected after all members have submitted preferences

---

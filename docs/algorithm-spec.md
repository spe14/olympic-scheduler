# LA 2028 Olympics Group Scheduler — Algorithm Spec

## Overview

The scheduler operates in three phases:

1. **Phase 1: Schedule Generation** — Generate an optimal group schedule based on interest levels, sport rankings, and buddy constraints. Output: each member gets a schedule with P/B1/B2 combos per day.
2. **Phase 2: Ticket Purchase Plan** — Members with purchase timeslots set price ceilings and create a combo-based purchase plan. Output: day-by-day combos with price ceilings, fallbacks, and "buy for others" assignments.
3. **Phase 3: Purchase Tracking & Re-generation** — Track actual purchases, budget spent, sold-out sessions, and extra sessions. Re-generate schedules with purchased sessions locked in.

This document focuses on Phase 1. Phases 2 and 3 are outlined at the end with detailed data flow.

---

## Phase 1: Schedule Generation

### Algorithm Flow

1. **Group Creation & Preference Input**
   - Group owner creates group (optionally sets date config at creation or defers)
   - Members request to join, owner approves — members begin entering preferences immediately
   - Step 1: Set buddy constraints
   - Step 2: Select and rank sports (up to 10)
   - Step 3: Select sessions from those sports, set interest level per session

2. **Schedule Generation** (owner triggers after ALL members complete preferences; date config required)
   - Step 4: Filter sessions by interest
   - Step 5: Apply buddy + travel constraints, generate combos
   - Step 6: Score combos, assign primary + backups

3. **Schedule Review**
   - Step 7: Window rankings computed during generation; members review generated schedules
   - Members implicitly accept the schedule — no confirmation step required
   - Owner selects a window from the pre-computed rankings

---

### Inputs

#### User Data

For each user in the group:

| Field     | Description       | Example |
| --------- | ----------------- | ------- |
| `user_id` | Unique identifier | "alice" |

##### Step 1: Buddy Preferences

Users set buddy preferences that apply across all sessions:

| Field          | Description                                               | Example           |
| -------------- | --------------------------------------------------------- | ----------------- |
| `hard_buddies` | MUST attend with these people (strict constraint)         | ["bob"]           |
| `soft_buddies` | PREFER to attend with these people (flexible, adds bonus) | ["carol", "dave"] |
| `min_buddies`  | Minimum others who must also attend each session          | 1                 |

**Constraint vs Preference:**

- `hard_buddies`: Constraint — session is invalid if ANY of these people aren't attending. Multiple hard buddies are allowed but increasingly restrictive.
- `soft_buddies`: Preference — adds bonus points if attending together, but not required
- `min_buddies`: Constraint — must have at least N other group members at each session

**Warning displayed on buddy preference page:** "Adding multiple hard buddies is very restrictive — you can only attend sessions where ALL your hard buddies are also interested. Consider using soft buddies for a more flexible schedule."

##### Step 2: Sport Selection and Ranking

Users select up to **10 sports** they want to attend and rank them in order of preference:

| Field            | Description                                 | Example                                                     |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------- |
| `sport_rankings` | Ordered list of sports (1 = most preferred) | ["Gymnastics", "Swimming", "Track", "Diving", "Basketball"] |

**Ordered Ranking:** Sports are ranked 1st through Nth (where N <= 10). This ranking determines the sport multiplier used in scoring.

```
Example - Alice's Sport Rankings:
  1. Gymnastics
  2. Swimming
  3. Track
  4. Diving
  5. Basketball
```

##### Step 3: Session-Level Preferences

After selecting sports, users see a calendar view showing only sessions from their selected sports. For each session they want to attend, they set their interest level:

| Field              | Description                     | Required           |
| ------------------ | ------------------------------- | ------------------ |
| `session_interest` | Interest level for this session | Yes (if attending) |

**Session Interest Levels:**

| Level  | Description                | Session Adjustment |
| ------ | -------------------------- | ------------------ |
| High   | Strongly want to attend    | 1.0x               |
| Medium | Would enjoy attending      | 0.7x               |
| Low    | Would attend if convenient | 0.4x               |
| None   | Not interested (default)   | Excluded           |

**Important:** Sessions default to "None" (not interested). Users must explicitly opt-in to each session they want to attend by selecting an interest level.

```
Example - Alice's Session Preferences for Track:
  - 100m Final: High interest
  - 200m Semi: Medium interest
  - Shot Put Final: Low interest
  - Marathon: None (not attending)
```

#### Session Data

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

#### Travel Matrix

Zone-to-zone driving times (in minutes) used to determine required gaps between sessions:

```
                    DTLA    Long Beach    Inglewood    ...
DTLA                0       37            25
Long Beach          40      0             34
Inglewood           27      36            0
```

The driving time matrix is used to categorize zone proximity and determine required gaps. See Travel Gap Rules in Algorithm Steps for the gap lookup table.

---

### Scoring System

#### Session Score (Individual User)

A user's score for a single session is calculated as:

```
session_score = sport_multiplier x session_adjustment x soft_buddy_bonus
```

##### Sport Multiplier

The sport multiplier is derived from the user's ordered sport ranking. It scales dynamically based on how many sports the user selected:

```
sport_multiplier = max - ((rank - 1) / (n - 1)) x (max - min)

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

##### Session Adjustment

Based on the user's interest level for the specific session:

| Interest Level | Adjustment                  |
| -------------- | --------------------------- |
| High           | 1.0x                        |
| Medium         | 0.7x                        |
| Low            | 0.4x                        |
| None           | Excluded from consideration |

##### Soft Buddy Bonus

When soft buddies have indicated interest in the same session, a bonus multiplier is applied with diminishing returns:

```
soft_buddy_bonus = 1.0 + 0.25 (first buddy) + 0.10 x (additional buddies)
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

**Important:** The soft buddy bonus is based on which soft buddies have the session in their **filtered** candidate set — i.e., after hard buddy and min buddies constraints have been applied to the buddy's own sessions. If a soft buddy expressed interest in a session but their own constraints removed it, they don't count toward the bonus because they can never actually attend. All members' sessions are filtered first, then soft buddy bonuses are computed from those filtered sets.

**Note:** No cap is applied. The diminishing returns formula naturally limits the impact, and large buddy bonuses on low-ranked sports still won't overtake high-ranked sports due to the sport multiplier differential.

##### Scoring Example

```
Setup:
  Alice ranks 5 sports: 1. Gymnastics, 2. Swimming, 3. Track, 4. Diving, 5. Basketball
  Alice selects Women's Gymnastics All-Around Final as High interest
  Alice has 2 soft buddies (Bob and Carol) who also indicated interest in this session

Calculation:
  sport_multiplier = 2.0 (Gymnastics is rank 1 of 5)
  session_adjustment = 1.0 (High interest)
  soft_buddy_bonus = 1.0 + 0.25 + 0.10 = 1.35 (2 soft buddies interested)

  session_score = 2.0 x 1.0 x 1.35 = 2.7
```

```
Comparison - Lower ranked sport with more buddies:
  Alice selects Basketball game as High interest
  Alice has 4 soft buddies who indicated interest in this session

Calculation:
  sport_multiplier = 1.0 (Basketball is rank 5 of 5)
  session_adjustment = 1.0 (High interest)
  soft_buddy_bonus = 1.0 + 0.25 + 0.10 + 0.10 + 0.10 = 1.55 (4 soft buddies interested)

  session_score = 1.0 x 1.0 x 1.55 = 1.55

Result: Gymnastics (2.7) still beats Basketball (1.55) despite fewer buddies,
because sport ranking provides strong baseline differentiation.
```

##### Scoring Formula Validation

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
  Score: 2.0 x 1.0 x 1.0 = 2.0

Session B (Low Interest, maximum buddies):
  sport_multiplier = 2.0 (same sport)
  session_adjustment = 0.4 (Low)
  soft_buddy_bonus = ??? (need > 2.5 to beat Session A)

  For B to beat A: 2.0 x 0.4 x bonus > 2.0
  Required bonus: > 2.5
  This requires: 1.0 + 0.25 + 0.10x(n-1) > 2.5 -> n > 13.5 buddies

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
  Score: 1.0 x 1.0 x 1.0 = 1.0

Session B (Low Interest, highest ranked sport, 2 buddies):
  sport_multiplier = 2.0 (rank 1 of 10)
  session_adjustment = 0.4 (Low)
  soft_buddy_bonus = 1.35 (2 buddies)
  Score: 2.0 x 0.4 x 1.35 = 1.08

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
  Score: 2.0 x 1.0 x 1.0 = 2.0

Session B (High Interest, rank 1 sport, 3 buddies):
  Score: 2.0 x 1.0 x 1.45 = 2.9

Session C (High Interest, rank 1 sport, 6 buddies):
  Score: 2.0 x 1.0 x 1.75 = 3.5

Result: Buddies provide meaningful differentiation (up to 75% boost with 6 buddies)
but with diminishing returns. This encourages attending with friends without
making solo attendance unviable.
```

#### Day Combo Score (Individual User)

Sum of session scores for all sessions in the combo:

```
day_combo_score = sum of session_scores
```

**Tie-Breaking:** If two combos have identical scores, prefer the combo with:

1. More sessions (fuller day is better)
2. If still tied, higher total sport multiplier (prioritize higher-ranked sports)
3. If still tied, alphabetical order by first session code (deterministic fallback)

#### Window Score (Individual User)

Sum of primary day combo scores across all days in the window:

```
user_window_score = sum of day_combo_scores (for each day in window)
```

**Tie-Breaking:** If two windows have identical user scores:

1. More total sessions across the window (fuller schedule is better)
2. If still tied, earlier start date

#### Group Window Score

The group score for a window balances total satisfaction with fairness:

```
group_score = total_satisfaction - (fairness_penalty x fairness_weight)

where:
  total_satisfaction = sum of user_window_scores
  fairness_penalty = standard_deviation(user_window_scores) x num_users
  fairness_weight = 0.5 (fixed)
```

**Why Standard Deviation?** We use standard deviation rather than variance because variance (the square of differences) produces penalties that can dominate the total score, leading to negative final scores for unequal distributions. Standard deviation provides a more proportionate penalty.

**Tie-Breaking:** If two windows have identical group scores:

1. Lower standard deviation (more fair distribution)
2. Higher resilience (better backup combo coverage)
3. If still tied, earlier start date

```
Example:
  Window A: Alice=50, Bob=50, Carol=50, Dave=50 -> total=200, stdev=0
  Window B: Alice=60, Bob=60, Carol=60, Dave=20 -> total=200, stdev=20

  With fairness_weight=0.5:
    Window A penalty: 0 x 4 x 0.5 = 0
    Window A score: 200 - 0 = 200

    Window B penalty: 20 x 4 x 0.5 = 40
    Window B score: 200 - 40 = 160

  Window A wins despite equal total, because it's fairer.
```

#### What Makes a Schedule "Optimal"?

A schedule is considered optimal when it maximizes the group window score, which means:

1. **High total satisfaction** - Users attend sessions they care about
2. **Fair distribution** - No single user is sacrificed for others (weighted by fairness setting)
3. **Buddy constraints satisfied** - Hard buddies attend together, soft buddies add bonuses
4. **Travel feasibility** - All day combos respect venue travel times

---

### Algorithm Steps

_Note: Steps 1-3 are user preference input (buddy constraints, sport ranking, session selection). The algorithm steps below run after ALL members have completed their preference input and the group owner triggers schedule generation._

#### Step 4: Filter Sessions by User Interest

For each user, filter the full session list to only sessions they've explicitly selected (interest level != None) and that are not excluded.

```
Input: All sessions, User's session preferences
Output: User's candidate sessions

Filter criteria:
  - session_preference row exists for this user + session
  - interest != None
  - excluded = false

Example:
  Alice selected sessions in: Gymnastics, Swimming, Track
  Alice's candidates: 12 sessions she explicitly marked as High/Medium/Low interest (excluding any with excluded = true)
```

#### Step 5: Apply Buddy Constraints, Travel Constraints, and Generate Combinations

For each user, for each day (all 19 Olympic days), generate all valid session combinations that respect buddy constraints AND travel constraints.

##### Hard Buddy Filtering

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
    - Gymnastics Final: check (Bob is interested)
    - Swimming Semi: EXCLUDED (Bob not interested)
    - Diving Prelim: check (Bob is interested)
```

**Note:** Hard buddy is one-directional. If Alice has hard_buddies=[Bob], Alice's sessions are filtered based on Bob's interests. But Bob can still attend sessions Alice isn't interested in. If both want to stay together, both should set hard_buddies pointing to each other.

##### Min Buddies Filtering

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
    - Gymnastics Final: Alice (High), Bob (High), Eve (Medium) -> 3 others interested
    - Diving Prelim: Bob (Medium) -> 1 other interested
    - Archery Semi: None -> 0 others interested

  Carol's candidates after min_buddies filter:
    - Gymnastics Final: check (3 others >= 2)
    - Diving Prelim: EXCLUDED (1 other < 2)
    - Archery Semi: EXCLUDED (0 others < 2)
```

##### Travel Gap Rules

Required gaps between sessions are based on zone proximity, determined by driving time between zones. Gaps are set to accommodate both drivers and transit users during Olympic conditions, with buffer time for venue exit, security, and entry.

| Proximity      | Driving Time | Required Gap |
| -------------- | ------------ | ------------ |
| Same zone      | 0 min        | 1.5 hr       |
| Very close     | <15 min      | 1.5 hr       |
| Close          | 15-30 min    | 2.0 hr       |
| Medium         | 30-45 min    | 2.5 hr       |
| Far            | 45-60 min    | 3.0 hr       |
| Very far       | 60-90 min    | 3.5 hr       |
| Trestles Beach | Any          | 4.0 hr       |

**Note on Trestles Beach:** The surf venue is geographically isolated with transit times of 3-6 hours from most zones. Sessions at Trestles Beach should be planned as dedicated day trips rather than combined with other venues.

##### Combination Rules

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

##### Generating Combinations

```python
def generate_all_combos(members, travel_matrix, days):
    """
    Two-pass approach: first filter all members' sessions, then generate combos
    using filtered sessions for soft buddy bonus calculation.
    """
    # Pass 1: Filter candidates for ALL members
    all_filtered = {}
    for member in members:
        all_filtered[member.id] = filter_candidate_sessions(member, members)

    # Pass 2: Generate combos using filtered sessions (including for soft buddy bonus)
    all_combos = []
    for member in members:
        filtered = all_filtered[member.id]
        for day in days:
            day_sessions = [s for s in filtered if s.date == day]
            combos = generate_day_combos(day_sessions, travel_matrix, member, all_filtered)
            all_combos.extend(assign_ranked_combos(combos, member.id, day))
    return all_combos

def generate_day_combos(user_sessions_for_day, travel_matrix, user_prefs, all_filtered_sessions, max_sessions=3):
    """
    Generate all valid session combinations for a user for a single day.

    Args:
        user_sessions_for_day: Sessions the user is interested in for this day (already filtered by hard buddy + min buddies)
        travel_matrix: Zone-to-zone travel times
        user_prefs: User's preferences (sport rankings, session interests, soft buddies)
        all_filtered_sessions: Dict mapping member_id -> list of their filtered sessions (post hard buddy + min buddies filtering)
        max_sessions: Maximum sessions per day (default 3)
    """
    combos = []

    # Generate all subsets of size 1 to max_sessions
    for size in range(1, max_sessions + 1):
        for subset in combinations(user_sessions_for_day, size):
            if is_travel_feasible(subset, travel_matrix):
                score = sum(
                    calculate_session_score(session, user_prefs, all_filtered_sessions)
                    for session in subset
                )
                combos.append((subset, score))

    # Sort by score descending
    return sorted(combos, key=lambda x: x[1], reverse=True)

def calculate_session_score(session, user_prefs, all_filtered_sessions):
    sport_multiplier = get_sport_multiplier(session.sport, user_prefs.sport_rankings)
    session_adjustment = get_session_adjustment(session, user_prefs.session_interests)
    soft_buddy_bonus = get_soft_buddy_bonus(session, user_prefs.soft_buddies, all_filtered_sessions)

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

def get_soft_buddy_bonus(session, soft_buddies, all_filtered_sessions):
    """
    Calculate soft buddy bonus based on how many soft buddies have the session in their
    FILTERED candidate set (after hard buddy + min buddies constraints are applied).
    Note: This uses post-filter interest, not raw interest. If a soft buddy expressed
    interest in a session but their own constraints (hard buddy, min buddies) removed it,
    they do not count toward the bonus — they can never actually attend that session.
    """
    buddies_interested = len([
        b for b in soft_buddies
        if session.session_code in [s.session_code for s in all_filtered_sessions.get(b, [])]
    ])
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
        return 90  # 1.5 hours for same zone

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

#### Step 6: Score Combos and Assign Primary + Backups Per Day

For each user, for each day, designate:

- **Primary combo**: Highest-scoring valid combination
- **Backup combos**: Next 2 best alternatives that introduce new sessions

Backups are pre-computed so that during ticket purchasing, buyers have immediate fallback options if:

- A session in the primary combo is sold out
- A session price exceeds the buyer's price ceiling

**Meaningful backup rule:** Each backup combo must introduce at least one new session not present in the combos above it. B1 must have at least 1 session not in P. B2 must have at least 1 session not in B1 AND at least 1 session not in P. Pure subsets are skipped because they don't offer any new fallback options — if every session in a backup is already covered by another combo, it can never help when a session from that combo is unavailable.

**Why 2 backups:** Balances coverage with complexity. 2 backups provides good coverage without excessive overhead. If no meaningful backup exists (e.g., too few sessions available that day), fewer backups are assigned rather than assigning a misleading subset.

```
Alice's July 18:
  Primary:  [Gymnastics 10am, Swimming 3pm, Track 7pm] - Score: 5.2
  Backup 1: [Gymnastics 10am, Diving 1pm] - Score: 3.9
  Backup 2: [Swimming 3pm, Basketball 6pm] - Score: 3.5
```

#### Step 6.5: Post-Generation Constraint Validation (Convergence Loop)

After combo generation (Step 6), a validation pass checks that `minBuddies` and `hardBuddies` constraints are satisfied in the **final combo output**, not just at the input filtering stage. The input filter (Step 4) uses raw interest counts which may not reflect actual combo assignments — a member may be interested in a session but not end up with it in any combo.

**Validation checks (applied to each member's PRIMARY combo sessions):**

- **minBuddies:** For each session in a member's primary combo, count how many other members have that session in ANY combo (P/B1/B2) on the same day. If `count - 1 < minBuddies`, it's a violation.
- **hardBuddies:** For each session in a member's primary combo, verify that every hard buddy has that session in ANY combo (P/B1/B2) on the same day.

**Convergence loop (max 5 iterations):**

1. Generate combos (Steps 4-6)
2. Validate post-generation constraints
3. If violations exist: prune violating sessions from candidates, then repeat from step 1
4. If no violations: converged — return results
5. If max iterations reached: return results with remaining violations

The result includes `convergence: { iterations, converged, violations }` so the caller knows whether all constraints are satisfied.

**Note:** P+B1+B2 attendance counting is intentional. A session only needs to appear in _any_ combo rank for a buddy to count as "attending" — they don't need it in their primary. This is more permissive than requiring primary-only attendance, reducing false violations.

#### Step 7: Schedule Review

After schedules are generated, members review their schedules. Members stay at `preferences_set` — there is no explicit confirmation step. The group phase moves to `schedule_review` and window rankings are computed during generation (if date config is set).

**What members review:**

- Their primary + backup combos for each day (all 19 Olympic days)
- Which sessions they got from their preferred sports
- Buddy overlap (are they attending sessions with their desired companions?)

**If a member wants changes:**

- They can update their preferences at any time during `schedule_review`
- Their `statusChangedAt` is updated, which triggers a notification to the owner
- The owner can regenerate schedules when ready
- No explicit "re-enter preferences" step — the group stays in `schedule_review`, and the owner regenerates when all members are satisfied

**Why no confirmation step:**
The confirmation step (`schedule_review_pending` → `schedule_review_confirmed` → `completed`) was removed because it added unnecessary friction. By the time users are purchasing tickets, they've implicitly accepted their schedules. Members can update preferences and the owner can regenerate at any time, making explicit confirmation redundant.

### Date Configuration

Date configuration (N-days or specific date range) is set during **group creation** (or deferred and set later) and can be changed at any time by the owner, including during the `schedule_review` phase. Date config must be set before the owner triggers schedule generation. The generation confirmation dialog encourages the owner to confirm the group has agreed on dates before proceeding.

**Input Options:**

| Mode          | Description                | Example          |
| ------------- | -------------------------- | ---------------- |
| `consecutive` | Number of consecutive days | 5 days           |
| `specific`    | Exact date range           | July 18-22, 2028 |

**Notes:**

- Changing date config does NOT require re-running the algorithm
- If `specific` mode is used, there is only one possible window (the specified dates), so window ranking produces a single result
- Date config can be adjusted in the `schedule_review` phase to explore different windows; window rankings are recomputed automatically

---

### Window Ranking

Window rankings are computed during schedule generation (as part of the `generateSchedules` action) when date config is set. Combos for all days are computed in Steps 5-6, and window ranking evaluates which N consecutive days provide the best group experience. If date config is changed after generation, window rankings are recomputed from existing combo scores without re-running the algorithm.

#### Window Scoring

For each possible N-day window:

1. Sum the primary combo scores for all users across all days
2. Apply fairness penalty (fixed weight of 0.5)

```python
FAIRNESS_WEIGHT = 0.5  # Fixed, not user-configurable

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

**Why fairness_weight = 0.5:**
At this weight, the fairness penalty is strong enough to cause ranking flips in realistic scenarios — a more balanced window can outrank a higher-total but lopsided one without requiring extreme score differences. For example, a window where everyone scores 20 points will beat a window where three people score 28-30 but one person scores only 5, even though the latter has a higher total.

#### Resilience Score (Tiebreaker)

When two windows have identical group scores and identical standard deviations, resilience breaks the tie. Resilience measures how strong each member's backup combos (B1, B2) are relative to their primary combos — higher resilience means better fallback options if sessions sell out.

```
For each member, for each day in the window:
  if primary_score > 0 and backup scores exist:
    day_coverage = (b1_score + b2_score) / (2 × primary_score)   # clamped to [0, 1]
  else:
    day_coverage = 0

resilience = average(all day_coverage values across all members and days)
```

Resilience produces a value in [0, 1] where 1 means every member's backups are as good as their primaries. It is only used as a tiebreaker — it never overrides score or fairness differences. When no backup scores are available (e.g., solo combos), resilience defaults to 0.

#### Output

```
=== RANKED 5-DAY WINDOWS ===

1. July 18-22 (Score: 48.5) <- Selected
   Alice: 12.3 pts | Bob: 11.8 pts | Carol: 11.2 pts | Eve: 13.2 pts

2. July 19-23 (Score: 45.2)
   Alice: 11.5 pts | Bob: 10.9 pts | Carol: 10.8 pts | Eve: 12.0 pts

3. July 25-29 (Score: 41.8)
   Alice: 10.2 pts | Bob: 10.5 pts | Carol: 10.1 pts | Eve: 11.0 pts
```

**Window Selection:**

- The top-ranked window is selected by default
- The owner can switch to a different window without re-running the algorithm (combos are already computed for all days)
- Switching windows simply changes which days the group is planning to attend

Note: The owner can change the N-day value and see different window rankings without re-running the algorithm.

#### Window Narrowing

As the group purchases tickets, valid windows **narrow** based on purchased session dates:

- **Filter rule:** A window is valid only if ALL purchased session dates fall within `[start, start+N-1]`
- **Top 3 valid windows** are shown in the purchase plan as tabs (consecutive mode only; specific mode has only 1 window)
- As purchases accumulate, windows that don't contain all purchased dates are eliminated
- Tabs reduce from 3 → 2 → 1 → 0 as the group commits to specific dates through purchases

**If 0 valid windows remain:**

- UI prompts the owner to increase N (more days = more windows can fit all purchased dates)
- Or switch to a specific date range that covers all purchased dates

**No blocking or locking:** Purchases are never blocked because of window conflicts. The narrowing is informational — it helps the group see which windows are still viable given their purchases. If a purchase falls outside all valid windows, the window count simply drops.

**Combos still exist for all 19 days:** The schedule page shows everything. The purchase plan only shows combos for days within the selected window tab. Extra purchases outside the window go through the Purchased Tickets tab directly.

#### Re-generation and Windows

When re-generation occurs:

- Combos are recomputed for all 19 days (unchanged behavior)
- Window ranking is recomputed with the purchased-date filter applied
- If the previously selected window is still valid, it remains selected
- Purchased sessions outside all valid windows: shown on schedule + Purchased Tickets tab, don't affect window ranking, noted as "outside attendance window"

---

## Phase 1 Output

The output of Phase 1 feeds directly into Phase 2. For each member:

- **Primary + backup combos** for each of the 19 Olympic days
- **Window rankings** showing which N-day windows are optimal for the group (top 3 if consecutive mode, 1 if specific mode)

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
- Sessions appear ONCE (no duplication), with combo tags showing membership

**Filtering:**

- Filter dropdown: All (default), Primary, Backup 1, Backup 2
- Filtering shows only sessions in the selected combo

**Click to Expand:**
Clicking any session opens a modal with:

- Full session details (sport, event, venue, zone, date, time)
- Combo tags (which combos include this session)
- Other group members who have this session in their combos

**Example:**

```
JULY 18                                    Filter: [All v]

10:00 +---------------------------------------------+
      | Gymnastics Women's Final    [P] [B1] [B2]  |
      | DTLA Zone                                   |
      +---------------------------------------------+

15:00 +---------------------------------------------+
      | Swimming 100m Final         [P] [B1]       |
      | Long Beach Zone                             |
      +---------------------------------------------+

19:00 +---------------------------------------------+
      | Track 200m Semi             [P] [B2]       |
      | Exposition Park Zone                        |
      +---------------------------------------------+
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

**Filtering:**

- Filter by user: All (default), or select specific user(s)
- Filtering shows only sessions the selected user(s) are attending (primary OR backup)

**Click to Expand:**
Clicking any session opens a modal with:

- Full session details
- All users attending (which combo)

**Window Information:**

- Selected window displayed (e.g., "July 18-22")
- Window rankings shown (users can switch windows without re-running algorithm)
- Confirmation status for each user

**Asterisk Notation:** If a user has the session in BOTH their primary and a backup combo, their name appears with an asterisk (\*) in the Primary list only. This avoids duplication while indicating they have the session in multiple combos.

**Example:**

```
+-------------------------------------------------------------+
| GROUP SCHEDULE                                              |
+-------------------------------------------------------------+
|  Selected Window: July 18-22                                |
|                                                             |
|  Window Rankings:              Confirmation Status:         |
|  1. July 18-22 <- Selected      check Alice (confirmed)    |
|  2. July 19-23                   check Bob (confirmed)     |
|  3. July 25-29                   check Carol (confirmed)   |
|                                  check Eve (confirmed)     |
+-------------------------------------------------------------+
|                                                             |
|  JULY 18                            Filter by user: [All v] |
|                                                             |
|  10:00 +--------------------------------------------+       |
|        | Gymnastics Women's Final                   |       |
|        | DTLA Zone                                  |       |
|        | Primary: Alice*, Bob*, Carol*, Eve*        |       |
|        | Backup: -                                  |       |
|        | (* = also in backup combo)                 |       |
|        +--------------------------------------------+       |
|                                                             |
|  15:00 +--------------------------------------------+       |
|        | Swimming 100m Final                        |       |
|        | Long Beach Zone                            |       |
|        | Primary: Alice*, Bob                       |       |
|        | Backup: Carol, Eve                         |       |
|        +--------------------------------------------+       |
|                                                             |
+-------------------------------------------------------------+
```

---

## Per User Summary

Each user sees their schedule with the following sections:

### Schedule Calendar

Shows primary combo + 2 backup combos for each day, with session details (time, venue, zone).

```
=== ALICE'S SCHEDULE ===

Window: July 18-22 (Primary)

JULY 18:
  Primary Combo (Score: 5.2):
    09:00-12:00  Gymnastics Women's Final    DTLA Zone
    15:00-17:30  Swimming 100m Final         Long Beach Zone
    19:30-22:00  Track 200m Semi             Exposition Park

  Backup 1 (Score: 4.1):
    09:00-12:00  Gymnastics Women's Final    DTLA Zone
    15:00-17:30  Swimming 100m Final         Long Beach Zone

  Backup 2 (Score: 3.8):
    09:00-12:00  Gymnastics Women's Final    DTLA Zone
    19:30-22:00  Track 200m Semi             Exposition Park

JULY 19:
  Primary Combo (Score: 4.8):
    ...
```

### Per Session Summary

```
=== SESSION: GYM-WFINAL-0803 ===

Gymnastics Women's All-Around Final
July 18, 2028 | 09:00-12:00 | DTLA Zone

Interested Users:
  Alice - Interest: High, Score: 2.7
  Bob   - Interest: High, Score: 2.1
  Carol - Interest: Medium, Score: 1.2
  Eve   - Interest: High, Score: 2.4
```

**Note:** Buddy constraints (hard buddies, min buddies) are enforced during combo generation — sessions that violate these constraints are automatically filtered out and never appear on the schedule. No separate buddy status display is needed.

---

## Phase 2: Ticket Purchase Plan

### Overview

After Phase 1 generates the optimal schedule and the group selects a window, Phase 2 helps members plan their ticket purchases. Members with purchase timeslots create a combo-based purchase plan with price ceilings and "buy for others" assignments.

### Data Flow: Phase 1 -> Phase 2

```
Phase 1 Output                     Phase 2 Input
-----------------                   -----------------
Member schedules (P/B1/B2)    ->    Combos to purchase (per day)
Valid windows (top 3 consecutive / 1 specific) -> Which days to show in plan
Buddy overlap data            ->    Who else wants each session
```

### Timeslot Assignment

Not every member gets a purchase timeslot. Each person has a **12-ticket limit** across all groups. Members who get timeslots become responsible for purchasing tickets — potentially for other members too.

Timeslot assignment is managed outside the app (Olympic ticket lottery system). Members record their timeslot in the app so the group can coordinate.

### 3-Window Purchase Plan

**Consecutive mode only:** When the group uses `consecutive` date mode, the purchase plan displays the **top 3 valid windows** as tabs, mirroring the P/B1/B2 combo pattern. Each tab shows the full combo-based plan for that window's days only (not all 19 days). In `specific` date mode, there is only one window (the specified dates), so only one tab is shown.

- **Window tabs** reduce as purchases narrow valid windows: 3 → 2 → 1 → 0
- If **0 valid windows** remain: UI prompts owner to increase N or switch to specific date range
- **Price ceilings are shared** for sessions that appear in multiple windows (overlapping days) — one ceiling per session, not per window

### Combo-Based Purchase Plan

The purchase plan is structured by **day**, not as a flat session list. The plan uses the **buyer's own combos** (not the assignees') — derived at query time from the existing `combo`/`comboSession` tables. The `purchase_plan_entry` table stores session-level data (price ceiling, buy-for assignments); the combo structure comes from the generated schedule. For each day within the selected window tab:

- **Primary combo** is the purchase target — buy all sessions in this combo
- **B1 and B2** are fallback combos — if any session in the primary is unavailable or above ceiling, consider B1 then B2
- The buyer attempts all sessions in the primary combo for a day; if any are unavailable or above the price ceiling, they fall back to B1, then B2
- **"Buy for others"** is limited to group members who are also interested in that session (interest level != None). Who to buy for is a group discussion that happens before the purchase window.

### Price Ceilings

Price ceilings are **freeform currency inputs** — the buyer enters a dollar amount per session (e.g., `$275`). No buckets or dropdowns.

- One ceiling per session (applies to all tickets for that session, regardless of who they're for)
- Ceiling is optional — null means no limit
- Purpose: during the actual purchase window, the buyer can quickly reference their plan — if a session is priced above their ceiling, skip it and move to the next combo or fallback

### Priority Ordering

Days within the purchase plan are **auto-ordered by primary combo score (highest first)**, with sessions within each day ordered by score. The plan is naturally structured by day since combos are day-based.

- Default order is score-based — highest-value days first, so the buyer prioritizes what matters most if their timeslot is limited
- No manual reordering — the score-based default is the only order

### Purchase Plan Example

```
=== ALICE'S PURCHASE PLAN ===

[Window 1: Jul 18-22] [Window 2: Jul 19-23] [Window 3: Jul 25-29]

JULY 18 (Window 1):
  Buy: [Gymnastics 10am, Swimming 3pm, Track 7pm]  (Primary)
       Gymnastics: $___   buy for: [you, Bob]
       Swimming:   $___   buy for: [you]
       Track:      $___   buy for: [you, Eve]

  Fallback B1: [Gymnastics 10am, Swimming 3pm]
  Fallback B2: [Gymnastics 10am, Track 7pm]

JULY 19 (Window 1):
  Buy: [Diving 10am, Swimming 3pm]  (Primary)
       Diving:   $___   buy for: [you, Carol]
       Swimming: $___   buy for: [you]

  Fallback B1: [Diving 10am]
  Fallback B2: [Swimming 3pm, Track 7pm]

JULY 20 (Window 1):
  ...
```

**Prompt text:**

> "Set your price ceiling for each session. (Optional) This will help you quickly determine whether to buy tickets or skip if a session is above your ceiling. You can also select other group members to buy tickets for."

### What Happens When Buddy Constraints Conflict on Price

If Alice and Bob are hard buddies and are assigned to the Gymnastics Final together, but during purchase planning Alice discovers Bob's price ceiling is much lower than expected:

- **This is a conversation, not an algorithm problem.** Alice and Bob discuss it.
- If they can't agree, the member with the constraint has two options:
  1. **Exclude the session** from their schedule and re-generate (the session won't appear in future schedules)
  2. **Update buddy constraints** (remove or change the hard buddy) and re-generate

Re-generation preserves any purchased session locks (see Phase 3).

---

## Phase 3: Purchase Tracking & Re-generation

### Overview

Phase 3 tracks actual ticket purchases and supports iterative re-generation as the group's situation evolves (sessions sold out, tickets purchased, budget adjustments).

### Data Flow: Phase 2 -> Phase 3

```
Phase 2 Output                     Phase 3 Input
-----------------                   -----------------
Combo-based purchase plan     ->    What to buy (day by day)
Price ceilings (per session)  ->    Buy/skip decisions
"Buy for others" assignments  ->    Who gets which tickets
Valid windows (narrowed)      ->    Which windows remain viable
```

### Purchase Recording

When a member purchases tickets, they record the purchase in the app:

| Field              | Description                       | Example           |
| ------------------ | --------------------------------- | ----------------- |
| `session_id`       | Which session                     | "GYM-WFINAL-0803" |
| `price_per_ticket` | Actual price paid                 | $275              |
| `quantity`         | Number of tickets                 | 3                 |
| `assignees`        | Which members the tickets are for | [Alice, Bob, Eve] |

**Effects of recording a purchase:**

- Session is **locked** for all assignees — survives re-generation
- Assignees' ticket counts increment toward the 12-ticket limit
- Budget tracking updates (spent vs. remaining)

### Purchased Session Locks

Purchased sessions are fixed constraints in the algorithm. They act as **hard day-level constraints** that eliminate infeasible candidates before combo generation:

1. **Pre-filter candidates per day:** For each day, identify locked sessions. Remove any non-locked candidate session that violates the travel gap requirement with ANY locked session on that day. This ensures no infeasible session appears anywhere in the schedule (P, B1, or B2).
2. **Required in every combo:** Locked sessions are mandatory members of every combo on their day. Combos are generated from locked sessions + remaining feasible candidates.
3. **Count toward max 3/day:** Locked sessions consume combo slots (e.g., 2 locked sessions → only 1 remaining slot for candidates).
4. **Cannot be removed by re-generation.**

Example: User has a locked session at 10:00-12:00 in DTLA. A candidate session at 13:00 in Long Beach requires a 150-min gap but only has 60 min — it is removed from that day's candidates entirely and will not appear in any combo.

### Sold-Out Sessions

Any member can mark a session as sold out (group-scoped):

- Sold-out sessions are excluded from future re-generations
- If a member's primary combo contains a sold-out session (and it wasn't purchased), re-generation is needed

### Re-generation Triggers

Members may re-generate schedules when:

1. **Sessions sold out** — sold-out sessions need to be replaced
2. **Preference changes** — member excludes a session or updates buddy constraints after purchase plan discussions
3. **New purchases change constraints** — purchased sessions lock slots, potentially affecting remaining optimization

**Re-generation rules:**

- Purchased sessions are locked — candidates that violate travel constraints against locked sessions are eliminated before combo generation (see Purchased Session Locks above)
- Sold-out sessions (unpurchased) are excluded from candidates
- `excluded` flags are preserved (sessions a user chose to exclude stay excluded)
- Note: `hardBuddyOverride` and `minBuddyOverride` columns have been removed — users adjust constraints directly
- Everything else is re-optimized around the fixed constraints

### Budget Tracking

Budget is set at the **user level** (not per-group), editable anytime in user settings. It does NOT affect the algorithm. Since ticket quantities are tracked globally (12-ticket limit across all groups), budget is also global.

```
=== ALICE'S BUDGET ===

Budget: $500
Spent: $275 (Gymnastics Final x1)
Remaining: $225

Upcoming (from purchase plan):
  Swimming 100m Final - Ceiling: <$200
  Track 200m Semi - Ceiling: <$150
  Total if at ceiling: $350 -> Over budget by $125
```

### 12-Ticket Limit

Each user has a global 12-ticket limit across all groups. The app tracks:

- Tickets assigned to the user (via `ticket_purchase_assignee` rows)
- Count across all groups
- Warning when approaching limit

**Multi-group warning:** Users can join multiple groups, but the app displays a warning: "It's not recommended to join multiple groups since optimal schedules are only generated at the group level." The algorithm optimizes within a single group and has no cross-group coordination.

### Extra Purchases

Members can purchase tickets for sessions NOT in their algorithm output (e.g., a session they discover while browsing). These are recorded the same way and show on the schedule as locked sessions. On re-generation, they're treated as fixed constraints.

---

## Data Flow Summary

```
PHASE 1: SCHEDULE GENERATION
  Input:  Interest levels, sport rankings, buddy constraints
  Output: P/B1/B2 combos per day, window rankings (top 3 if consecutive, 1 if specific)
          |
          | Members confirm schedules
          v
PHASE 2: TICKET PURCHASE PLAN
  Input:  Phase 1 combos (per day), valid windows (top 3 / 1), buddy overlap data
  New:    Price ceilings (freeform $ per session), combo-based purchase plan
  Output: Day-by-day combo plan with price limits, "buy for others" assignments
          |
          | Members purchase tickets during their timeslots
          | Valid windows narrow as purchases accumulate
          v
PHASE 3: PURCHASE TRACKING & RE-GENERATION
  Input:  Phase 2 purchase plan, actual ticket purchases
  New:    Purchase records, sold-out flags, budget tracking
  Output: Updated schedules (with locks), budget status, ticket counts
          |
          | Loop back: re-generate if needed (sold out, preference changes)
          | Window rankings recomputed with purchased-date filter
          v
  RE-GENERATION (back to Phase 1 algorithm, with purchased locks as fixed constraints)
```

---

## Complexity Analysis

### Computational Bounds

| Step            | Complexity              | Notes                |
| --------------- | ----------------------- | -------------------- |
| Filter sessions | O(S x U)                | S=sessions, U=users  |
| Generate combos | O(S^3) per user per day | Max 3-session combos |
| Rank windows    | O(W x U x D)            | W=windows, D=days    |

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

### Two Purchased Sessions Not Travel-Feasible

If a member has two purchased sessions on the same day that aren't travel-feasible together:

- Show a UI warning at purchase time, but no formal conflict tracking in the DB
- The sessions remain locked (they're purchased, can't undo)
- User acknowledges the conflict — they'll need to choose which to attend on the day

# LA 2028 Olympics Group Scheduler - Design Decisions & Tradeoffs

This document captures key design decisions made during the development of the LA 2028 Olympics Group Scheduler algorithm, including alternatives considered and rationale for the chosen approach.

---

## Key Design Principles

These are the high-level principles that guide the algorithm design:

- **Budget is shown, not filtered.** Phase 1 generates the optimal schedule regardless of budget constraints. Budget impact is displayed so users can see what they might need to skip, but sessions are not automatically removed. This keeps Phase 1 focused on "what's best" while Phase 2 handles "what's feasible."

- **Date config is set at group creation or deferred, required before generation.** The owner sets the date configuration (N consecutive days or a specific date range) at group creation or defers it to discuss with the group. Date config must be set before the owner triggers schedule generation. It can be changed at any point — including after schedules are finalized — without re-running the algorithm, since it only affects window ranking.

- **Fairness weight is fixed.** The algorithm uses a fixed fairness weight of 0.25 to balance total group satisfaction with equal distribution. This prevents scenarios where one user has a significantly worse experience than others.

- **Implicit schedule acceptance.** After schedules are generated, users review the output. There is no explicit confirmation step — members implicitly accept by proceeding. If unsatisfied, they can re-enter preferences and the owner can re-generate.

- **Consolidated phases.** The algorithm was originally designed as multiple discrete phases (filtering, combo generation, window ranking, buying). We consolidated all preference selection and optimization into Phase 1, with Phase 2 focused solely on buy-time execution. This creates a cleaner mental model: Phase 1 = what's optimal, Phase 2 = how to buy it.

- **No separate setup phase.** The group starts in the `preferences` phase on creation. Members can join and immediately begin entering preferences. The owner gates schedule generation, which is the real checkpoint where all preconditions are validated.

---

## Detailed Design Decisions

### Decision 1: Budget Shown, Not Filtered

**The Question:** Should Phase 1 filter out sessions that exceed a user's budget?

**We Chose:** Show budget impact, don't filter

**Why:**

- Session prices aren't known until purchase time. Actual prices might be lower than expected.
- Budget is a "soft" constraint - users might flex it for important events.
- Separates concerns: Phase 1 = what's optimal, Phase 2 = what's feasible.
- Users see what they're missing and can make informed tradeoffs.

---

### Decision 2: Ordered Sport Ranking Instead of Interest Buckets

**The Question:** How should users express sport preferences?

**Alternatives Considered:**

1. Interest buckets (Must-See, High, Medium, Low)
2. Ordered ranking (1st, 2nd, 3rd...)

**We Chose:** Ordered ranking

**Why:**

- Forces differentiation - users can't mark everything as "High Interest"
- Creates clear algorithmic signal through dynamic multipliers
- Intuitive UX - drag-and-drop ranking is a familiar pattern
- Eliminates need for artificial constraints like "max 2 Must-See sports"

---

## Decision 3: Session Interest Defaults to None (Opt-In)

**The Question:** Should sessions inherit interest from their sport, or default to "not interested"?

**We Chose:** Default to None, require explicit opt-in

**Why:**

- Users may love a sport but not want to attend all sessions (e.g., want Gymnastics finals but not qualifications)
- Avoids tedious "uncheck 40 sessions I don't care about" workflow
- Makes user intent explicit - if they selected it, they want it
- Reduces noise in the algorithm - only considers sessions users actively chose

---

---

## Decision 5: Soft Buddy Bonus with Diminishing Returns

**The Question:** How should multiple soft buddies affect scoring?

**We Chose:** First buddy = +0.25x, each additional = +0.10x, no cap

**Why:**

- First buddy has biggest impact on experience (alone vs. with a friend)
- Additional buddies add value but with diminishing returns
- No cap needed - sport multiplier differential naturally limits runaway scores
- Multiplicative application means bonus scales with session importance

---

## Decision 6: Dynamic Sport Multiplier Based on Selection Count

**The Question:** How should sport ranking translate to multipliers when users select different numbers of sports?

**We Chose:** Scale multipliers so rank 1 = 2.0x and last rank = 1.0x, regardless of how many sports selected

**Why:**

- Consistent scoring regardless of whether user picked 3 or 10 sports
- Ranking signal remains meaningful at any selection count
- Simple formula: `multiplier = 2.0 - ((rank - 1) / (n - 1)) * 1.0`
- Edge case handled: if n=1, multiplier = 2.0

---

## Decision 7: Hard Buddy and Min Buddies as Constraints, Not Preferences

**The Question:** Should hard_buddy and min_buddies affect scoring or act as hard constraints?

**We Chose:** Hard constraints (sessions invalid if not satisfied)

**Why:**

- "I must attend with Bob" means exactly that - not "I'd prefer to attend with Bob"
- Soft buddies handle the preference case with bonus scoring
- Clear separation: constraints define valid solutions, preferences rank them
- Makes algorithm behavior predictable and explainable

---

## Decision 8: Proximity-Based Gap Rules

**The Question:** How should we determine required gaps between sessions at different venues?

**Alternatives Considered:**

1. Calculate exact travel time + buffer for each zone pair
2. Use simple proximity buckets based on driving time

**We Chose:** Simple proximity buckets

**Why:**

- Travel times vary significantly based on mode (driving vs transit), time of day, and Olympic conditions
- Calculating "exact" gaps creates false precision — too many unknowns
- Simple buckets based on driving time are easy to understand and implement
- Gaps are set generously to accommodate both drivers (with Olympic traffic) and transit users

**Gap Design Principles:**

- Use driving time to categorize zone proximity (easy lookup)
- Set gaps that work for transit users too (transit is 2-4x slower than driving)
- Include buffer for venue logistics (exit, security, entry, finding seats)
- Be realistic but not overly restrictive

**Feasibility:**

- 98% of zone pairs (excluding Trestles Beach) support 3 sessions/day
- Only Trestles Beach requires special handling due to geographic isolation

**Special Case — Trestles Beach:**

- The surf venue has 3-6 hour transit times from most zones
- Fixed 4-hour gap for any Trestles pair
- Users should plan surf events as dedicated day trips

---

## Decision 9: Fixed Fairness Weight (0.5)

**The Question:** Should users be able to adjust how much fairness matters in window scoring?

**Alternatives Considered:**

1. User-configurable fairness weight (0 to 1)
2. Fixed fairness weight

**We Chose:** Fixed at 0.5

**Why:**

- At 0.5, the algorithm meaningfully penalizes unequal distributions — preventing scenarios where one user has a significantly worse experience
- Avoids overwhelming users with settings they may not understand
- If users are unsatisfied with results, the issue is likely their constraints or preferences, not the fairness weight
- Simplifies the UX

---

## Decision 10: Date Config at Group Creation with Defer Option

**The Question:** When should users specify how many days they want to attend?

**Alternatives Considered:**

1. After schedule review, right before window ranking
2. At group creation with a separate `setup` phase that blocks preferences until date config is set
3. At group creation with defer option, required before generation

**We Chose:** At group creation with defer option, required before generation

**Why:**

- Encourages early date agreement without blocking preference input — members can join and start entering preferences immediately
- Owner can set dates at creation if already agreed, or defer to discuss with the group first
- Generation endpoint validates date config is set, so it can't be forgotten
- Generation confirmation dialog encourages the owner to confirm group agreement on dates: "Has the group agreed on [5 consecutive days]? To prevent coordination efforts later, please ensure agreement."
- N-days / date range only affects window ranking, not combo generation — combos are computed for all 19 Olympic days regardless
- Date config can be changed at any point (including after schedules are finalized) and see different window rankings without re-running the algorithm
- Date config changes are owner-only to prevent uncoordinated changes

---

## Decision 11: Remove Explicit Schedule Confirmation Step

**The Question:** Should users explicitly confirm they're satisfied with their generated schedule before the group can proceed?

**We Chose:** Remove the confirmation step — members implicitly accept the schedule

**Why:**

- The confirmation step added unnecessary friction without meaningful benefit. Users who are unhappy can still re-enter preferences and trigger a re-generation — the same escape hatch exists without requiring explicit confirmation from every member.
- Waiting for all members to confirm before computing window rankings blocked progress unnecessarily. Window rankings are now computed during generation itself, so owners can immediately review and select a window.
- The `schedule_review_pending` and `schedule_review_confirmed` statuses, and the `completed` phase, are removed entirely. Members stay at `preferences_set` through the schedule review phase.
- Preferences edits during `schedule_review` are detected by comparing `statusChangedAt > scheduleGeneratedAt`, not by resetting member status.

---

## Decision 12: No Session-Level Buddy Constraint Override

**The Question:** Can users override their buddy constraints for specific sessions?

**We Chose:** No — removed per-session overrides (`hardBuddyOverride`, `minBuddyOverride` columns)

**Why:**

- The post-generation convergence loop handles constraint satisfaction by iteratively pruning sessions that violate buddy constraints, making per-session overrides unnecessary
- Users adjust constraints directly instead: switching hard buddies to soft, or lowering minBuddies
- Simpler mental model — constraints are set once in the preference wizard, not tweaked per-session after generation

---

## Decision 14: No Separate Setup Phase

**The Question:** Should the group have a dedicated `setup` phase before members can enter preferences?

**Alternatives Considered:**

1. Separate `setup` phase with explicit owner trigger to open preferences (requires all members joined and date config set before anyone can enter preferences)
2. No separate phase — group starts in `preferences`, owner gates generation

**We Chose:** No separate setup phase

**Why:**

- The owner already gates schedule generation — that's the real checkpoint where all preconditions are validated (all members have submitted preferences, no pending requests, date config set)
- A separate setup phase added a ceremony step ("open preferences") that didn't protect against anything the generation gate doesn't already catch
- Members can join and start entering preferences immediately, which mirrors real behavior — friend groups coordinate outside the app and join at different times
- Date config doesn't need to block preferences because it only affects window ranking, not preference input or combo generation
- The generation confirmation dialog surfaces date agreement at the right moment — when the owner is about to commit the group to schedule generation
- Fewer phases means a simpler mental model for users

---

## Decision 15: Preference Viewing vs. Editing Access

**The Question:** Should users be able to view their preferences at any phase, or only during preference input?

**We Chose:** Users can view preferences at any phase; editing is restricted to the preference input phase

**Why:**

- Users may want to reference their sport rankings, buddy constraints, or session selections during schedule review
- Read-only access during later phases prevents accidental edits that would trigger a full re-run
- If a user needs to change preferences after generation, they must explicitly re-enter the preference wizard (which resets the group)

---

## Decision 16: Owner-Gated Date Config and Window Operations

**The Question:** Who should be able to change date configuration and manage window selection?

**We Chose:** Owner only for date config changes, window computation, and window selection

**Why:**

- Date config affects the entire group's window rankings — uncoordinated changes could be confusing
- Consistent with the pattern of owner-gating group-wide decisions (generation, join approval, deletion)
- The owner acts as the group's coordinator — they discuss with the group, then execute the agreed-upon change
- Window computation happens at schedule generation; window selection happens in `schedule_review` — these should be deliberate, coordinated actions

---

## Decisions Deferred to Future Phases

1. **Budget tracking** — Removed from current scope. May revisit in a future phase.
2. **12-ticket global limit** — Removed from current scope. May revisit in a future phase.
3. **How to coordinate between multiple timeslot holders?**
4. **Minimum tickets based on buyer's buddy constraints**

---

## Phase 1 vs Phase 2 Summary

| Aspect        | Phase 1 (Schedule Optimization)   | Phase 2 (Purchase Tracking)                                        |
| ------------- | --------------------------------- | ------------------------------------------------------------------ |
| **Goal**      | What's OPTIMAL                    | Track what's PURCHASED                                             |
| **Output**    | P/B1/B2 combos + window rankings  | Purchase records, price reports, sold-out/OOB tracking             |
| **Algorithm** | Generates combos from preferences | Re-generates with purchased sessions locked, sold-out/OOB excluded |

Phase 1 output feeds into Phase 2:

- Backup combos provide fallback options
- Ranked windows allow pivoting if primary window fails
- Purchase tracker organizes sessions by combo priority

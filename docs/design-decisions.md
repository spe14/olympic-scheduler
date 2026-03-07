# LA 2028 Olympics Group Scheduler - Design Decisions & Tradeoffs

This document captures key design decisions made during the development of the LA 2028 Olympics Group Scheduler algorithm, including alternatives considered and rationale for the chosen approach.

---

## Key Design Principles

These are the high-level principles that guide the algorithm design:

- **Budget is shown, not filtered.** Phase 1 generates the optimal schedule regardless of budget constraints. Budget impact is displayed so users can see what they might need to skip, but sessions are not automatically removed. This keeps Phase 1 focused on "what's best" while Phase 2 handles "what's feasible."

- **Willingness is a soft filter with conflict resolution.** Users specify their max willingness per session via price buckets, but this doesn't automatically exclude them. Instead, we flag conflicts where willingness thresholds create buddy constraint issues, allowing users to discuss and adjust before finalizing.

- **Date config is set at group creation or deferred, required before generation.** The owner sets the date configuration (N consecutive days or a specific date range) at group creation or defers it to discuss with the group. Date config must be set before the owner triggers schedule generation. It can be changed at any point — including after schedules are finalized — without re-running the algorithm, since it only affects window ranking.

- **Fairness weight is fixed.** The algorithm uses a fixed fairness weight of 0.25 to balance total group satisfaction with equal distribution. This prevents scenarios where one user has a significantly worse experience than others.

- **Satisfaction check before conflict resolution.** After schedules are generated, users review and confirm they're satisfied before entering the conflict resolution phase. If unsatisfied, they can adjust preferences and re-run.

- **Consolidated from 4-5 phases to 2 phases.** The algorithm was originally designed as multiple discrete phases (filtering, combo generation, config calculation, window ranking, buying). We consolidated all preference selection and optimization into Phase 1, with Phase 2 focused solely on buy-time execution. This creates a cleaner mental model: Phase 1 = what's optimal, Phase 2 = how to buy it.

- **No separate setup phase.** The group starts in the `preferences` phase on creation. Members can join and immediately begin entering preferences. The owner gates schedule generation, which is the real checkpoint where all preconditions are validated.

---

## Detailed Design Decisions

### Decision 1: Budget Shown, Not Filtered

**The Question:** Should Phase 1 filter out sessions that exceed a user's budget?

**We Chose:** Show budget impact, don't filter

**Why:**

- Willingness prices are maximums, not actual prices. Actual prices might be lower.
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

## Decision 4: Willingness Set at Session Level Only

**The Question:** How should users express willingness to pay?

**Alternatives Considered:**

1. Sport-level willingness with session overrides
2. Session-level willingness only

**We Chose:** Session-level willingness only

**Why:**

- There can be significant variety within a sport (e.g., Track has running events and field events)
- Users may have very different willingness for different sessions within the same sport
- Simpler model - no inheritance or override logic needed
- More accurate representation of user preferences

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

## Decision 9: Fixed Fairness Weight (0.25)

**The Question:** Should users be able to adjust how much fairness matters in window scoring?

**Alternatives Considered:**

1. User-configurable fairness weight (0 to 1)
2. Fixed fairness weight

**We Chose:** Fixed at 0.25

**Why:**

- At 0.25, the algorithm prefers equal distribution when one user would otherwise have a significantly worse experience
- Avoids overwhelming users with settings they may not understand
- If users are unsatisfied with results, the issue is likely their constraints or preferences, not the fairness weight
- Simplifies the UX

---

## Decision 10: Date Config at Group Creation with Defer Option

**The Question:** When should users specify how many days they want to attend?

**Alternatives Considered:**

1. After conflict resolution, right before window ranking
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

## Decision 11: Satisfaction Check Before Conflict Resolution

**The Question:** Should users go directly into conflict resolution after schedules are generated?

**We Chose:** Add a satisfaction check step first

**Why:**

- If a user is fundamentally unhappy (e.g., barely got sessions from their top sport), better to address before detailed conflict work
- Adjusting preferences and re-running is cleaner than trying to fix a bad schedule through conflict resolution
- Prevents wasted effort on conflicts that become irrelevant after a re-run

---

## Decision 12: Conflict Resolution Options as Guidance, Not Actions

**The Question:** Should conflict resolution options be clickable actions or informational guidance?

**We Chose:** Informational guidance

**Why:**

- Multiple users might need to coordinate (e.g., both adjust to meet in the middle)
- The suggested resolution amount might not be exactly what users want
- Users already have UI controls for adjusting willingness, removing sessions, etc.
- Guidance encourages discussion; clickable actions might lead to uncoordinated changes

---

## Decision 13: Session-Level Buddy Constraint Override

**The Question:** Can users override their buddy constraints for specific sessions?

**We Chose:** Yes, allow session-level overrides

**Why:**

- Circumstances change - user might decide "I originally wanted to go with Alice, but I'll go alone for this one"
- Avoids forcing a full re-run just to relax a constraint for one session
- Override applies to that session only; other sessions still respect original constraint
- Overrides are cleared on algorithm re-run (preference changes should be explicit)

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

## Decision 15: Viable Configs Computed Only for Combo Sessions

**The Question:** Should viable configurations be computed for ALL sessions a user is interested in, or only sessions that appear in a user's combos (primary, backup1, backup2)?

**Alternatives Considered:**

1. Compute for all sessions any user has interest in (broader Phase 2 coverage)
2. Compute only for sessions in combos (tighter scope, cleaner conflict resolution)

**We Chose:** Compute only for sessions in combos

**Why:**

- Avoids computing configs for sessions that never appear on anyone's calendar
- Conflicts are only flagged for sessions in combos, so viable configs for non-combo sessions would never surface in conflict resolution
- Keeps the conflict resolution UI clean — users only see conflicts for sessions they can actually see on their calendar
- For Phase 2, viable configs can be recomputed on-demand for any session if a buyer pivots to a session outside the pre-computed set
- Computational cost is trivial either way, but the tighter scope reduces noise

---

## Decision 16: Budget Input at Member Level During Buddy Preferences Step

**The Question:** When and how should users specify their overall budget?

**Alternatives Considered:**

1. Collect budget at group join time
2. Collect budget as its own preference wizard step
3. Collect budget alongside buddy preferences (first wizard step)

**We Chose:** Collect budget alongside buddy preferences

**Why:**

- Budget is a per-group setting (a user might have different budgets for different friend groups)
- Buddy preferences are the lightest wizard step — adding budget here keeps it simple without adding a separate step
- Budget needs to be set before session selection so users have it in mind when setting willingness
- Budget is shown (not filtered) so it doesn't need to be collected with high precision — it's a reference point

---

## Decision 17: Preference Viewing vs. Editing Access

**The Question:** Should users be able to view their preferences at any phase, or only during preference input?

**We Chose:** Users can view preferences at any phase; editing is restricted to the preference input phase

**Why:**

- Users may want to reference their sport rankings, buddy constraints, or session selections during schedule review or conflict resolution
- Read-only access during later phases prevents accidental edits that would trigger a full re-run
- If a user needs to change preferences after generation, they must explicitly re-enter the preference wizard (which resets the group)

---

## Decision 18: Soft Buddy Score Recalculation on Session Removal

**The Question:** When a user removes a session during conflict resolution, should we recalculate combo scores for other users whose soft buddy bonuses are affected?

**We Chose:** Yes, recalculate scores for all affected users

**Why:**

- Keeps combo scores accurate — stale scores could lead to incorrect window rankings
- The recalculation is computationally trivial (re-run scoring formula for affected sessions)
- Even though combo composition doesn't change (same sessions, different scores), accurate scores matter for window ranking in the `completed` phase
- Score changes during conflict resolution don't trigger combo re-generation — they only update the numeric scores on existing combos

---

## Decision 19: Soft-Exclude on Session Removal (Preserve Preferences for Re-Generation)

**The Question:** When a user removes a session during conflict resolution, should we delete their preference data or preserve it?

**Alternatives Considered:**

1. Delete the `session_preference` row (hard delete) — session is permanently gone until user re-enters the preference wizard
2. Set an `excluded` flag (soft delete) — session is excluded from current schedule but preference data is preserved for re-generation

**We Chose:** Soft-exclude with `excluded = true`

**Why:**

- Session removal during conflict resolution is a schedule-scoped decision ("I don't want this in my current schedule"), not a permanent preference change ("I'm no longer interested in this session at all")
- If the algorithm is re-run (e.g., because another member changed preferences), group dynamics may have changed — more people might be interested now, buddy constraints might be different, and the previously-removed session might be a good fit in the new schedule
- Willingness adjustments already survive re-generation naturally (they modify the `session_preference` row). Soft-exclude brings session removals to the same level — all conflict resolution actions are preserved and reconsidered on re-run
- Permanent removal still happens through the preference wizard (Step 3), where deselecting a session deletes the row entirely
- The `excluded` flag is reset to `false` during re-generation alongside override flags, so all sessions get a fresh evaluation

**Implementation:**

- `excluded` boolean on `session_preference` (DEFAULT false)
- Conflict resolution "remove session" sets `excluded = true`
- Algorithm Step 4 filters out sessions where `excluded = true`
- Excluded sessions do not count toward soft buddy bonuses or min_buddies checks
- Re-generation resets `excluded = false` for all members

---

## Decision 20: Conflicts Shown to Both Affected and Causing Members

**The Question:** Should conflicts be visible only to the affected member, or to both the affected and causing member?

**We Chose:** Show to both parties

**Why:**

- Conflict resolution is collaborative — the causing member often needs to act (e.g., raise their willingness) to resolve the conflict
- Without visibility, the causing member only knows about the conflict if the affected member tells them outside the app
- Showing all resolution options to both parties enables them to coordinate: "I'll raise my willingness to $150 if you lower yours to $200"
- For `min_buddies_failure` conflicts (no single causing member), the conflict is shown to the affected member and all members whose willingness affects the constraint

---

## Decision 21: Owner-Gated Date Config and Window Operations

**The Question:** Who should be able to change date configuration and manage window selection?

**We Chose:** Owner only for date config changes, window computation, and window selection

**Why:**

- Date config affects the entire group's window rankings — uncoordinated changes could be confusing
- Consistent with the pattern of owner-gating group-wide decisions (generation, join approval, deletion)
- The owner acts as the group's coordinator — they discuss with the group, then execute the agreed-upon change
- Window computation and selection happen at the `completed` phase where the group is finalizing — these should be deliberate, coordinated actions

---

## Decisions Deferred to Phase 2

1. **What happens when buyer exceeds budget mid-purchase?**
2. **How to handle sessions selling out during a buying window?**
3. **How to coordinate between multiple timeslot holders?**
4. **Minimum tickets based on buyer's buddy constraints**

---

## Phase 1 vs Phase 2 Summary

| Aspect     | Phase 1 (Schedule Optimization) | Phase 2 (Buying Plan)            |
| ---------- | ------------------------------- | -------------------------------- |
| **Goal**   | What's OPTIMAL                  | What's FEASIBLE                  |
| **Budget** | Shown, not filtered             | Actively constrains purchases    |
| **Prices** | Uses willingness as estimate    | Uses actual prices               |
| **Output** | Aspirational schedule           | Executable purchase instructions |

Phase 1 output feeds into Phase 2:

- Viable configurations enable quick lookup at buy time
- Backup combos provide fallback options
- Ranked windows allow pivoting if primary window fails
- Budget impact warnings help users prepare

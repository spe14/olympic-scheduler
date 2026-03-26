# Algorithm Timeout Analysis

Analysis of whether `runScheduleGeneration()` can exceed the 5-minute timeout
under any realistic or adversarial configuration. Conclusion: **it cannot.**

---

## How the timeout works

The 5-minute timeout (`DEFAULT_TIMEOUT_MS = 300,000`) is checked at three
points inside `runScheduleGeneration()` in `runner.ts`:

1. **Between convergence iterations** (line 61) — skips iteration 1
2. **Between members** during combo generation (line 113)
3. **Between members** during backup enhancement (line 219)

The timeout is never checked mid-computation for a single member's single day.
The longest uninterruptible unit of work is one member's combo generation for
one day (~5,000 subsets at peak), which takes < 100ms.

---

## What drives algorithm cost

The dominant factor is **subset generation** in `generateSubsets()`. For each
member on each day, the algorithm generates all subsets of candidate sessions
up to size 3:

```
Total subsets = C(N,1) + C(N,2) + C(N,3)
```

Where N = number of candidate sessions per member per day after filtering.

### App limits that bound N

| Limit                | Value | Source                     |
| -------------------- | ----- | -------------------------- |
| Max ranked sports    | 10    | sport-rankings-step.tsx:26 |
| Max group members    | 12    | constants.ts:6             |
| Max consecutive days | 19    | validations.ts:102-106     |
| Max sessions/day     | 31    | CSV data (Jul 19-20)       |

The 10-sport cap is the key constraint. Even picking the 10 sports with the
most sessions per day, the maximum is **31 sessions on a single day** (Jul 19
or Jul 20, from `la2028_sessions.csv`). This yields:

```
C(31,1) + C(31,2) + C(31,3) = 31 + 465 + 4,495 = 4,991 subsets
```

### Operation costs at N=31

| Operation                | Per member-day | Notes                                       |
| ------------------------ | -------------- | ------------------------------------------- |
| Subset generation        | 4,991 arrays   | Backtracking, bounded by maxSize=3 and N    |
| Travel feasibility check | 4,991 checks   | Sort 3 items + 2 gap comparisons per subset |
| Scoring                  | ~4,991 combos  | 3 multiply-adds per combo                   |
| Sorting scored combos    | ~60K compares  | O(K log K), K ≤ 4,991                       |
| B1/B2 rank selection     | ≤ 4,991 scans  | Linear scan of sorted list                  |

All of this completes in **~500μs per member-day**.

---

## Full worst-case calculation

### Parameters

- 12 members
- 18 active Olympic days (Jul 12-13, Jul 15-30)
- Up to 31 sessions per member per day on peak days
- 5 convergence iterations (max) + 1 backup enhancement pass
- 11 soft buddies per member (max — everyone else in the group)

### Cost breakdown per iteration

| Step                       | Operations                     | Time estimate |
| -------------------------- | ------------------------------ | ------------- |
| Interest count map         | 12 × 366 Map.set               | < 1ms         |
| Hard buddy filter          | 12 × 11 Sets × 366 sessions    | ~5ms          |
| minBuddies filter          | 12 × 366 Map.get               | < 1ms         |
| Soft buddy interest map    | 12 × 366 × 11 × `.some()` scan | 5ms–530ms (a) |
| Subset gen + feasibility   | 12 × 18 × ~5,000 subsets       | ~80ms         |
| Scoring + sorting          | 12 × 18 × ~5,000 scored + sort | ~55ms         |
| Post-generation validation | 636 combos × attendance checks | < 1ms         |

**(a)** `.some()` does a linear scan of the buddy's session list. Short-circuits
on first match. With similar preferences (typical): ~5ms. With zero overlap
(pathological): ~530ms.

### Total time

| Scenario                            | Iterations | Total time |
| ----------------------------------- | ---------- | ---------- |
| Baseline (no constraints)           | 1          | ~150ms     |
| With soft buddies, converges        | 1          | ~700ms     |
| 5 iterations + backup, typical      | 6 passes   | ~900ms     |
| 5 iterations + backup, pathological | 6 passes   | ~4s        |
| Pathological on 3× slow machine     | 6 passes   | ~12s       |

### Measured results

| Test                                     | Elapsed | Iterations |
| ---------------------------------------- | ------- | ---------- |
| 12 members, 10 sports, no constraints    | 688ms   | 1          |
| Same + 11 soft buddies + locked sessions | 702ms   | 1          |

Test: `tests/algorithm/stress-test.test.ts`

---

## Why buddy constraints don't increase risk

**Hard buddy filter** removes sessions from the candidate pool → N decreases
→ fewer subsets → faster.

**minBuddies filter** also removes sessions → same effect.

**Soft buddy scoring** adds a `buildSoftBuddyInterestMap` call per member. The
`.some()` linear scan is the most expensive part, but it short-circuits on
match. With 366 sessions × 11 buddies: ~4,000 operations typical, ~1.5M
pathological. Even pathological is < 1 second.

**Convergence iterations** (up to 5) repeat the main loop, but pruning reduces
N each time. Each subsequent iteration is cheaper than the previous. Total work
across 5 iterations < 5× iteration 1.

**Backup enhancement** runs once after the loop, using the first iteration's
session pool. Cost ≤ 1 additional iteration.

The factors that cause convergence failures (divergent preferences) also reduce
N per member. High N requires shared preferences, which prevents violations.
These two forces work against each other.

## Why locked sessions don't increase risk

Locked sessions reduce `remainingSlots` in `generateDayCombos()`:

```
remainingSlots = maxPerDay - locked.length
```

With 1 locked session: subsets are size 1-2 from unlocked sessions, then
locked is prepended. This generates C(N-1, 2) + C(N-1, 1) subsets instead of
C(N, 3) + C(N, 2) + C(N, 1). For N=31: 4,991 → 899. A **5.5× reduction**.

With 2 locked: subsets are size 1 only. C(N-2, 1) = 29. A **172× reduction**.

With 3 locked: only 1 combo (the 3 locked sessions). Trivial.

---

## Loop bounds (no infinite loops possible)

Every loop in the algorithm is bounded:

| Loop                           | Bounded by                    | Max value |
| ------------------------------ | ----------------------------- | --------- |
| Convergence loop               | `MAX_CONVERGENCE_ITERATIONS`  | 5         |
| Members loop                   | `members.length`              | 12        |
| Days loop                      | `sessionsByDay` entries       | 18        |
| `generateSubsets` backtracking | `maxSize` + `sessions.length` | C(31,3)   |
| B1/B2 scan                     | `sortedCombos.length`         | ~4,991    |
| Soft buddy map                 | `sessions × buddies`          | 366 × 11  |
| Validation attendance map      | `combos × sessions`           | 636 × 3   |

No recursion beyond `generateSubsets` (bounded by ascending index + maxSize).
No unbounded while-loops. No external I/O during algorithm execution.

---

## Safety margin

| Metric                             | Value       |
| ---------------------------------- | ----------- |
| Timeout limit                      | 300 seconds |
| Absolute worst case (slow machine) | ~12 seconds |
| Realistic worst case               | < 1 second  |
| **Safety margin (realistic)**      | **300×**    |
| **Safety margin (absolute)**       | **25×**     |

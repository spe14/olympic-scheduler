# LA 2028 Olympics Group Scheduler — State Transitions

## Overview

This document defines all valid state transitions for group phases and member statuses. The group phase always reflects the least progressed member — if any member is behind, the group phase matches their stage.

---

## Group Phases

| Phase             | Description                                                                |
| ----------------- | -------------------------------------------------------------------------- |
| `preferences`     | Group created, members joining and inputting preferences                   |
| `schedule_review` | Members review generated schedules; window rankings computed at generation |

**Phase flow:**

```
preferences → schedule_review
```

---

## Member Statuses

| Status             | Description                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| `pending_approval` | Requested to join, awaiting owner approval                                   |
| `denied`           | Join request denied by owner                                                 |
| `joined`           | In group, hasn't submitted preferences                                       |
| `preferences_set`  | Submitted preferences, waiting for algorithm or reviewing generated schedule |

**Status flow (happy path):**

```
pending_approval → joined → preferences_set
```

---

## Transition Table

### Forward Transitions

| #   | From               | To                | Trigger                                                     | Condition                                                                        | Group Phase Effect                                                                      |
| --- | ------------------ | ----------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | `pending_approval` | `joined`          | Owner approves join request                                 | —                                                                                | None — newly joined member enters preferences alongside existing members                |
| 2   | `joined`           | `preferences_set` | Member saves sessions step (`preference_step = 'sessions'`) | Group phase must be `preferences`                                                | None                                                                                    |
| 3   | `preferences_set`  | `preferences_set` | Owner triggers algorithm generation                         | All members must be `preferences_set`, no pending join requests, date config set | Members stay at `preferences_set`. Group → `schedule_review`. Window rankings computed. |

### Re-enter Preferences (from schedule_review phase)

| #   | From              | To       | Trigger                              | Condition                        | Group Phase Effect                                           |
| --- | ----------------- | -------- | ------------------------------------ | -------------------------------- | ------------------------------------------------------------ |
| 4   | `preferences_set` | `joined` | Member wants to re-enter preferences | Group phase is `schedule_review` | Group → `preferences`, all OTHER members → `preferences_set` |

**Note:** Re-entering preferences from `schedule_review` triggers the same effect: the member goes back to `joined` with `preference_step` set to `'buddies'` (the wizard opens on the buddies step, though sport rankings and session preferences are preserved and the user can skip to any step they want to change), all other members are reset to `preferences_set` (their preferences are preserved), and algorithm outputs are preserved until the owner triggers a new generation.

**Preferences edits during schedule_review (without re-entering):** If a member edits preferences while in `schedule_review` phase, their status remains `preferences_set` and only `statusChangedAt` is updated. Updated preferences are detected by comparing `statusChangedAt > scheduleGeneratedAt`. `shouldResetStatus` always returns false — there is no status reset on preference edits.

---

## Group Phase Derivation Rules

The group phase is determined by the collective state of its members:

| Rule                              | Group Phase                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Any member is `joined`            | `preferences` (member still working on preferences)                                                                                                                |
| All members are `preferences_set` | `preferences` (ready for owner to trigger generation) OR `schedule_review` (after generation has run — phase stored on group, not re-derived from member statuses) |

**Note:** After schedule generation, the group phase transitions to `schedule_review` and is stored on the `group` table. Members remain at `preferences_set` throughout `schedule_review`. The group phase no longer re-derives solely from member statuses at this point — the stored phase value is authoritative.

**Note:** The group starts in `preferences` on creation. Members can join (after owner approval) and begin entering preferences immediately — there is no separate setup phase. The owner gates schedule generation, which validates that all members have submitted preferences, there are no pending join requests, and date config is set.

---

## Transition Diagram

```
                    MEMBER STATUS                           GROUP PHASE
                    ─────────────                           ───────────

                    ┌──────────────────┐
                    │ pending_approval │
                    └────────┬─────────┘
                             │ owner approves (#1)
                             ▼
                    ┌─────────┐
              ┌────►│ joined  │                               preferences
              │     └────┬────┘
              │          │ submit preferences (#2)
              │          ▼
              │     ┌─────────────────┐
              │     │ preferences_set │                       preferences
              │     └────────┬────────┘
              │              │ owner generates (#3)
              │              │ (status unchanged;
              │              │  window rankings computed)
              │              ▼
   re-enter   │     ┌─────────────────┐
   prefs      │     │ preferences_set │                       schedule_review
   (#4)       └─────┤                 │
                    └─────────────────┘
```

---

## Invalid Transitions

These transitions are explicitly **not allowed**:

| From                             | To                 | Why                                                                                      |
| -------------------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| Any →                            | `pending_approval` | Can't go back to pending — that's only for new join requests                             |
| `joined` → (schedule generation) | —                  | Must go through `preferences_set` first; generation is blocked if any member is `joined` |

---

## Side Effects Summary

### Schedule Generation (Bulk)

These transitions affect ALL members simultaneously:

| Trigger                   | Effect                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Owner triggers generation | ALL members stay at `preferences_set`. Group → `schedule_review`. Window rankings computed. |

### Re-enter Preferences (Any Member, from schedule_review)

| Effect                      | Details                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Triggering member           | → `joined`, `preference_step` → `'buddies'` (sport rankings and session preferences preserved; user can skip to any step) |
| All other members           | → `preferences_set` (preferences preserved)                                                                               |
| Group phase                 | → `preferences`                                                                                                           |
| Algorithm outputs           | Preserved until owner triggers new generation                                                                             |
| Override and excluded flags | Reset to `false` for all members (previously excluded sessions reconsidered on re-generation)                             |

### Member Leaves Group

When a member leaves during `preferences` phase (no schedule generated):

| Effect                                  | Details                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Leaving member                          | Deleted (member, buddy constraints, session preferences)                                                    |
| Members who had leaving member as buddy | → `joined` with `preference_step = 'buddies'` (buddy constraints auto-removed, other preferences preserved) |
| `affectedBuddyMembers`                  | Updated with departing member's name for affected buddies (tracked even without a schedule)                 |

When a member leaves after algorithm has run and `wasPartOfSchedule` is true (`joinedAt <= scheduleGeneratedAt`):

| Effect                                  | Details                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Leaving member                          | Deleted (member, buddy constraints, session preferences)                                                    |
| Members who had leaving member as buddy | → `joined` with `preference_step = 'buddies'` (buddy constraints auto-removed, other preferences preserved) |
| Members with no buddy connection        | → `preferences_set`                                                                                         |
| Group phase                             | → `preferences`                                                                                             |
| Algorithm outputs                       | Deleted                                                                                                     |
| Override and excluded flags             | Reset to `false` for all remaining members                                                                  |

When a member leaves after algorithm has run but `wasPartOfSchedule` is false (`joinedAt > scheduleGeneratedAt`):

| Effect                                  | Details                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Leaving member                          | Deleted (member, buddy constraints, session preferences)                                                    |
| Members who had leaving member as buddy | → `joined` with `preference_step = 'buddies'` (buddy constraints auto-removed, other preferences preserved) |
| Algorithm outputs                       | Preserved                                                                                                   |
| Group phase                             | Preserved                                                                                                   |

**Note:** The behavior is determined by `wasPartOfSchedule`, not the phase itself.

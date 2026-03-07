# LA 2028 Olympics Group Scheduler — State Transitions

## Overview

This document defines all valid state transitions for group phases and member statuses. The group phase always reflects the least progressed member — if any member is behind, the group phase matches their stage.

---

## Group Phases

| Phase                 | Description                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| `preferences`         | Group created, members joining and inputting preferences                 |
| `schedule_review`     | Satisfaction check — members review generated schedules                  |
| `conflict_resolution` | Members resolving buddy constraint conflicts                             |
| `completed`           | All members confirmed; window rankings computed and window selected here |

**Phase flow:**

```
preferences → schedule_review → conflict_resolution → completed
```

---

## Member Statuses

| Status                          | Description                                                 |
| ------------------------------- | ----------------------------------------------------------- |
| `pending_approval`              | Requested to join, awaiting owner approval                  |
| `joined`                        | In group, hasn't submitted preferences                      |
| `preferences_set`               | Submitted preferences, waiting for algorithm                |
| `schedule_review_pending`       | Reviewing generated schedule, hasn't confirmed satisfaction |
| `schedule_review_confirmed`     | Confirmed satisfaction with generated schedule              |
| `conflict_resolution_pending`   | Resolving conflicts, hasn't confirmed final schedule        |
| `conflict_resolution_confirmed` | Confirmed final schedule after conflicts resolved           |

**Status flow (happy path):**

```
pending_approval → joined → preferences_set → schedule_review_pending → schedule_review_confirmed
→ conflict_resolution_pending → conflict_resolution_confirmed
```

---

## Transition Table

### Forward Transitions

| #   | From                          | To                              | Trigger                                                     | Condition                                                                        | Group Phase Effect                                                                                                                            |
| --- | ----------------------------- | ------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `pending_approval`            | `joined`                        | Owner approves join request                                 | —                                                                                | If group is past `preferences` (algorithm has run): group → `preferences`, all existing members → `preferences_set`, delete algorithm outputs |
| 2   | `joined`                      | `preferences_set`               | Member saves sessions step (`preference_step = 'sessions'`) | Group phase must be `preferences`                                                | None                                                                                                                                          |
| 3   | `preferences_set`             | `schedule_review_pending`       | Owner triggers algorithm generation                         | All members must be `preferences_set`, no pending join requests, date config set | Bulk update for ALL members. Group → `schedule_review`                                                                                        |
| 4   | `schedule_review_pending`     | `schedule_review_confirmed`     | Member confirms satisfaction                                | —                                                                                | If ALL members now `schedule_review_confirmed` → bulk move all to `conflict_resolution_pending`, group → `conflict_resolution`                |
| 5   | `conflict_resolution_pending` | `conflict_resolution_confirmed` | Member confirms final schedule                              | Member has zero unresolved conflicts                                             | If ALL members now `conflict_resolution_confirmed` → group → `completed`                                                                      |

### Backward Transitions

| #   | From                            | To                            | Trigger                                        | Condition                                                                           | Group Phase Effect                               |
| --- | ------------------------------- | ----------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| 6   | `schedule_review_confirmed`     | `schedule_review_pending`     | Member revokes satisfaction                    | Group phase is `schedule_review` (not all members have confirmed yet)               | None                                             |
| 7   | `conflict_resolution_confirmed` | `conflict_resolution_pending` | Member revokes confirmation                    | Group phase is `conflict_resolution` (not all members have confirmed yet)           | None                                             |
| 8   | `conflict_resolution_confirmed` | `conflict_resolution_pending` | Cascade — new conflict created for this member | Automatic (triggered by another member's action during `conflict_resolution` phase) | None (group is already in `conflict_resolution`) |

**Note on transition #8:** This cascade can only occur while the group is in the `conflict_resolution` phase, because conflict resolution actions (adjust willingness, override buddy, remove session) are only allowed during that phase. Once the group reaches `completed`, no further conflict resolution actions are possible, so cascades cannot occur.

### Re-enter Preferences (from any post-generation status)

| #   | From                            | To       | Trigger                              | Condition | Group Phase Effect                                           |
| --- | ------------------------------- | -------- | ------------------------------------ | --------- | ------------------------------------------------------------ |
| 9   | `schedule_review_pending`       | `joined` | Member wants to re-enter preferences | —         | Group → `preferences`, all OTHER members → `preferences_set` |
| 10  | `schedule_review_confirmed`     | `joined` | Member wants to re-enter preferences | —         | Group → `preferences`, all OTHER members → `preferences_set` |
| 11  | `conflict_resolution_pending`   | `joined` | Member wants to re-enter preferences | —         | Group → `preferences`, all OTHER members → `preferences_set` |
| 12  | `conflict_resolution_confirmed` | `joined` | Member wants to re-enter preferences | —         | Group → `preferences`, all OTHER members → `preferences_set` |

**Note:** Re-entering preferences from any state triggers the same effect: the member goes back to `joined` with `preference_step` set to `'buddies'` (the wizard opens on the buddy/budget step, though sport rankings and session preferences are preserved and the user can skip to any step they want to change), all other members are reset to `preferences_set` (their preferences are preserved but they're blocked from schedule actions), and algorithm outputs are preserved until the owner triggers a new generation.

---

## Group Phase Derivation Rules

The group phase is determined by the collective state of its members:

| Rule                                            | Group Phase                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| Any member is `joined`                          | `preferences` (member still working on preferences)                                   |
| All members are `preferences_set`               | `preferences` (ready for owner to trigger generation)                                 |
| Any member is `schedule_review_pending`         | `schedule_review`                                                                     |
| All members are `schedule_review_confirmed`     | Transitions to `conflict_resolution` (bulk move all to `conflict_resolution_pending`) |
| Any member is `conflict_resolution_pending`     | `conflict_resolution`                                                                 |
| All members are `conflict_resolution_confirmed` | `completed`                                                                           |

**Note:** The group starts in `preferences` on creation. Members can join (after owner approval) and begin entering preferences immediately — there is no separate setup phase. The owner gates schedule generation, which validates that all members have submitted preferences, there are no pending join requests, and date config is set.

**Key principle:** The group phase can never be ahead of its least progressed member. If even one member revokes their confirmation, the group phase moves back to match.

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
              ┌────►│ joined  │◄──────────────────────┐     preferences
              │     └────┬────┘                        │
              │          │ submit preferences (#2)     │
              │          ▼                             │
              │     ┌─────────────────┐                │
              │     │ preferences_set │                │     preferences
              │     └────────┬────────┘                │
              │              │ owner generates (#3)    │
              │              ▼                         │
              │     ┌───────────────────────────┐      │
   re-enter   │  ┌─►│ schedule_review_pending   │──────┤     schedule_review
   prefs      │  │  └─────────────┬─────────────┘      │
   (#9-12)    │  │                │ confirm (#4)       │
              │  │ revoke (#6)    ▼                    │
              │  │  ┌───────────────────────────┐      │
              │  └──│ schedule_review_confirmed │──────┤     schedule_review
              │     └─────────────┬─────────────┘      │
              │                   │                    │
              │                   │ ALL confirmed →    │
              │                   │ bulk move          │
              │                   ▼                    │
              │     ┌────────────────────────────────┐ │
              ├────►│ conflict_resolution_pending    │─┤     conflict_resolution
              │  ┌─►└────────────────┬───────────────┘ │
              │  │                   │ confirm (#5)     │
              │  │ revoke (#7)       ▼                 │
              │  │ cascade (#8)                        │
              │  │  ┌────────────────────────────────┐ │
              └──┼──│conflict_resolution_confirmed  │──┘     conflict_resolution
                 └──└────────────────────────────────┘            │
                                                                  │ ALL confirmed
                                                                  ▼
                                                              completed
```

---

## Invalid Transitions

These transitions are explicitly **not allowed**:

| From                              | To                              | Why                                                                                                                                |
| --------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `schedule_review_confirmed` →     | `schedule_review_pending`       | Not allowed if group is already in `conflict_resolution` — too late to revoke satisfaction                                         |
| `conflict_resolution_confirmed` → | `conflict_resolution_pending`   | Not allowed if group is `completed` — conflict resolution actions are not available at `completed` phase, so cascades cannot occur |
| Any →                             | `pending_approval`              | Can't go back to pending — that's only for new join requests                                                                       |
| `schedule_review_pending` →       | `conflict_resolution_confirmed` | Can't skip phases                                                                                                                  |
| `joined` →                        | `schedule_review_pending`       | Must go through `preferences_set` first                                                                                            |

---

## Side Effects Summary

### Bulk Transitions

These transitions affect ALL members simultaneously:

| Trigger                                       | Effect                                      |
| --------------------------------------------- | ------------------------------------------- |
| Owner triggers generation                     | ALL members → `schedule_review_pending`     |
| ALL members reach `schedule_review_confirmed` | ALL members → `conflict_resolution_pending` |

**Race condition handling:** Both bulk transitions must be performed within database transactions with row-level locking to prevent concurrent confirmations from both triggering the same bulk move.

### Re-enter Preferences (Any Member)

| Effect                      | Details                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Triggering member           | → `joined`, `preference_step` → `'buddies'` (sport rankings and session preferences preserved; user can skip to any step) |
| All other members           | → `preferences_set` (preferences preserved)                                                                               |
| Group phase                 | → `preferences`                                                                                                           |
| Algorithm outputs           | Preserved until owner triggers new generation                                                                             |
| Override and excluded flags | Reset to `false` for all members (previously excluded sessions reconsidered on re-generation)                             |

### Member Leaves Group

When a member leaves after algorithm has run:

| Effect                                  | Details                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Leaving member                          | Deleted (member, buddy constraints, session preferences)                                                    |
| Members who had leaving member as buddy | → `joined` with `preference_step = 'buddies'` (buddy constraints auto-removed, other preferences preserved) |
| Members with no buddy connection        | → `preferences_set`                                                                                         |
| Group phase                             | → `preferences`                                                                                             |
| Algorithm outputs                       | Deleted                                                                                                     |
| Override and excluded flags             | Reset to `false` for all remaining members                                                                  |

### Cascade (Conflict Resolution)

When a member's action during conflict resolution (adjust willingness, override buddy, remove session) creates a new conflict for another member:

| Effect          | Details                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| Affected member | → `conflict_resolution_pending` (if they were `conflict_resolution_confirmed`) |

**Note:** Cascades only occur during the `conflict_resolution` phase. Once the group reaches `completed`, no conflict resolution actions are available, so cascades cannot happen.

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

### In-Place Preference Editing (during schedule_review)

There is no explicit "re-enter preferences" action. Members can edit preferences directly during `schedule_review` phase without any status or phase change.

| #   | From              | To                | Trigger                                           | Condition                        | Group Phase Effect |
| --- | ----------------- | ----------------- | ------------------------------------------------- | -------------------------------- | ------------------ |
| 4   | `preferences_set` | `preferences_set` | Member edits preferences during `schedule_review` | Group phase is `schedule_review` | None               |

**How it works:** Members navigate to the Preferences tab and edit any step (buddies, sport rankings, sessions). Their status remains `preferences_set` — only `statusChangedAt` is updated. The system detects updated preferences by comparing `statusChangedAt > scheduleGeneratedAt`. A warning is shown before saving: "Schedules have already been generated. If you update preferences now, the owner will need to re-generate schedules for all group members."

**`shouldResetStatus` always returns false** — there is no status reset on preference edits. The owner sees a notification on the Overview page that preferences have changed and can regenerate schedules.

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
                    │ joined  │                               preferences
                    └────┬────┘
                         │ submit preferences (#2)
                         ▼
                    ┌─────────────────┐
                    │ preferences_set │                       preferences
                    └────────┬────────┘
                             │ owner generates (#3)
                             │ (status unchanged;
                             │  window rankings computed)
                             ▼
                    ┌─────────────────┐
                    │ preferences_set │◄─── edit prefs (#4)   schedule_review
                    │                 │     (status unchanged;
                    └─────────────────┘      statusChangedAt updated)
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

### In-Place Preference Editing (Any Member, during schedule_review)

| Effect                    | Details                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| Editing member            | Status stays `preferences_set`; `statusChangedAt` updated                                      |
| All other members         | No change                                                                                      |
| Group phase               | No change (stays `schedule_review`)                                                            |
| Algorithm outputs         | Preserved until owner triggers new generation                                                  |
| Regeneration notification | System detects `statusChangedAt > scheduleGeneratedAt` and shows notification on Overview page |

### Member Leaves Group

When a member leaves during `preferences` phase (no schedule generated):

| Effect                                  | Details                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Leaving member                          | Deleted (member, buddy constraints, session preferences)                                                                        |
| Members who had leaving member as buddy | Status unchanged; buddy constraints auto-removed; tracked in `affectedBuddyMembers` JSONB on group with departing member's name |
| `affectedBuddyMembers`                  | Updated with departing member's name for affected buddies (tracked even without a schedule)                                     |

When a member leaves after algorithm has run and `wasPartOfSchedule` is true (`joinedAt <= scheduleGeneratedAt`):

| Effect                                  | Details                                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Leaving member                          | Deleted (member, buddy constraints, session preferences)                                                                                 |
| All remaining active members            | → `preferences_set` (regardless of buddy connection)                                                                                     |
| Members who had leaving member as buddy | Tracked in `affectedBuddyMembers` JSONB on group; buddy constraints auto-removed; generation blocked until they review their preferences |
| Group phase                             | → `preferences`                                                                                                                          |
| Algorithm outputs                       | Deleted                                                                                                                                  |
| `departedMembers`                       | Updated with departing member's name and timestamp                                                                                       |

When a member leaves after algorithm has run but `wasPartOfSchedule` is false (`joinedAt > scheduleGeneratedAt`):

| Effect                                  | Details                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Leaving member                          | Deleted (member, buddy constraints, session preferences)                                           |
| Members who had leaving member as buddy | Status unchanged; buddy constraints auto-removed; tracked in `affectedBuddyMembers` JSONB on group |
| Algorithm outputs                       | Preserved                                                                                          |
| Group phase                             | Preserved                                                                                          |

**Note:** The behavior is determined by `wasPartOfSchedule`, not the phase itself.

### Affected Buddy Members Resolution

Members tracked in `affectedBuddyMembers` must review their preferences before the owner can regenerate schedules. Their entry is cleared when they:

1. Save buddy preferences (the departing buddy's constraint is already auto-removed)
2. Complete session preferences
3. Explicitly acknowledge the affected buddy review via the Preferences page

All entries are also cleared when the owner successfully generates schedules (`affectedBuddyMembers` reset to `{}`).

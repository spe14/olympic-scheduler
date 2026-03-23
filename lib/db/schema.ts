import {
  pgEnum,
  pgTable,
  text,
  date,
  time,
  real,
  uuid,
  integer,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

export const zoneEnum = pgEnum("zone_enum", [
  "Valley Zone",
  "Carson Zone",
  "DTLA Zone",
  "Long Beach Zone",
  "Exposition Park Zone",
  "Venice Zone",
  "Inglewood Zone",
  "Pomona Zone",
  "City of Industry Zone",
  "Pasadena Zone",
  "Arcadia Zone",
  "Riviera Zone",
  "Port of Los Angeles Zone",
  "Whittier Narrows Zone",
  "Universal City Zone",
  "Trestles Beach Zone",
  "Anaheim Zone",
]);

export const sessionTypeEnum = pgEnum("session_type_enum", [
  "Final",
  "Semifinal",
  "Quarterfinal",
  "Preliminary",
  "Bronze",
]);

export const interestEnum = pgEnum("interest_enum", ["low", "medium", "high"]);

export const buddyTypeEnum = pgEnum("buddy_type_enum", ["hard", "soft"]);

export const memberRoleEnum = pgEnum("member_role_enum", ["owner", "member"]);

export const memberStatusEnum = pgEnum("member_status_enum", [
  "pending_approval",
  "denied",
  "joined",
  "preferences_set",
]);

export const groupPhaseEnum = pgEnum("group_phase_enum", [
  "preferences",
  "schedule_review",
]);

export const comboRankEnum = pgEnum("combo_rank_enum", [
  "primary",
  "backup1",
  "backup2",
]);

export const avatarColorEnum = pgEnum("avatar_color_enum", [
  "blue",
  "yellow",
  "pink",
  "green",
]);

export const dateModeEnum = pgEnum("date_mode_enum", [
  "consecutive",
  "specific",
]);

export const purchaseTimeslotStatusEnum = pgEnum(
  "purchase_timeslot_status_enum",
  ["upcoming", "in_progress", "completed"]
);

export const preferenceStepEnum = pgEnum("preference_step_enum", [
  "buddies",
  "sport_rankings",
  "sessions",
]);

export const session = pgTable("session", {
  sessionCode: text("session_code").primaryKey(),
  sport: text("sport").notNull(),
  venue: text("venue").notNull(),
  zone: zoneEnum("zone").notNull(),
  sessionDate: date("session_date").notNull(),
  sessionType: sessionTypeEnum("session_type").notNull(),
  sessionDescription: text("session_description"),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
});

export const travelTime = pgTable(
  "travel_time",
  {
    originZone: zoneEnum("origin_zone").notNull(),
    destinationZone: zoneEnum("destination_zone").notNull(),
    drivingMinutes: real("driving_minutes").notNull(),
    transitMinutes: real("transit_minutes"),
  },
  (table) => [
    primaryKey({ columns: [table.originZone, table.destinationZone] }),
  ]
);

export const user = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  authId: text("auth_id").notNull().unique(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  avatarColor: avatarColorEnum("avatar_color").notNull().default("blue"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const group = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phase: groupPhaseEnum("phase").notNull().default("preferences"),
  inviteCode: text("invite_code").notNull().unique(),
  dateMode: dateModeEnum("date_mode"),
  consecutiveDays: integer("consecutive_days"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  scheduleGeneratedAt: timestamp("schedule_generated_at"),
  departedMembers: jsonb("departed_members")
    .$type<{ name: string; departedAt: string; rejoinedAt?: string }[]>()
    .default([]),
  affectedBuddyMembers: jsonb("affected_buddy_members")
    .$type<Record<string, string[]>>()
    .default({}),
  membersWithNoCombos: jsonb("members_with_no_combos")
    .$type<string[]>()
    .default([]),
  nonConvergenceMembers: jsonb("non_convergence_members")
    .$type<string[]>()
    .default([]),
  purchaseDataChangedAt: timestamp("purchase_data_changed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const member = pgTable(
  "member",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    minBuddies: integer("min_buddies").notNull().default(0),
    sportRankings: jsonb("sport_rankings").$type<string[]>(),
    status: memberStatusEnum("status").notNull().default("pending_approval"),
    preferenceStep: preferenceStepEnum("preference_step"),
    joinedAt: timestamp("joined_at"),
    statusChangedAt: timestamp("status_changed_at"),
    scheduleWarningAckedAt: timestamp("schedule_warning_acked_at"),
    excludedSessionCodes: jsonb("excluded_session_codes")
      .$type<{ code: string; soldOut: boolean; outOfBudget: boolean }[]>()
      .default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.groupId)]
);

export const buddyConstraint = pgTable(
  "buddy_constraint",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    buddyMemberId: uuid("buddy_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    type: buddyTypeEnum("type").notNull(),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.buddyMemberId] })]
);

export const sessionPreference = pgTable(
  "session_preference",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => session.sessionCode, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    interest: interestEnum("interest").notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.memberId] })]
);

export const combo = pgTable("combo", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  rank: comboRankEnum("rank").notNull(),
  score: real("score").notNull(),
});

export const comboSession = pgTable(
  "combo_session",
  {
    comboId: uuid("combo_id")
      .notNull()
      .references(() => combo.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.sessionCode, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.comboId, table.sessionId] })]
);

export const windowRanking = pgTable("window_ranking", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  score: real("score").notNull(),
  selected: boolean("selected").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Phase 2: Purchase tables ────────────────────────────────────────────────

export const purchaseTimeslot = pgTable(
  "purchase_timeslot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    timeslotStart: timestamp("timeslot_start").notNull(),
    timeslotEnd: timestamp("timeslot_end").notNull(),
    status: purchaseTimeslotStatusEnum("status").notNull().default("upcoming"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.memberId, table.groupId)]
);

export const purchasePlanEntry = pgTable(
  "purchase_plan_entry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.sessionCode, { onDelete: "cascade" }),
    assigneeMemberId: uuid("assignee_member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    priceCeiling: integer("price_ceiling"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.memberId, table.sessionId, table.assigneeMemberId),
  ]
);

export const ticketPurchase = pgTable("ticket_purchase", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  sessionId: text("session_id")
    .notNull()
    .references(() => session.sessionCode, { onDelete: "cascade" }),
  purchasedByMemberId: uuid("purchased_by_member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  pricePerTicket: integer("price_per_ticket").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ticketPurchaseAssignee = pgTable(
  "ticket_purchase_assignee",
  {
    ticketPurchaseId: uuid("ticket_purchase_id")
      .notNull()
      .references(() => ticketPurchase.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    pricePaid: integer("price_paid"),
  },
  (table) => [primaryKey({ columns: [table.ticketPurchaseId, table.memberId] })]
);

export const soldOutSession = pgTable(
  "sold_out_session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.sessionCode, { onDelete: "cascade" }),
    reportedByMemberId: uuid("reported_by_member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.groupId, table.sessionId)]
);

export const outOfBudgetSession = pgTable(
  "out_of_budget_session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.sessionCode, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.memberId, table.sessionId)]
);

export const reportedPrice = pgTable("reported_price", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" }),
  sessionId: text("session_id")
    .notNull()
    .references(() => session.sessionCode, { onDelete: "cascade" }),
  reportedByMemberId: uuid("reported_by_member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  minPrice: integer("min_price"),
  maxPrice: integer("max_price"),
  comments: text("comments"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

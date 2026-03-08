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
  "schedule_review_pending",
  "schedule_review_confirmed",
  "conflict_resolution_pending",
  "conflict_resolution_confirmed",
]);

export const groupPhaseEnum = pgEnum("group_phase_enum", [
  "preferences",
  "schedule_review",
  "conflict_resolution",
  "completed",
]);

export const comboRankEnum = pgEnum("combo_rank_enum", [
  "primary",
  "backup1",
  "backup2",
]);

export const conflictTypeEnum = pgEnum("conflict_type_enum", [
  "min_buddies_failure",
  "hard_buddy_failure",
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

export const preferenceStepEnum = pgEnum("preference_step_enum", [
  "buddies_budget",
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
      .references(() => group.id),
    role: memberRoleEnum("role").notNull().default("member"),
    budget: real("budget"),
    minBuddies: integer("min_buddies").notNull().default(0),
    sportRankings: jsonb("sport_rankings").$type<string[]>(),
    status: memberStatusEnum("status").notNull().default("pending_approval"),
    preferenceStep: preferenceStepEnum("preference_step"),
    joinedAt: timestamp("joined_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.groupId)]
);

export const buddyConstraint = pgTable(
  "buddy_constraint",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id),
    buddyMemberId: uuid("buddy_id")
      .notNull()
      .references(() => member.id),
    type: buddyTypeEnum("type").notNull(),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.buddyMemberId] })]
);

export const sessionPreference = pgTable(
  "session_preference",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => session.sessionCode),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id),
    interest: interestEnum("interest").notNull(),
    maxWillingness: integer("max_willingness"),
    hardBuddyOverride: boolean("hard_buddy_override").notNull().default(false),
    minBuddyOverride: boolean("min_buddy_override").notNull().default(false),
    excluded: boolean("excluded").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.memberId] })]
);

export const combo = pgTable("combo", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => group.id),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id),
  day: date("day").notNull(),
  rank: comboRankEnum("rank").notNull(),
  score: real("score").notNull(),
});

export const comboSession = pgTable(
  "combo_session",
  {
    comboId: uuid("combo_id")
      .notNull()
      .references(() => combo.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => session.sessionCode),
  },
  (table) => [primaryKey({ columns: [table.comboId, table.sessionId] })]
);

export const viableConfig = pgTable("viable_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => group.id),
  sessionId: text("session_id")
    .notNull()
    .references(() => session.sessionCode),
  minPrice: integer("min_price").notNull(),
  maxPrice: integer("max_price"),
});

export const viableConfigMember = pgTable(
  "viable_config_member",
  {
    viableConfigId: uuid("viable_config_id")
      .notNull()
      .references(() => viableConfig.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id),
  },
  (table) => [primaryKey({ columns: [table.viableConfigId, table.memberId] })]
);

export const conflict = pgTable("conflict", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => group.id),
  sessionId: text("session_id")
    .notNull()
    .references(() => session.sessionCode),
  affectedMemberId: uuid("affected_member_id")
    .notNull()
    .references(() => member.id),
  causingMemberId: uuid("causing_member_id").references(() => member.id),
  minPrice: integer("min_price").notNull(),
  maxPrice: integer("max_price"),
  type: conflictTypeEnum("type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const windowRanking = pgTable("window_ranking", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => group.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  score: real("score").notNull(),
  selected: boolean("selected").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

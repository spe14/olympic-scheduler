import type { AvatarColor } from "@/lib/constants";

export type ActionResult = {
  error?: string;
  success?: boolean;
};

/** Base member info shared across schedule, group-schedule, and purchase-tracker types. */
export type BaseMemberInfo = {
  memberId: string;
  firstName: string;
  lastName: string;
  avatarColor: AvatarColor;
};

export type GroupMember = {
  firstName: string;
  lastName: string;
  avatarColor: AvatarColor;
};

export type Group = {
  id: string;
  name: string;
  phase: string;
  inviteCode: string;
  createdAt: Date | string;
  myRole: string;
  myStatus: string;
  myMemberId: string;
  memberCount: number;
  pendingCount: number;
  members: GroupMember[];
};

export type GroupDetailMember = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  username: string;
  avatarColor: AvatarColor;
  role: string;
  status: string;
  joinedAt: Date | string | null;
  statusChangedAt: Date | string | null;
  createdAt: Date | string;
};

export type WindowRanking = {
  id: string;
  startDate: string;
  endDate: string;
  score: number;
  selected: boolean;
};

export type GroupDetail = {
  id: string;
  name: string;
  phase: string;
  inviteCode: string;
  dateMode: "consecutive" | "specific" | null;
  consecutiveDays: number | null;
  startDate: string | null;
  endDate: string | null;
  scheduleGeneratedAt: Date | string | null;
  purchaseDataChangedAt: Date | string | null;
  myScheduleWarningAckedAt: Date | string | null;
  createdAt: Date | string;
  myRole: string;
  myStatus: string;
  myMemberId: string;
  myTimeslot: {
    timeslotStart: Date | string;
    timeslotEnd: Date | string;
    status: "upcoming" | "in_progress" | "completed";
  } | null;
  members: GroupDetailMember[];
  memberTimeslots: string[];
  membersPurchased: string[];
  membersWithPurchaseData: string[];
  membersWithNoCombos: string[];
  departedMembers: { name: string; departedAt: string; rejoinedAt?: string }[];
  affectedBuddyMembers: Record<string, string[]>;
  windowRankings: WindowRanking[];
};

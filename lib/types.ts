import type { AvatarColor } from "@/lib/constants";

export type ActionResult = {
  error?: string;
  success?: boolean;
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
  budget: number | null;
  joinedAt: Date | string | null;
  createdAt: Date | string;
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
  createdAt: Date | string;
  myRole: string;
  myStatus: string;
  myMemberId: string;
  members: GroupDetailMember[];
};

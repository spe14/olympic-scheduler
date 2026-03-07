import type { AvatarColor } from "@/lib/constants";

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
  memberCount: number;
  pendingCount: number;
  members: GroupMember[];
};

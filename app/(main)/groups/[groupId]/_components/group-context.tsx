"use client";

import { createContext, useContext } from "react";
import type { GroupDetail } from "@/lib/types";

const GroupContext = createContext<GroupDetail | null>(null);

export function GroupProvider({
  group,
  children,
}: {
  group: GroupDetail;
  children: React.ReactNode;
}) {
  return (
    <GroupContext.Provider value={group}>{children}</GroupContext.Provider>
  );
}

export function useGroup(): GroupDetail {
  const ctx = useContext(GroupContext);
  if (!ctx) {
    throw new Error("useGroup must be used within a GroupProvider");
  }
  return ctx;
}

"use client";

import { createContext, useContext, useEffect } from "react";
import type { GroupDetail } from "@/lib/types";

const GroupContext = createContext<GroupDetail | null>(null);

// Context for syncing page-level group data up to the layout's GroupShell.
// Pages render with fresh data (server components re-fetch on navigation),
// but layouts may serve stale data. This allows GroupShell to stay current.
const GroupSyncContext = createContext<((group: GroupDetail) => void) | null>(
  null
);

export function GroupSyncProvider({
  onSync,
  children,
}: {
  onSync: (group: GroupDetail) => void;
  children: React.ReactNode;
}) {
  return (
    <GroupSyncContext.Provider value={onSync}>
      {children}
    </GroupSyncContext.Provider>
  );
}

export function GroupProvider({
  group,
  children,
}: {
  group: GroupDetail;
  children: React.ReactNode;
}) {
  // Push fresh page-level data up to GroupShell whenever it changes
  const sync = useContext(GroupSyncContext);
  useEffect(() => {
    if (sync) {
      sync(group);
    }
  }, [sync, group]);

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

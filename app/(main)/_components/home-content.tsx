"use client";

import { useState } from "react";
import GroupCard from "@/components/group-card";
import { Group } from "@/lib/types";
import CreateGroupModal from "./create-group-modal";
import JoinGroupModal from "./join-group-modal";

export default function HomeContent({
  initialGroups,
}: {
  initialGroups: Group[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  return (
    <main className="mx-auto max-w-[1060px] px-6 py-10">
      {groups.length > 0 && (
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">My Groups</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Join Group
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg bg-[#009de5] px-5 py-2.5 text-base font-semibold text-white shadow-sm shadow-[#009de5]/20 transition-colors hover:bg-[#0088c9]"
            >
              Create Group
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          onCreateClick={() => setShowCreateModal(true)}
          onJoinClick={() => setShowJoinModal(true)}
        />
      ) : (
        <GroupsList
          groups={groups}
          onRefresh={() => refreshGroups(setGroups)}
        />
      )}

      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            refreshGroups(setGroups);
          }}
        />
      )}

      {showJoinModal && (
        <JoinGroupModal
          onClose={() => setShowJoinModal(false)}
          onJoined={() => {
            setShowJoinModal(false);
            refreshGroups(setGroups);
          }}
        />
      )}
    </main>
  );
}

async function refreshGroups(setGroups: (groups: Group[]) => void) {
  const res = await fetch("/api/groups");
  if (res.ok) {
    setGroups(await res.json());
  }
}

function EmptyState({
  onCreateClick,
  onJoinClick,
}: {
  onCreateClick: () => void;
  onJoinClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-md shadow-yellow-500/20">
        <span className="text-lg font-bold text-white">28</span>
      </div>
      <h2 className="mb-2 text-xl font-semibold text-slate-900">
        You&apos;re not in any groups yet
      </h2>
      <p className="mb-8 max-w-md text-base text-slate-500">
        Create a group to start planning your LA 2028 Olympic experience, or
        join an existing group with an invite code.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onJoinClick}
          className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Join with Invite Code
        </button>
        <button
          onClick={onCreateClick}
          className="rounded-lg bg-[#009de5] px-6 py-3 text-base font-semibold text-white shadow-sm shadow-[#009de5]/20 transition-colors hover:bg-[#0088c9]"
        >
          Create a Group
        </button>
      </div>
    </div>
  );
}

function GroupsList({
  groups,
  onRefresh,
}: {
  groups: Group[];
  onRefresh: () => void;
}) {
  const isActive = (g: Group) =>
    g.myStatus !== "pending_approval" && g.myStatus !== "denied";
  const owned = groups.filter((g) => g.myRole === "owner" && isActive(g));
  const joined = groups.filter((g) => g.myRole !== "owner" && isActive(g));
  const pending = groups.filter((g) => !isActive(g));

  return (
    <div className="space-y-8">
      {owned.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-500">
            Groups You Own
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {owned.map((g) => (
              <GroupCard key={g.id} group={g} onRemoved={onRefresh} />
            ))}
          </div>
        </div>
      )}
      {joined.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-500">
            Joined Groups
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {joined.map((g) => (
              <GroupCard key={g.id} group={g} onRemoved={onRefresh} />
            ))}
          </div>
        </div>
      )}
      {pending.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-500">
            Pending Requests
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {pending.map((g) => (
              <GroupCard key={g.id} group={g} onRemoved={onRefresh} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Modal from "@/components/modal";
import UserAvatar from "@/components/user-avatar";
import Tooltip from "@/components/tooltip";
import type { ScheduleSession } from "../actions";
import StatusBadge from "@/components/status-badge";
import {
  formatSessionTime,
  formatSessionDate,
  formatActionTimestamp,
  formatPrice,
} from "@/lib/utils";
import {
  RANK_LABELS,
  RANK_SHORT_LABELS,
  RANK_TAG_COLORS,
  RANK_TAG_STYLES_LIGHT,
} from "@/lib/schedule-utils";

type Props = {
  session: ScheduleSession;
  ranks: string[];
  day: string;
  sportColor: { bg: string; border: string; text: string; title: string };
  onClose: () => void;
};

export default function SessionDetailModal({
  session,
  ranks,
  day,
  sportColor,
  onClose,
}: Props) {
  const hasPurchases = session.purchases.length > 0;
  const hasReportedPrices = session.reportedPrices.length > 0;

  // Members with purchased tickets — exclude them from interested list
  const attendingMemberIds = new Set(
    session.purchases.flatMap((p) => p.assignees.map((a) => a.memberId))
  );
  const interestedOnly = session.scheduledMembers.filter(
    (m) => !attendingMemberIds.has(m.memberId)
  );

  return (
    <Modal title="Session Details" onClose={onClose} size="lg">
      {/* Status badges */}
      {(hasPurchases || session.isSoldOut || session.isOutOfBudget) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {hasPurchases && <StatusBadge variant="purchased" />}
          {session.isSoldOut && <StatusBadge variant="sold_out" />}
          {session.isOutOfBudget && <StatusBadge variant="out_of_budget" />}
        </div>
      )}

      {/* Session info */}
      <div
        className="mb-4 space-y-0.5 rounded-lg p-3.5"
        style={{ backgroundColor: `${sportColor.bg}99` }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="text-base font-semibold"
            style={{ color: sportColor.title }}
          >
            {session.sport}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: sportColor.border }}
          >
            {session.sessionCode}
          </span>
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">
            {session.sessionType}
          </span>
          <Tooltip
            label="Your Interest Level"
            position="bottom"
            className="capitalize"
          >
            <span
              className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: sportColor.border }}
            >
              {session.interest}
            </span>
          </Tooltip>
        </div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <span>{formatSessionDate(day)}</span>
          <span style={{ color: sportColor.border }}>|</span>
          <span>
            {formatSessionTime(session.startTime)} &ndash;{" "}
            {formatSessionTime(session.endTime)} PT
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <span>{session.venue}</span>
          <span style={{ color: sportColor.border }}>|</span>
          <span>{session.zone}</span>
        </p>
        {session.sessionDescription && (
          <ul className="space-y-0.5 text-sm text-slate-600">
            {session.sessionDescription.split(";").map((event, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: sportColor.border }}
                />
                {event.trim()}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Rank tags */}
      <div className="mb-4 flex gap-1.5">
        {ranks.map((r) => (
          <span
            key={r}
            className="rounded px-2 py-1 text-sm font-semibold leading-none"
            style={{
              backgroundColor: RANK_TAG_STYLES_LIGHT[r]?.bg,
              color: RANK_TAG_STYLES_LIGHT[r]?.text,
            }}
          >
            {RANK_LABELS[r] ?? r}
          </span>
        ))}
      </div>

      {/* Attending members — only those with purchased tickets */}
      {hasPurchases && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Attending Members:
          </p>
          <div className="space-y-2">
            {session.purchases.map((p) =>
              p.assignees.map((a) => (
                <div
                  key={`${p.purchaseId}-${a.memberId}`}
                  className="flex items-center gap-2.5"
                >
                  <UserAvatar
                    firstName={a.firstName}
                    lastName={a.lastName}
                    avatarColor={a.avatarColor}
                    size="sm"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800">
                      {a.firstName} {a.lastName}
                    </span>
                    {a.pricePaid != null && (
                      <span className="text-xs text-emerald-600">
                        {formatPrice(a.pricePaid)} / ticket
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Interested members — excludes those already attending */}
      {interestedOnly.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Other Interested Members:
          </p>
          <div className="space-y-2">
            {interestedOnly.map((m) => (
              <div key={m.memberId} className="flex items-center gap-2.5">
                <UserAvatar
                  firstName={m.firstName}
                  lastName={m.lastName}
                  avatarColor={m.avatarColor}
                  size="sm"
                />
                <span className="text-sm font-medium text-slate-800">
                  {m.firstName} {m.lastName}
                </span>
                <div className="flex gap-1">
                  {(m.ranks ?? []).map((r) => (
                    <span
                      key={r}
                      className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold leading-none text-white"
                      style={{ backgroundColor: RANK_TAG_COLORS[r]?.bg }}
                    >
                      {RANK_SHORT_LABELS[r]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reported prices */}
      {hasReportedPrices && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="mb-1.5 text-xs font-semibold text-slate-600">
            Reported Prices:
          </p>
          <div className="space-y-1">
            {session.reportedPrices.map((rp, i) => (
              <div key={i} className="text-xs text-slate-500">
                <p>
                  {rp.minPrice != null && rp.maxPrice != null
                    ? `${formatPrice(rp.minPrice)} – ${formatPrice(rp.maxPrice)}`
                    : rp.minPrice != null
                      ? `From ${formatPrice(rp.minPrice)}`
                      : rp.maxPrice != null
                        ? `Up to ${formatPrice(rp.maxPrice)}`
                        : "Comment"}{" "}
                  reported by {rp.reporterFirstName} {rp.reporterLastName} on{" "}
                  {formatActionTimestamp(rp.createdAt)}
                </p>
                {rp.comments && (
                  <p className="mt-0.5 italic text-slate-400">
                    &ldquo;{rp.comments}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

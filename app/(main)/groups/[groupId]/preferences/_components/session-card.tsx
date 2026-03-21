import type { SessionData } from "./preference-wizard";

export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

type SessionCardProps = {
  session: SessionData;
  sportColor: string;
  showSport?: boolean;
  interestBadge?: React.ReactNode;
  rightContent?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export default function SessionCard({
  session,
  sportColor,
  showSport = true,
  interestBadge,
  rightContent,
  onClick,
  disabled,
  className = "",
}: SessionCardProps) {
  const isClickable = !!onClick && !disabled;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        disabled
          ? "border-slate-100 bg-slate-50 opacity-50"
          : isClickable
            ? "cursor-pointer border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            : "border-slate-200 bg-white"
      } ${className}`}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick!();
              }
            }
          : undefined
      }
    >
      {/* Sport color indicator */}
      <div
        className="w-1 flex-shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: sportColor }}
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold" style={{ color: sportColor }}>
            {session.sessionCode}
          </span>
          {showSport && (
            <span
              className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: sportColor }}
            >
              {session.sport}
            </span>
          )}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
            {session.sessionType}
          </span>
        </div>
        {session.sessionDescription && (
          <p className="mt-0.5 truncate text-sm text-slate-700">
            {session.sessionDescription}
          </p>
        )}
        <p className="mt-0.5 text-sm text-slate-400">
          {formatTime(session.startTime)} &ndash; {formatTime(session.endTime)}{" "}
          &middot; {session.venue} &middot; {session.zone}
        </p>
      </div>

      {/* Right side */}
      {(interestBadge || rightContent) && (
        <div className="flex flex-shrink-0 items-center gap-2">
          {interestBadge}
          {rightContent}
        </div>
      )}
    </div>
  );
}

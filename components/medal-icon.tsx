export default function MedalIcon({
  className = "h-8 w-7",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 32 40" className={className}>
      <defs>
        <linearGradient id="mGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe14d" />
          <stop offset="50%" stopColor="#ffc107" />
          <stop offset="100%" stopColor="#e5a100" />
        </linearGradient>
        <linearGradient id="mGoldLight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff176" />
          <stop offset="50%" stopColor="#ffd54f" />
          <stop offset="100%" stopColor="#ffca28" />
        </linearGradient>
        <linearGradient id="mRibbonL" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#33b8f7" />
          <stop offset="50%" stopColor="#009de5" />
          <stop offset="100%" stopColor="#0077b0" />
        </linearGradient>
        <linearGradient id="mRibbonR" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#33b8f7" />
          <stop offset="50%" stopColor="#009de5" />
          <stop offset="100%" stopColor="#0077b0" />
        </linearGradient>
      </defs>
      {/* Left ribbon panel */}
      <polygon points="3,0 12,0 16,14 7,14" fill="url(#mRibbonL)" />
      <polygon points="5,0 10,0 14,13 9,13" fill="white" opacity="0.12" />
      <polygon points="3,0 5,0 9,14 7,14" fill="#005f8a" opacity="0.3" />
      {/* Right ribbon panel */}
      <polygon points="29,0 20,0 16,14 25,14" fill="url(#mRibbonR)" />
      <polygon points="27,0 22,0 18,13 23,13" fill="white" opacity="0.12" />
      <polygon points="29,0 27,0 23,14 25,14" fill="#005f8a" opacity="0.3" />
      {/* Medal */}
      <circle cx="16" cy="26" r="13" fill="url(#mGold)" />
      <circle cx="16" cy="26" r="12" fill="url(#mGoldLight)" />
      <circle
        cx="16"
        cy="26"
        r="10"
        fill="url(#mGold)"
        stroke="#e5a100"
        strokeWidth="0.4"
      />
      <circle cx="16" cy="26" r="9" fill="url(#mGoldLight)" />
      <text
        x="16"
        y="30.5"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="10"
        fontWeight="bold"
        fill="#c8960a"
      >
        28
      </text>
    </svg>
  );
}

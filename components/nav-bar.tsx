"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { logout } from "@/app/(auth)/actions";
import { avatarColors, type AvatarColor } from "@/lib/constants";

type NavBarProps = {
  firstName: string;
  lastName: string;
  username: string;
  avatarColor: AvatarColor;
};

export default function NavBar({
  firstName,
  lastName,
  username,
  avatarColor,
}: NavBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <svg viewBox="0 0 32 40" className="h-8 w-7">
            <defs>
              <linearGradient id="navGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffe14d" />
                <stop offset="50%" stopColor="#ffc107" />
                <stop offset="100%" stopColor="#e5a100" />
              </linearGradient>
              <linearGradient id="navGoldLight" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fff176" />
                <stop offset="50%" stopColor="#ffd54f" />
                <stop offset="100%" stopColor="#ffca28" />
              </linearGradient>
            </defs>
            <polygon points="12,0 3,0 12,14 16,14" fill="#1E88E5" />
            <polygon points="20,0 29,0 20,14 16,14" fill="#1E88E5" />
            <polygon points="12,14 10,16 14,17 16,14" fill="#0D47A1" />
            <polygon points="20,14 22,16 18,17 16,14" fill="#0D47A1" />
            <circle cx="16" cy="26" r="13" fill="url(#navGold)" />
            <circle cx="16" cy="26" r="12" fill="url(#navGoldLight)" />
            <circle
              cx="16"
              cy="26"
              r="10"
              fill="url(#navGold)"
              stroke="#e5a100"
              strokeWidth="0.4"
            />
            <circle cx="16" cy="26" r="9" fill="url(#navGoldLight)" />
            <path
              d="M11,26 Q12,22 16,21 Q12.5,23 12,26"
              fill="#e5a100"
              opacity="0.5"
            />
            <path
              d="M11.5,27.5 Q12.5,24 16,23 Q13,25 12.5,27.5"
              fill="#e5a100"
              opacity="0.4"
            />
            <path
              d="M21,26 Q20,22 16,21 Q19.5,23 20,26"
              fill="#e5a100"
              opacity="0.5"
            />
            <path
              d="M20.5,27.5 Q19.5,24 16,23 Q19,25 19.5,27.5"
              fill="#e5a100"
              opacity="0.4"
            />
            <text
              x="16"
              y="30.5"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize="10"
              fontWeight="bold"
              fill="#a67c00"
            >
              28
            </text>
          </svg>
          <span className="text- font-bold uppercase tracking-widest text-[#009de5]">
            LA 2028 Scheduler
          </span>
        </Link>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50"
          >
            <span className="text-sm text-slate-600">@{username}</span>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
              style={{
                backgroundColor: avatarColors[avatarColor].bg,
                color: avatarColors[avatarColor].text,
              }}
            >
              {firstName[0]}
              {lastName[0]}
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-4 py-2">
                <p className="text-sm font-medium text-slate-900">
                  {firstName} {lastName}
                </p>
                <p className="text-xs text-slate-500">@{username}</p>
              </div>
              <Link
                href="/profile"
                className="block px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => setIsDropdownOpen(false)}
              >
                Profile
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Log Out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

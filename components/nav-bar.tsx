"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { logout } from "@/app/(auth)/actions";
import { type AvatarColor } from "@/lib/constants";
import UserAvatar from "@/components/user-avatar";
import { globalGuardNavigation } from "@/lib/navigation-guard-store";
import MedalIcon from "@/components/medal-icon";

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
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <MedalIcon />
            <span className="font-[family-name:var(--font-pacifico)] text-2xl text-[#009de5]">
              collaboly
            </span>
          </div>
          <Link
            href="/groups"
            className="text-sm font-semibold text-[#009de5] transition-colors hover:text-[#005f8a]"
            onClick={(e) => {
              if (!globalGuardNavigation("/groups")) {
                e.preventDefault();
              }
            }}
          >
            My Groups
          </Link>
          <Link
            href="/about"
            className="text-sm font-semibold text-[#009de5] transition-colors hover:text-[#005f8a]"
            onClick={(e) => {
              if (!globalGuardNavigation("/about")) {
                e.preventDefault();
              }
            }}
          >
            About
          </Link>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50"
          >
            <span className="text-sm text-slate-600">@{username}</span>
            <UserAvatar
              firstName={firstName}
              lastName={lastName}
              avatarColor={avatarColor}
            />
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
                onClick={(e) => {
                  if (!globalGuardNavigation("/profile")) {
                    e.preventDefault();
                  }
                  setIsDropdownOpen(false);
                }}
              >
                Profile
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  onClick={(e) => {
                    if (!globalGuardNavigation("/login", () => logout())) {
                      e.preventDefault();
                      setIsDropdownOpen(false);
                    }
                  }}
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

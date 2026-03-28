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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    <nav className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2">
            <MedalIcon />
            <span className="font-[family-name:var(--font-pacifico)] text-xl text-[#009de5] md:text-2xl">
              collaboly
            </span>
          </div>
          <Link
            href="/groups"
            className="hidden text-sm font-semibold text-[#009de5] transition-colors hover:text-[#005f8a] md:block"
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
            className="hidden text-sm font-semibold text-[#009de5] transition-colors hover:text-[#005f8a] md:block"
            onClick={(e) => {
              if (!globalGuardNavigation("/about")) {
                e.preventDefault();
              }
            }}
          >
            About
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <button
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              )}
            </svg>
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50"
            >
              <span className="hidden text-sm text-slate-600 sm:inline">
                @{username}
              </span>
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
                      localStorage.removeItem("mobile-warning-dismissed");
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
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="mt-3 border-t border-slate-100 pt-3 md:hidden">
          <div className="flex flex-col gap-2">
            <Link
              href="/groups"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#009de5] transition-colors hover:bg-slate-50"
              onClick={(e) => {
                if (!globalGuardNavigation("/groups")) {
                  e.preventDefault();
                }
                setIsMobileMenuOpen(false);
              }}
            >
              My Groups
            </Link>
            <Link
              href="/about"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#009de5] transition-colors hover:bg-slate-50"
              onClick={(e) => {
                if (!globalGuardNavigation("/about")) {
                  e.preventDefault();
                }
                setIsMobileMenuOpen(false);
              }}
            >
              About
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

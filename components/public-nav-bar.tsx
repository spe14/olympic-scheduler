"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MedalIcon from "@/components/medal-icon";

export default function PublicNavBar() {
  const pathname = usePathname();

  return (
    <nav className="relative z-10 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <MedalIcon />
            <span className="font-[family-name:var(--font-pacifico)] text-2xl text-[#009de5]">
              collaboly
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}

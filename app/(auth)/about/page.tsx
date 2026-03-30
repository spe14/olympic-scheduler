"use client";

import Link from "next/link";
import { useState } from "react";
import PrivacyPolicyModal from "@/components/privacy-policy-modal";

export default function AboutPage() {
  const [showPrivacy, setShowPrivacy] = useState(false);
  return (
    <>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white px-4 py-6 md:px-6 md:py-10">
        <div className="flex flex-1 flex-col">
          <h1 className="mb-8 text-3xl font-bold text-slate-900">About</h1>
          <div className="space-y-8">
            {/* What this app does */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#009de5]">
                What does this platform do?
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Collaboly is a collaborative planning tool to help individuals
                and groups plan their attendance for the LA 2028 Olympics. Using
                each group member&apos;s interests and preferences, it generates
                personalized schedules for every member as well as an optimal
                group schedule. It also includes tools to coordinate and track
                ticket prices and purchases.
              </p>
            </section>

            {/* How the algorithm works */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#009de5]">
                How does scheduling work?
              </h2>
              <p className="mb-3 text-sm leading-relaxed text-slate-600">
                Each group member ranks their top sports and rates individual
                sessions by interest level (low, medium, or high). Members can
                also require or prefer to attend sessions with specific people,
                or set a minimum number of group members they want present at
                each session.
              </p>
              <p className="mb-3 text-sm leading-relaxed text-slate-600">
                The algorithm runs per day across all 19 Olympic days (July
                12–30, 2028). For each member on each day, it builds candidate
                combos of up to 3 sessions, checks travel feasibility between
                venues, and scores each combo based on sport ranking, interest
                level, and buddy overlap. The top-scoring combo becomes the{" "}
                <span className="font-medium text-slate-700">primary</span>{" "}
                schedule, with two{" "}
                <span className="font-medium text-slate-700">backup</span>{" "}
                alternatives that offer meaningfully different sessions.
              </p>
              <p className="text-sm leading-relaxed text-slate-600">
                The group owner can configure a date range — either specific
                dates or a number of consecutive days. Once schedules are
                generated, the algorithm ranks every valid window by how well
                the group&apos;s combined schedules score across those days. A
                fairness adjustment is applied to avoid recommending windows
                that heavily favor one person over others.
              </p>
            </section>

            {/* Scope */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#009de5]">
                Scope &amp; Limitations
              </h2>
              <ul className="space-y-2 text-sm leading-relaxed text-slate-600">
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-slate-400">•</span>
                  <span>
                    <span className="font-medium text-slate-700">
                      Los Angeles area only.
                    </span>{" "}
                    Covers sessions at venues across the following zones:
                    Valley, Carson, Downtown LA, Long Beach, Exposition Park,
                    Venice, Inglewood, Pomona, City of Industry, Pasadena,
                    Arcadia, Riviera, Port of Los Angeles, Whittier Narrows,
                    Universal City, Trestles Beach, and Anaheim. Sessions
                    occurring outside of these zones are not considered.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-slate-400">•</span>
                  <span>
                    <span className="font-medium text-slate-700">
                      No opening or closing ceremonies.
                    </span>{" "}
                    The Opening Ceremony and Closing Ceremony are not included
                    in the session data or scheduling.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-slate-400">•</span>
                  <span>
                    <span className="font-medium text-slate-700">
                      Groups of 1–12 members.
                    </span>{" "}
                    Each group can have between 1 and 12 members.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-slate-400">•</span>
                  <span>
                    <span className="font-medium text-slate-700">
                      Use a desktop for the best experience.
                    </span>{" "}
                    This app is designed for use on a computer and features may
                    be harder to use on a mobile device.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-slate-400">•</span>
                  <span>
                    <span className="font-medium text-slate-700">
                      No email notifications.
                    </span>{" "}
                    There are in-app notifications on each group page for your
                    reference, but you may need to refresh the page to see the
                    latest notifications.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-slate-400">•</span>
                  <span>
                    <span className="font-medium text-slate-700">
                      Publicly available data.
                    </span>{" "}
                    Session data is sourced from the{" "}
                    <a
                      href="https://la28.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#009de5] hover:underline"
                    >
                      official LA28 website
                    </a>{" "}
                    and was last updated on{" "}
                    <span className="font-medium text-slate-700">
                      March 16, 2026
                    </span>
                    . Schedules, venues, and session details are subject to
                    change by the official organizers. Always verify with
                    official sources before purchasing tickets.
                  </span>
                </li>
              </ul>
            </section>

            {/* Get started */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#009de5]">
                Ready to get started?
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Navigate to the{" "}
                <Link
                  href="/groups"
                  className="font-medium text-[#009de5] hover:underline"
                >
                  My Groups
                </Link>{" "}
                tab to create or join a group and start planning!
              </p>
            </section>

            {/* Disclaimers */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-[#009de5]">
                Disclaimers
              </h2>
              <p className="mb-3 text-sm leading-relaxed text-slate-600">
                Generated schedules are suggestions only. Ticket availability,
                pricing, and session times may change. The purchase tracking
                features are for personal coordination and do not connect to any
                official ticketing platform.{" "}
                <span className="font-semibold text-slate-700">
                  Always verify purchases and schedules through official LA28
                  channels.
                </span>
              </p>
              <p className="text-sm font-semibold leading-relaxed text-slate-700">
                This is an independent tool and has no affiliation with the
                official LA 2028 organizing committee or the International
                Olympic Committee.
              </p>
            </section>
          </div>
          <p className="mt-10 text-xs text-slate-400">
            <button
              onClick={() => setShowPrivacy(true)}
              className="text-[#009de5] hover:underline"
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </div>
      {showPrivacy && (
        <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />
      )}
    </>
  );
}

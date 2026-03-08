"use client";

import { useState, useRef } from "react";

type Props = {
  availableSports: string[];
  initialRankings: string[];
  onChange: (rankings: string[]) => void;
};

export default function SportRankingsStep({
  availableSports,
  initialRankings,
  onChange,
}: Props) {
  const [rankings, setRankings] = useState<string[]>(initialRankings);
  const [filter, setFilter] = useState("");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragItemIndex = useRef<number | null>(null);

  const unrankedSports = availableSports
    .filter((s) => !rankings.includes(s))
    .filter((s) => s.toLowerCase().includes(filter.toLowerCase()));

  function addSport(sport: string) {
    if (rankings.length >= 10) return;
    const next = [...rankings, sport];
    setRankings(next);
    onChange(next);
  }

  function removeSport(index: number) {
    const next = rankings.filter((_, i) => i !== index);
    setRankings(next);
    onChange(next);
  }

  function handleDragStart(index: number) {
    dragItemIndex.current = index;
    setDraggingIndex(index);
  }

  function handleDragEnter(index: number) {
    if (dragItemIndex.current === null || dragItemIndex.current === index)
      return;
    const fromIndex = dragItemIndex.current;
    const next = [...rankings];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(index, 0, removed);
    dragItemIndex.current = index;
    setDraggingIndex(index);
    setRankings(next);
  }

  function handleDragEnd() {
    setDraggingIndex(null);
    dragItemIndex.current = null;
    onChange(rankings);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...rankings];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setRankings(next);
    onChange(next);
  }

  function moveDown(index: number) {
    if (index === rankings.length - 1) return;
    const next = [...rankings];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setRankings(next);
    onChange(next);
  }

  return (
    <div className="space-y-6">
      {/* Ranked list */}
      <div>
        <h3 className="mb-1 text-base font-semibold text-slate-900">
          Your Sport Rankings
        </h3>
        <p className="mb-2 text-base text-slate-500">
          Drag or use the arrows to reorder. Rank 1 is your top choice (the
          sport you are most interested in attending).
        </p>

        {rankings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-base text-slate-400">
            Select sports from the list below to start ranking.
          </div>
        ) : (
          <div className="space-y-1.5">
            {rankings.map((sport, index) => (
              <div
                key={sport}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                  draggingIndex === index
                    ? "border-[#009de5] bg-[#009de5]/5 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                style={{
                  opacity: draggingIndex === index ? 0.85 : 1,
                }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#009de5]/10 text-sm font-semibold text-[#009de5]">
                  {index + 1}
                </span>
                <span className="flex-1 cursor-grab text-base font-medium text-slate-900">
                  {sport}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 15l-6-6-6 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === rankings.length - 1}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSport(index)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Remove"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available sports */}
      <div>
        <h3 className="mb-1 text-base font-semibold text-slate-900">
          Available Sports
        </h3>
        <p
          className={`${rankings.length >= 10 ? "mb-2" : "mb-0"} text-base text-slate-500`}
        >
          {rankings.length >= 10
            ? "Maximum 10 sports reached. Remove one to add another."
            : "Select up to 10 sports. Only sessions from these sports will appear on your schedule."}
        </p>
        {rankings.length < 10 && (
          <p className="mb-2 text-base text-slate-500">
            Click on a sport to add it to your rankings.
          </p>
        )}

        <input
          type="text"
          placeholder="Filter sports..."
          className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 placeholder-slate-400 focus:border-[#009de5]/40 focus:outline-none focus:ring-2 focus:ring-[#009de5]/20"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        {unrankedSports.length === 0 ? (
          <p className="py-2 text-center text-base text-slate-400">
            {filter
              ? "No matching sports found."
              : "All available sports have been ranked."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unrankedSports.map((sport) => (
              <button
                key={sport}
                type="button"
                onClick={() => addSport(sport)}
                disabled={rankings.length >= 10}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-[#009de5]/40 hover:bg-[#009de5]/5 hover:text-[#009de5] disabled:opacity-40"
              >
                {sport}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

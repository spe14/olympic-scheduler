"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGroup } from "../../_components/group-context";
import BuddiesBudgetStep from "./buddies-budget-step";
import SportRankingsStep from "./sport-rankings-step";
import SessionsStep from "./sessions-step";
import {
  saveBuddiesBudget,
  saveSportRankings,
  saveSessionsPlaceholder,
} from "../actions";

type BuddySelection = { memberId: string; type: "hard" | "soft" };

type Props = {
  initialBudget: number | null;
  initialMinBuddies: number;
  initialBuddies: BuddySelection[];
  initialSportRankings: string[];
  initialPreferenceStep: string | null;
  initialStatus: string;
  availableSports: string[];
};

const STEPS = [
  { key: "buddies_budget", label: "Buddies & Budget" },
  { key: "sport_rankings", label: "Sport Rankings" },
  { key: "sessions", label: "Sessions" },
] as const;

function getInitialStep(
  preferenceStep: string | null,
  status: string
): { step: number; completed: Set<number> } {
  if (preferenceStep === "sessions" && status === "preferences_set") {
    return { step: 0, completed: new Set([0, 1, 2]) };
  }
  if (preferenceStep === "sport_rankings") {
    return { step: 2, completed: new Set([0, 1]) };
  }
  if (preferenceStep === "buddies_budget") {
    return { step: 1, completed: new Set([0]) };
  }
  return { step: 0, completed: new Set() };
}

export default function PreferenceWizard({
  initialBudget,
  initialMinBuddies,
  initialBuddies,
  initialSportRankings,
  initialPreferenceStep,
  initialStatus,
  availableSports,
}: Props) {
  const group = useGroup();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = getInitialStep(initialPreferenceStep, initialStatus);

  const stepFromUrl = searchParams.get("step");
  const urlStepIndex = stepFromUrl
    ? STEPS.findIndex((s) => s.key === stepFromUrl)
    : -1;

  const [currentStep, setCurrentStep] = useState(
    urlStepIndex >= 0 ? urlStepIndex : initial.step
  );
  const [completedSteps, setCompletedSteps] = useState(initial.completed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const navigateToStep = useCallback(
    (stepIndex: number) => {
      setCurrentStep(stepIndex);
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", STEPS[stepIndex].key);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Step data refs (avoid re-renders on every keystroke)
  const buddiesBudgetData = useRef<{
    budget: number | null;
    minBuddies: number;
    buddies: BuddySelection[];
  }>({
    budget: initialBudget,
    minBuddies: initialMinBuddies,
    buddies: initialBuddies,
  });

  const [sportRankings, setSportRankings] =
    useState<string[]>(initialSportRankings);

  const handleBuddiesBudgetChange = useCallback(
    (data: {
      budget: number | null;
      minBuddies: number;
      buddies: BuddySelection[];
    }) => {
      buddiesBudgetData.current = data;
    },
    []
  );

  const handleSportRankingsChange = useCallback((rankings: string[]) => {
    setSportRankings(rankings);
  }, []);

  async function saveCurrentStep(): Promise<boolean> {
    setSaving(true);
    setError("");

    let result;
    try {
      if (currentStep === 0) {
        result = await saveBuddiesBudget(group.id, buddiesBudgetData.current);
      } else if (currentStep === 1) {
        result = await saveSportRankings(group.id, {
          sportRankings: sportRankings,
        });
      } else {
        result = await saveSessionsPlaceholder(group.id);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setSaving(false);
      return false;
    }

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return false;
    }

    return true;
  }

  async function handleNext() {
    const saved = await saveCurrentStep();
    if (!saved) return;

    setCompletedSteps((prev) => new Set([...prev, currentStep]));

    if (currentStep < 2) {
      navigateToStep(currentStep + 1);
    } else {
      // All done - refresh to reflect new status
      router.refresh();
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      navigateToStep(currentStep - 1);
      setError("");
    }
  }

  function handleStepClick(index: number) {
    // Allow clicking completed steps or the current step
    if (completedSteps.has(index) || index === currentStep) {
      navigateToStep(index);
      setError("");
    }
  }

  // Read-only mode when group is past preferences phase
  if (group.phase !== "preferences") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          Preferences Locked
        </h2>
        <p className="text-sm text-slate-500">
          The group has moved past the preferences phase. Preferences can no
          longer be edited.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = completedSteps.has(index);
          const isClickable = isComplete || index === currentStep;

          return (
            <div key={step.key} className="flex items-center">
              {index > 0 && (
                <div
                  className={`h-0.5 w-8 sm:w-12 ${
                    completedSteps.has(index - 1)
                      ? "bg-emerald-400"
                      : "bg-slate-200"
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => handleStepClick(index)}
                disabled={!isClickable}
                className={`flex flex-col items-center gap-1 ${
                  isClickable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    isComplete
                      ? "bg-emerald-500 text-white"
                      : isActive
                        ? "bg-[#009de5] text-white"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isComplete ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium sm:text-xs ${
                    isActive
                      ? "text-[#009de5]"
                      : isComplete
                        ? "text-emerald-600"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        {currentStep === 0 && (
          <BuddiesBudgetStep
            initialBudget={initialBudget}
            initialMinBuddies={initialMinBuddies}
            initialBuddies={initialBuddies}
            onChange={handleBuddiesBudgetChange}
          />
        )}
        {currentStep === 1 && (
          <SportRankingsStep
            availableSports={availableSports}
            initialRankings={sportRankings}
            onChange={handleSportRankingsChange}
          />
        )}
        {currentStep === 2 && <SessionsStep />}

        {/* Navigation */}
        <div className="mt-6 border-t border-slate-100 pt-4">
          <div
            className={`flex items-center ${currentStep === 0 ? "justify-end" : "justify-between"}`}
          >
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Back
              </button>
            )}
            <div className="flex flex-col items-end gap-2">
              {error && <p className="text-base text-red-600">{error}</p>}
              <button
                type="button"
                onClick={handleNext}
                disabled={saving}
                className="rounded-lg bg-[#009de5] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0088c9] disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : currentStep === 2
                    ? "Finish"
                    : "Save & Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

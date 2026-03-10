"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGroup } from "../../_components/group-context";
import BuddiesBudgetStep from "./buddies-budget-step";
import SportRankingsStep from "./sport-rankings-step";
import SessionsStep from "./sessions-step";
import ReviewStep from "./review-step";
import {
  saveBuddiesBudget,
  saveSportRankings,
  saveSessionPreferences,
} from "../actions";
import { useNavigationGuard } from "../../_components/navigation-guard-context";

type BuddySelection = { memberId: string; type: "hard" | "soft" };

export type SessionData = {
  sessionCode: string;
  sport: string;
  venue: string;
  zone: string;
  sessionDate: string;
  sessionType: string;
  sessionDescription: string | null;
  startTime: string;
  endTime: string;
};

export type SessionPreferenceData = {
  sessionId: string;
  interest: "low" | "medium" | "high";
  maxWillingness: number | null;
};

type Props = {
  initialBudget: number | null;
  initialMinBuddies: number;
  initialBuddies: BuddySelection[];
  initialSportRankings: string[];
  initialPreferenceStep: string | null;
  initialStatus: string;
  availableSports: string[];
  sessions: SessionData[];
  initialSessionPreferences: SessionPreferenceData[];
};

const STEPS = [
  { key: "buddies_budget", label: "Buddies & Budget" },
  { key: "sport_rankings", label: "Sport Rankings" },
  { key: "sessions", label: "Session Interests" },
  { key: "review", label: "Review" },
] as const;

function getInitialStep(
  preferenceStep: string | null,
  status: string
): { step: number; completed: Set<number> } {
  if (preferenceStep === "sessions" && status === "preferences_set") {
    return { step: 3, completed: new Set([0, 1, 2, 3]) };
  }
  if (preferenceStep === "sport_rankings") {
    return { step: 2, completed: new Set([0, 1]) };
  }
  if (preferenceStep === "buddies_budget") {
    return { step: 1, completed: new Set([0]) };
  }
  return { step: 0, completed: new Set() };
}

function buildInitialSnapshots(
  initialBudget: number | null,
  initialMinBuddies: number,
  initialBuddies: BuddySelection[],
  initialSportRankings: string[],
  initialSessionPreferences: SessionPreferenceData[]
): Record<number, string> {
  // All steps always have snapshots since they're loaded with initial data
  const snaps: Record<number, string> = {
    0: JSON.stringify({
      budget: initialBudget,
      minBuddies: initialMinBuddies,
      buddies: initialBuddies,
    }),
    1: JSON.stringify(initialSportRankings),
    2: JSON.stringify(initialSessionPreferences),
  };
  return snaps;
}

export default function PreferenceWizard({
  initialBudget,
  initialMinBuddies,
  initialBuddies,
  initialSportRankings,
  initialPreferenceStep,
  initialStatus,
  availableSports,
  sessions,
  initialSessionPreferences,
}: Props) {
  const group = useGroup();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setDirtyChecker } = useNavigationGuard();
  const initial = getInitialStep(initialPreferenceStep, initialStatus);

  const stepFromUrl = searchParams.get("step");
  const urlStepIndex = stepFromUrl
    ? STEPS.findIndex((s) => s.key === stepFromUrl)
    : -1;

  const initialStepIndex = urlStepIndex >= 0 ? urlStepIndex : initial.step;
  const [currentStep, setCurrentStep] = useState(initialStepIndex);
  const [completedSteps, setCompletedSteps] = useState(initial.completed);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(
    () => new Set([...initial.completed, initialStepIndex])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const navigateToStep = useCallback(
    (stepIndex: number) => {
      setCurrentStep(stepIndex);
      setVisitedSteps((prev) => {
        if (prev.has(stepIndex)) return prev;
        return new Set([...prev, stepIndex]);
      });
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", STEPS[stepIndex].key);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Step data as state (needed during render for ReviewStep/SessionsStep props)
  const [buddiesBudgetValues, setBuddiesBudgetValues] = useState<{
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

  const [sessionPreferences, setSessionPreferences] = useState<
    Map<string, SessionPreferenceData>
  >(new Map(initialSessionPreferences.map((p) => [p.sessionId, p])));

  const [hiddenSessionIds, setHiddenSessionIds] = useState<Set<string>>(
    new Set()
  );

  // Snapshots of saved data to detect changes (skip unnecessary saves)
  const [savedSnapshots, setSavedSnapshots] = useState<Record<number, string>>(
    () =>
      buildInitialSnapshots(
        initialBudget,
        initialMinBuddies,
        initialBuddies,
        initialSportRankings,
        initialSessionPreferences
      )
  );

  function getStepSnapshot(step: number): string {
    if (step === 0) {
      return JSON.stringify(buddiesBudgetValues);
    } else if (step === 1) {
      return JSON.stringify(sportRankings);
    } else if (step === 2) {
      return JSON.stringify(Array.from(sessionPreferences.values()));
    } else {
      return "review"; // review step has no editable data
    }
  }

  function getCurrentStepSnapshot(): string {
    return getStepSnapshot(currentStep);
  }

  function isStepDirty(step: number): boolean {
    if (step === 3) return false;
    if (!visitedSteps.has(step)) return false; // never visited
    const saved = savedSnapshots[step];
    if (saved === undefined) return true; // visited but never saved
    return saved !== getStepSnapshot(step);
  }

  function isCurrentStepDirty(): boolean {
    return isStepDirty(currentStep);
  }

  function isAnyStepDirty(): boolean {
    for (let i = 0; i < 3; i++) {
      if (isStepDirty(i)) return true;
    }
    return false;
  }

  function getDirtyStepNames(): string[] {
    const names: string[] = [];
    for (let i = 0; i < 3; i++) {
      if (isStepDirty(i)) names.push(STEPS[i].label);
    }
    return names;
  }

  const handleBuddiesBudgetChange = useCallback(
    (data: {
      budget: number | null;
      minBuddies: number;
      buddies: BuddySelection[];
    }) => {
      setBuddiesBudgetValues(data);
    },
    []
  );

  const handleSportRankingsChange = useCallback(
    (rankings: string[]) => {
      setSportRankings(rankings);

      // Remove session preferences for sports no longer ranked
      const rankedSet = new Set(rankings);
      const sessionSportMap = new Map(
        sessions.map((s) => [s.sessionCode, s.sport])
      );

      setSessionPreferences((currentPrefs) => {
        let changed = false;
        for (const [sessionId] of currentPrefs) {
          const sport = sessionSportMap.get(sessionId);
          if (sport && !rankedSet.has(sport)) {
            changed = true;
            break;
          }
        }
        if (!changed) return currentPrefs;

        const filtered = new Map<string, SessionPreferenceData>();
        for (const [sessionId, pref] of currentPrefs) {
          const sport = sessionSportMap.get(sessionId);
          if (!sport || rankedSet.has(sport)) {
            filtered.set(sessionId, pref);
          }
        }
        return filtered;
      });
    },
    [sessions]
  );

  const handleSessionPreferencesChange = useCallback(
    (prefs: Map<string, SessionPreferenceData>) => {
      setSessionPreferences(prefs);
    },
    []
  );

  const handleHiddenSessionsChange = useCallback((hidden: Set<string>) => {
    setHiddenSessionIds(hidden);
  }, []);

  async function saveCurrentStep(): Promise<boolean> {
    // Review step has nothing to save
    if (currentStep === 3) return true;

    // Skip save only if step was already completed AND data hasn't changed
    if (completedSteps.has(currentStep) && !isCurrentStepDirty()) {
      return true;
    }

    setSaving(true);
    setError("");

    const snapshot = getCurrentStepSnapshot();
    let result;
    try {
      if (currentStep === 0) {
        result = await saveBuddiesBudget(group.id, buddiesBudgetValues);
      } else if (currentStep === 1) {
        result = await saveSportRankings(group.id, {
          sportRankings: sportRankings,
        });
      } else {
        const prefs = Array.from(sessionPreferences.values());
        result = await saveSessionPreferences(group.id, {
          preferences: prefs,
        });
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

    // Record snapshot after successful save
    setSavedSnapshots((prev) => ({ ...prev, [currentStep]: snapshot }));
    return true;
  }

  // Step validity
  const isStepValid =
    currentStep === 0
      ? true // buddies & budget always valid
      : currentStep === 1
        ? sportRankings.length > 0
        : currentStep === 2
          ? sessionPreferences.size > 0
          : true; // review

  const stepValidityHint =
    currentStep === 1 && sportRankings.length === 0
      ? "Select at least 1 sport to continue."
      : currentStep === 2 && sessionPreferences.size === 0
        ? "Select at least 1 session to continue."
        : null;

  // Warn on browser refresh / close when any step is dirty
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isAnyStepDirty()) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  });

  // Register dirty checker for in-app navigation guard
  const dirtyCheckerRef = useRef<() => string[]>(() => []);
  useEffect(() => {
    dirtyCheckerRef.current = getDirtyStepNames;
  });
  useEffect(() => {
    setDirtyChecker(() => dirtyCheckerRef.current());
    return () => setDirtyChecker(null);
  }, [setDirtyChecker]);

  async function handleNext() {
    const saved = await saveCurrentStep();
    if (!saved) return;

    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    navigateToStep(currentStep + 1);
  }

  function handleBack() {
    if (currentStep > 0) {
      navigateToStep(currentStep - 1);
      setError("");
    }
  }

  function handleStepClick(index: number) {
    if (index === currentStep) return;

    // Backward navigation: always allowed
    if (index < currentStep) {
      navigateToStep(index);
      setError("");
      return;
    }

    // Forward navigation: block if any step up to the target has unsaved changes
    for (let i = currentStep; i < index; i++) {
      if (isStepDirty(i)) return;
    }

    // Forward navigation: only if all steps before target are completed
    for (let i = 0; i < index; i++) {
      if (!completedSteps.has(i)) return;
    }
    navigateToStep(index);
    setError("");
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
          // Backward: always clickable. Forward: only if no steps between current and target are dirty and all prior steps completed.
          const isClickable =
            index < currentStep ||
            (index > currentStep &&
              Array.from(
                { length: index - currentStep },
                (_, i) => currentStep + i
              ).every((i) => !isStepDirty(i)) &&
              Array.from({ length: index }, (_, i) => i).every((i) =>
                completedSteps.has(i)
              ));

          // For forward non-clickable steps, find the first dirty step blocking navigation
          const blockingDirtyStep =
            !isClickable && index > currentStep
              ? Array.from(
                  { length: index - currentStep },
                  (_, i) => currentStep + i
                ).find((i) => isStepDirty(i))
              : undefined;
          const disabledTooltip =
            blockingDirtyStep !== undefined
              ? `Unsaved changes in ${STEPS[blockingDirtyStep].label}`
              : undefined;

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
              <div className="group/step relative flex flex-col items-center gap-1">
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
                {!isActive && (isClickable || disabledTooltip) && (
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/step:opacity-100">
                    {isClickable ? `Go to ${step.label}` : disabledTooltip}
                  </span>
                )}
              </div>
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
        {currentStep === 2 && (
          <SessionsStep
            sessions={sessions}
            sportRankings={sportRankings}
            initialPreferences={sessionPreferences}
            initialHiddenSessions={hiddenSessionIds}
            onChange={handleSessionPreferencesChange}
            onHiddenChange={handleHiddenSessionsChange}
          />
        )}
        {currentStep === 3 && (
          <ReviewStep
            budget={buddiesBudgetValues.budget}
            minBuddies={buddiesBudgetValues.minBuddies}
            buddies={buddiesBudgetValues.buddies}
            sportRankings={sportRankings}
            sessionPreferences={sessionPreferences}
            sessions={sessions}
          />
        )}

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
            {currentStep < 3 && (
              <div className="flex flex-col items-end gap-2">
                {currentStep === 2 && (
                  <div className="flex items-center gap-3">
                    {(["high", "medium", "low"] as const).map((level) => {
                      const count = Array.from(
                        sessionPreferences.values()
                      ).filter((p) => p.interest === level).length;
                      if (count === 0) return null;
                      const styles = {
                        high: {
                          backgroundColor: "rgba(0, 157, 229, 0.2)",
                          color: "#009de5",
                        },
                        medium: {
                          backgroundColor: "rgba(250, 204, 21, 0.2)",
                          color: "#d97706",
                        },
                        low: {
                          backgroundColor: "rgba(255, 0, 128, 0.15)",
                          color: "#ff0080",
                        },
                      };
                      return (
                        <span
                          key={level}
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={styles[level]}
                        >
                          {count}{" "}
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </span>
                      );
                    })}
                    <span className="text-xs text-slate-400">
                      {sessionPreferences.size} session
                      {sessionPreferences.size !== 1 ? "s" : ""} selected
                    </span>
                  </div>
                )}
                {error && <p className="text-base text-red-600">{error}</p>}
                {stepValidityHint && (
                  <p className="text-sm text-slate-400">{stepValidityHint}</p>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={saving || !isStepValid}
                  className="rounded-lg bg-[#009de5] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0088c9] disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : currentStep === 2
                      ? "Save & Review"
                      : "Save & Continue"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
